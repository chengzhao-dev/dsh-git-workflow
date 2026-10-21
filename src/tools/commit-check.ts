// `git_commit_check`: read-only commit-message inspection.
//
// Two modes share the same parser:
//   - `message` checks one draft message before `git commit`.
//   - no message checks the range that is about to be pushed.
// The tool never stages, commits, pushes or rewrites anything. A non-Git cwd
// returns a failure without running git.
import { execFile } from 'node:child_process'
import path from 'node:path'
import {
  checkCommitMessage,
  type CommitCheckOptions,
  type CommitIssue,
  type CommitCheckResult,
} from '../commit-rules.js'
import { findGitRoot } from '../workspace.js'
import type { ToolExec, ToolRegistry } from './registry.js'

const MAX_COMMITS = 200
const MAX_REPORT_ISSUES = 60
const MAX_RANGE_LENGTH = 200

export interface CommitCheckInput {
  root: string
  message?: string
  /** Expected author/committer identity (name, email, or `Name <email>`). */
  author?: string
  range?: string
  all?: boolean
  requireChinese?: boolean
  extraTypes?: string[]
  allowedTrailers?: string[]
}

export interface CommitCheckOutput {
  pass: boolean
  checked: number
  report: string
}

interface GitResult {
  ok: boolean
  stdout: string
  stderr: string
}

interface CommitRecord {
  sha: string
  author: string
  authorEmail: string
  committer: string
  committerEmail: string
  message: string
}

function runGit(cwd: string, args: string[]): Promise<GitResult> {
  return new Promise((resolve) => {
    execFile(
      'git',
      args,
      { cwd, encoding: 'utf8', windowsHide: true, maxBuffer: 16 * 1024 * 1024 },
      (error, stdout, stderr) => {
        resolve({
          ok: !error,
          stdout: String(stdout ?? ''),
          stderr: String(stderr ?? ''),
        })
      },
    )
  })
}

async function resolveRange(
  root: string,
  input: CommitCheckInput,
): Promise<{ range: string; note?: string }> {
  if (input.all === true) return { range: '--all' }
  if (input.range !== undefined && input.range.trim() !== '') {
    const range = input.range.trim()
    if (range.startsWith('-') || range.length > MAX_RANGE_LENGTH) {
      throw new Error(`range 不合法：${range}`)
    }
    return { range }
  }

  const upstream = await runGit(root, [
    'rev-parse',
    '--abbrev-ref',
    '--symbolic-full-name',
    '@{upstream}',
  ])
  const upstreamName = upstream.stdout.trim()
  if (upstream.ok && upstreamName !== '') {
    return { range: `${upstreamName}..HEAD`, note: `上游 ${upstreamName}` }
  }

  const current = (await runGit(root, ['branch', '--show-current'])).stdout.trim()
  const candidates: Array<{ ref: string; name: string }> = []
  const originHead = await runGit(root, [
    'symbolic-ref',
    '--quiet',
    '--short',
    'refs/remotes/origin/HEAD',
  ])
  if (originHead.ok && originHead.stdout.trim() !== '') {
    candidates.push({ ref: originHead.stdout.trim(), name: originHead.stdout.trim() })
  }
  for (const name of ['origin/main', 'origin/master', 'refs/heads/main', 'refs/heads/master']) {
    if (name === `refs/heads/${current}`) continue
    const verify = await runGit(root, ['rev-parse', '--verify', '--quiet', name])
    if (verify.ok && verify.stdout.trim() !== '') candidates.push({ ref: name, name })
  }

  const base = candidates.find((candidate) => candidate.name !== current)
  if (base) {
    return {
      range: `${base.ref}..HEAD`,
      note: `没有上游，相对默认分支 ${base.name}`,
    }
  }
  return {
    range: 'HEAD',
    note: '没有上游也找不到默认分支，只检查 HEAD；需要更早提交请传 range 或 all:true',
  }
}

