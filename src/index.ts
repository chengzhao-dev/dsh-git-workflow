// dsh-git-workflow bundle entry.
//
// Registers the packaged `shipping-github` skill as one bundle-scoped skill
// provider. The provider is read-only and scans only `skills/<name>/SKILL.md`;
// the skill directory becomes the resourceBase so relative references,
// knowledge notes and incident reports resolve from the installed package.
//
// The provider scopes itself to git working trees: `list()` returns nothing
// unless the session cwd sits inside a checkout (a `.git` directory or a
// worktree `.git` file). A plain folder or a path above the repository root
// therefore never sees the skill.
//
// Rank 550 is lower priority than project/user skills (project `.agents/skills`
// 200, user `.agents/skills` 500) and higher priority than the bundled root
// (600), so a project can override `shipping-github` by name without editing
// this package.
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { registerCommitCheckTool } from './tools/commit-check.js'
import type { ToolRegistry } from './tools/registry.js'
import { registerShipReportTool } from './tools/ship-report.js'
import { isGitWorkflowWorkspace } from './workspace.js'

export const name = 'dsh-git-workflow'
export const inject = ['skills', 'tools']

const PROVIDER = 'dsh-git-workflow'
const RANK = 550
const KNOWN_SKILLS = new Set(['shipping-github'])
const SKILL_NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const PACKAGE_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const SKILLS_ROOT = path.join(PACKAGE_ROOT, 'skills')

interface SkillCandidate {
  name: string
  description: string
  whenToUse?: string
  invocation: { modelInvocable: boolean; userInvocable: boolean }
  source: string
  provider: string
  rank: number
  locator: string
  resourceBase: { kind: 'directory'; path: string }
  path: string
  metadata?: Record<string, unknown>
}

interface ListOptions {
  cwd?: string
  signal?: AbortSignal
}

interface SkillProvider {
  name: string
  list: (options?: ListOptions) => Promise<SkillCandidate[]>
  get: (candidate: SkillCandidate | undefined, options?: ListOptions) => Promise<unknown>
}

interface DshContext {
  skills: {
    registerProvider: (factory: () => SkillProvider) => unknown
  }
  tools?: ToolRegistry
}

/** Minimal YAML frontmatter reader for the keys SKILL.md actually uses. */
function parseFrontmatter(source: string): { data: Record<string, unknown>; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(source)
  if (!match) return { data: {}, body: source }

  const data: Record<string, unknown> = {}
  const stack: Array<{ indent: number; target: Record<string, unknown> }> = [
    { indent: -1, target: data },
  ]
  for (const rawLine of match[1].split(/\r?\n/)) {
    const line = rawLine.replace(/\t/g, '  ')
    if (!line.trim() || line.trimStart().startsWith('#')) continue
    const indent = line.length - line.trimStart().length
    const pair = /^([A-Za-z0-9_.-]+):(?:\s*(.*))?$/.exec(line.trim())
    if (!pair) continue
    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop()
    const parent = stack[stack.length - 1].target
    const key = pair[1]
    const value = (pair[2] ?? '').trim()
    if (value === '') {
      const child: Record<string, unknown> = {}
      parent[key] = child
      stack.push({ indent, target: child })
      continue
    }
    parent[key] = parseScalar(value)
  }
  return { data, body: source.slice(match[0].length) }
}

function parseScalar(value: string): unknown {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    const quote = value[0]
    const inner = value.slice(1, -1)
    return quote === '"'
      ? inner.replace(/\\"/g, '"').replace(/\\n/g, '\n')
      : inner.replace(/''/g, "'")
  }
  if (value === 'true') return true
  if (value === 'false') return false
  if (value === 'null' || value === '~') return null
  if (/^\[.*\]$/.test(value)) {
    return value
      .slice(1, -1)
      .split(',')
      .map((item) => parseScalar(item.trim()))
      .filter((item) => item !== '')
  }
  return value
}

async function readCandidate(skillDir: string): Promise<SkillCandidate | undefined> {
  const skillFile = path.join(skillDir, 'SKILL.md')
  let source: string
  try {
    source = await readFile(skillFile, 'utf8')
  } catch {
    return undefined
  }
  const { data } = parseFrontmatter(source)
  if (typeof data.name !== 'string' || !SKILL_NAME_RE.test(data.name)) return undefined
  if (!KNOWN_SKILLS.has(data.name)) return undefined
  if (typeof data.description !== 'string' || data.description.trim() === '') return undefined
  if (data.name !== path.basename(skillDir)) return undefined

  const candidate: SkillCandidate = {
    name: data.name,
    description: data.description.trim(),
    invocation: { modelInvocable: true, userInvocable: true },
    source: 'bundled',
    provider: PROVIDER,
    rank: RANK,
    locator: skillDir,
    resourceBase: { kind: 'directory', path: skillDir },
    path: skillFile,
  }
  if (typeof data.whenToUse === 'string' && data.whenToUse.trim()) {
    candidate.whenToUse = data.whenToUse.trim()
  }
  if (data.metadata && typeof data.metadata === 'object' && !Array.isArray(data.metadata)) {
    candidate.metadata = data.metadata as Record<string, unknown>
  }
  return candidate
}

async function listSkills(options: ListOptions = {}): Promise<SkillCandidate[]> {
  if (options.signal?.aborted) return []
  if (!(await isGitWorkflowWorkspace(options.cwd))) return []
  if (options.signal?.aborted) return []
  let entries
  try {
    entries = await readdir(SKILLS_ROOT, { withFileTypes: true })
  } catch {
    return []
  }
  const candidates: SkillCandidate[] = []
  for (const entry of entries) {
    if (!entry.isDirectory() || !KNOWN_SKILLS.has(entry.name)) continue
    if (options.signal?.aborted) return []
    const candidate = await readCandidate(path.join(SKILLS_ROOT, entry.name))
    if (candidate) candidates.push(candidate)
  }
  candidates.sort((a, b) => a.name.localeCompare(b.name))
  return candidates
}

async function getSkill(candidate: SkillCandidate | undefined, options: ListOptions = {}) {
  if (options.signal?.aborted) return undefined
  if (!candidate || candidate.provider !== PROVIDER) return undefined
  // A candidate can outlive a directory change in the same session. Re-check
  // only when the caller supplies a cwd; a plain `get()` keeps working for
  // candidates that were already discovered in this workspace.
  if (options.cwd !== undefined && !(await isGitWorkflowWorkspace(options.cwd))) return undefined
  if (!KNOWN_SKILLS.has(candidate.name)) return undefined
  const skillDir = candidate.locator
  if (typeof skillDir !== 'string') return undefined
  const resolved = path.resolve(skillDir)
  if (resolved !== SKILLS_ROOT && !resolved.startsWith(SKILLS_ROOT + path.sep)) return undefined
  if (path.basename(resolved) !== candidate.name) return undefined

  let source: string
  try {
    source = await readFile(path.join(resolved, 'SKILL.md'), 'utf8')
  } catch {
    return undefined
  }
  const { data, body } = parseFrontmatter(source)
  if (data.name !== candidate.name) return undefined

  return {
    name: candidate.name,
    description: candidate.description,
    ...(candidate.whenToUse ? { whenToUse: candidate.whenToUse } : {}),
    invocation: candidate.invocation,
    source: candidate.source,
    provider: PROVIDER,
    resourceBase: { kind: 'directory', path: resolved },
    path: path.join(resolved, 'SKILL.md'),
    ...(candidate.metadata ? { metadata: candidate.metadata } : {}),
    content: body.trim(),
  }
}

export function apply(ctx: DshContext): void {
  ctx.skills.registerProvider(() => ({
    name: PROVIDER,
    list: listSkills,
    get: getSkill,
  }))
  // The two tools are read-only and register at apply() time, so they appear in
  // every session's tool catalog; they refuse a non-Git cwd only when executed.
  if (ctx.tools && typeof ctx.tools.register === 'function') {
    registerCommitCheckTool(ctx.tools)
    registerShipReportTool(ctx.tools)
  }
}