function parseLog(stdout: string): CommitRecord[] {
  const records: CommitRecord[] = []
  for (const raw of stdout.split('\x1e')) {
    const trimmed = raw.trim()
    if (trimmed === '') continue
    const parts = trimmed.split('\x1f')
    if (parts.length < 6) continue
    records.push({
      sha: parts[0] ?? '',
      author: parts[1] ?? '',
      authorEmail: parts[2] ?? '',
      committer: parts[3] ?? '',
      committerEmail: parts[4] ?? '',
      message: parts.slice(5).join('\x1f'),
    })
  }
  return records
}

async function readCommits(
  root: string,
  range: string,
): Promise<{ commits: CommitRecord[]; truncated: boolean }> {
  const result = await runGit(root, [
    'log',
    range,
    '--no-merges',
    `--max-count=${MAX_COMMITS + 1}`,
    '--format=%H%x1f%an%x1f%ae%x1f%cn%x1f%ce%x1f%B%x1e',
  ])
  if (!result.ok) {
    throw new Error(`无法读取 git log：${result.stderr.trim() || '未知错误'}`)
  }
  const commits = parseLog(result.stdout)
  const truncated = commits.length > MAX_COMMITS
  return { commits: commits.slice(0, MAX_COMMITS), truncated }
}

function normalizeExpectations(author: string | undefined): string[] {
  return (author ?? '')
    .split(/[,，;；]/)
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value !== '')
}

function matchesIdentity(value: string, expectations: string[]): boolean {
  if (expectations.length === 0) return true
  const folded = value.toLowerCase()
  const name = folded.replace(/<[^>]*>/g, '').trim()
  const email = /<([^>]*)>/.exec(folded)?.[1]?.trim() ?? ''
  return expectations.some((expected) => {
    if (expected === folded) return true
    if (expected.includes('<')) return false
    return expected === name || (email !== '' && expected === email)
  })
}

function describeIssues(issues: CommitIssue[], prefix = ''): string[] {
  return issues
    .slice(0, MAX_REPORT_ISSUES)
    .map((issue) => `${prefix}[${issue.code}] ${issue.message}${issue.line ? ` (第 ${issue.line} 行)` : ''}`)
}

function messageReport(result: CommitCheckResult, requireChinese: boolean): string {
  const lines: string[] = []
  lines.push(`git_commit_check · 提交信息 · ${result.valid ? '通过' : '未通过'}`)
  lines.push(`扩展检查：${requireChinese ? '中文描述开启' : '中文描述关闭'}`)
  if (result.parsed) {
    const parsed = result.parsed
    lines.push(
      `类型：${parsed.type}${parsed.scope ? ` · 范围：${parsed.scope}` : ''} · 破坏性：${parsed.breaking ? '是' : '否'}`,
    )
    lines.push(`描述：${parsed.description}`)
    lines.push(`正文：${parsed.body === '' ? '无' : '有'}`)
    lines.push(`脚注：${parsed.footers.length === 0 ? '无' : parsed.footers.map((footer) => footer.token).join(', ')}`)
  }
  if (result.issues.length > 0) {
    lines.push(`问题（${result.issues.length}）：`)
    lines.push(...describeIssues(result.issues, '- '))
    if (result.issues.length > MAX_REPORT_ISSUES) {
      lines.push(`- 其余 ${result.issues.length - MAX_REPORT_ISSUES} 条未显示。`)
    }
  }
  return lines.join('\n')
}

export async function runCommitCheck(input: CommitCheckInput): Promise<CommitCheckOutput> {
  if (input.message !== undefined && (input.range !== undefined || input.all === true || input.author !== undefined)) {
    throw new Error('message 只能单独使用；检查历史提交时请改传 range 或 all。')
  }
  if (input.all === true && input.range !== undefined) {
    throw new Error('all 与 range 不能同时使用。')
  }
  const root = await findGitRoot(input.root)
  if (!root) {
    throw new Error(`git_commit_check 需要 Git 工作树：${path.resolve(input.root)} 不在任何 checkout 内。`)
  }

  const options: CommitCheckOptions = {
    requireChinese: input.requireChinese !== false,
    ...(input.extraTypes ? { extraTypes: input.extraTypes } : {}),
    ...(input.allowedTrailers ? { allowedTrailers: input.allowedTrailers } : {}),
  }

  if (input.message !== undefined) {
    const result = checkCommitMessage(input.message, options)
    return {
      pass: result.valid,
      checked: 1,
      report: messageReport(result, options.requireChinese === true),
    }
  }

  const resolved = await resolveRange(root, input)
  const head = await runGit(root, ['rev-parse', '--verify', 'HEAD'])
  if (!head.ok) {
    throw new Error('仓库还没有提交；先创建首个提交，或用 message 模式检查草稿。')
  }
  const { commits, truncated } = await readCommits(root, resolved.range)
  const expectations = normalizeExpectations(input.author)
  const lines: string[] = []
  const problems: string[] = []
  let failed = 0

  for (const commit of commits) {
    const result = checkCommitMessage(commit.message, options)
    const issues = [...result.issues]
    if (expectations.length > 0) {
      const author = `${commit.author} <${commit.authorEmail}>`
      const committer = `${commit.committer} <${commit.committerEmail}>`
      if (!matchesIdentity(author, expectations)) {
        issues.push({
          code: 'author-mismatch',
          message: `author \`${author}\` 不在预期身份内。`,
        })
      }
      if (!matchesIdentity(committer, expectations)) {
        issues.push({
          code: 'committer-mismatch',
          message: `committer \`${committer}\` 不在预期身份内。`,
        })
      }
    }
    const subject = (commit.message.split('\n')[0] ?? '').slice(0, 120)
    if (issues.length === 0) {
      lines.push(`- ${commit.sha.slice(0, 8)} ${subject}`)
      continue
    }
    failed += 1
    lines.push(`- ${commit.sha.slice(0, 8)} ${subject}`)
    problems.push(...describeIssues(issues, `  ${commit.sha.slice(0, 8)} `))
  }

  const header = [
    `git_commit_check · 范围 ${resolved.range} · ${commits.length} 个提交 · ${failed === 0 && !truncated ? '通过' : '未通过'}`,
    ...(expectations.length === 0
      ? ['注意：未提供 author，本次只检查提交信息，没有核对 author/committer 身份。']
      : []),
    ...(resolved.note ? [resolved.note] : []),
    ...(truncated ? [`提交数超过 ${MAX_COMMITS}，只检查了前 ${MAX_COMMITS} 个；请缩小 range。`] : []),
  ]
  const body = commits.length === 0 ? ['没有需要检查的提交。'] : lines
  if (problems.length > 0) {
    body.push(`问题（${problems.length}）：`, ...problems)
  }
  return {
    pass: failed === 0 && !truncated,
    checked: commits.length,
    report: [...header, ...body].join('\n'),
  }
}

const RESULT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    pass: { type: 'boolean' },
    checked: { type: 'integer' },
    report: { type: 'string' },
  },
  required: ['pass', 'checked', 'report'],
}

interface CommitCheckArgs {
  message?: unknown
  author?: unknown
  range?: unknown
  all?: unknown
  require_chinese?: unknown
  extra_types?: unknown
  allowed_trailers?: unknown
}

function stringArray(value: unknown, name: string): string[] | undefined {
  if (value === undefined) return undefined
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error(`${name} 必须是字符串数组。`)
  }
  return value as string[]
}

function optionalString(value: unknown, name: string): string | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'string') throw new Error(`${name} 必须是字符串。`)
  return value
}

function validateArgs(args: CommitCheckArgs): Omit<CommitCheckInput, 'root'> {
  const allowed = new Set([
    'message',
    'author',
    'range',
    'all',
    'require_chinese',
    'extra_types',
    'allowed_trailers',
  ])
  for (const key of Object.keys(args)) {
    if (!allowed.has(key)) throw new Error(`不接受字段 ${key}。`)
  }
  if (args.message !== undefined && typeof args.message !== 'string') {
    throw new Error('message 必须是字符串。')
  }
  if (args.all !== undefined && typeof args.all !== 'boolean') {
    throw new Error('all 必须是布尔值。')
  }
  if (args.require_chinese !== undefined && typeof args.require_chinese !== 'boolean') {
    throw new Error('require_chinese 必须是布尔值。')
  }
  const range = optionalString(args.range, 'range')
  if (range !== undefined && range.trim() === '') throw new Error('range 不能是空字符串。')
  const author = optionalString(args.author, 'author')
  if (author !== undefined && author.trim() === '') throw new Error('author 不能是空字符串。')
  return {
    ...(args.message !== undefined ? { message: args.message } : {}),
    ...(author !== undefined ? { author } : {}),
    ...(range !== undefined ? { range } : {}),
    ...(args.all !== undefined ? { all: args.all } : {}),
    ...(args.require_chinese !== undefined ? { requireChinese: args.require_chinese } : {}),
    ...(stringArray(args.extra_types, 'extra_types')
      ? { extraTypes: args.extra_types as string[] }
      : {}),
    ...(stringArray(args.allowed_trailers, 'allowed_trailers')
      ? { allowedTrailers: args.allowed_trailers as string[] }
      : {}),
  }
}

export function registerCommitCheckTool(tools: ToolRegistry): void {
  tools.register({
    name: 'git_commit_check',
    description:
      '只读检查 Conventional Commits 提交信息：先按官网 1.0.0 结构解析类型、范围、`!`、描述、正文和脚注，再按本插件策略检查 11 个默认类型、中文描述、身份 trailer。传 message 检查一条草稿（此时不能同时传 range/all/author）；不传则检查即将推送的区间（默认 @{upstream}..HEAD，没有上游时相对默认分支；不会用 git log --all，除非显式 all:true）。非 Git 目录直接失败，不执行 git。本工具不暂存、不提交、不推送。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        message: {
          type: 'string',
          description:
            '要检查的单条提交信息；省略时读取 git log。多段说明请保留真实换行，工具会解析正文和脚注。',
        },
        author: {
          type: 'string',
          description:
            '预期 author/committer 身份，可写姓名、邮箱或 `Name <email>`，多个用逗号分隔。仅用于读取历史提交的模式；与 message 同传会报错。身份应来自项目 AGENTS.md/CONTRIBUTING.md，不从 git config 猜测。',
        },
        range: {
          type: 'string',
          description:
            '显式 git log 区间，例如 `origin/main..HEAD`。省略时自动取即将推送的区间。不能以 `-` 开头。',
        },
        all: {
          type: 'boolean',
          description: '检查全部历史（git log --all）。默认 false；只在调用方明确要求全历史时使用。',
        },
        require_chinese: {
          type: 'boolean',
          description:
            '是否启用插件扩展：描述至少一个汉字、最长 50 字符、行末不加句号。默认 true；项目另有格式时传 false。',
        },
        extra_types: {
          type: 'array',
          items: { type: 'string' },
          description: '项目额外允许的提交类型，追加到默认 11 个类型之后。',
        },
        allowed_trailers: {
          type: 'array',
          items: { type: 'string' },
          description:
            '项目明文要求、可放行的身份 trailer，例如 DCO 的 `Signed-off-by`。默认仍拒绝 Co-authored-by 与 Signed-off-by。',
        },
      },
    },
    output: {
      schema: RESULT_SCHEMA,
      render: (_args, value) => [{ type: 'text', text: value.report }],
    },
    async execute(args: CommitCheckArgs, exec: ToolExec) {
      const cwd = exec?.agent?.session?.header?.cwd
      const root = typeof cwd === 'string' && cwd.trim() !== '' ? cwd : process.cwd()
      return runCommitCheck({ root, ...validateArgs(args) })
    },
    presentCall(args) {
      const mode = typeof args.message === 'string' ? '草稿提交信息' : '即将推送的提交'
      return {
        card: 'generic',
        title: '提交检查',
        kind: 'execute',
        locations: [{ path: '.' }],
        rawInput: mode,
        content: [{ type: 'text', text: `检查：${mode}` }],
      }
    },
    presentResult(_args, result) {
      return { card: 'generic', title: '提交检查', content: result.content }
    },
  })
}
