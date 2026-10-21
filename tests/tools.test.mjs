import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { apply } from '../lib/index.js'
import { runCommitCheck } from '../lib/tools/commit-check.js'
import { buildShipReport } from '../lib/tools/ship-report.js'

const run = promisify(execFile)

async function git(cwd, args) {
  const { stdout } = await run('git', args, { cwd, encoding: 'utf8' })
  return stdout.trim()
}

async function withRepo(fn) {
  const dir = await mkdtemp(path.join(tmpdir(), 'dsh-git-workflow-tools-'))
  try {
    await git(dir, ['init', '-q', '-b', 'main'])
    await git(dir, ['config', 'user.name', 'Alice'])
    await git(dir, ['config', 'user.email', 'alice@example.com'])
    await writeFile(path.join(dir, 'README.md'), '# fixture\n')
    await git(dir, ['add', 'README.md'])
    await commit(dir, 'chore: init')
    await writeFile(path.join(dir, 'note.txt'), 'one\n')
    await git(dir, ['add', 'note.txt'])
    await commit(dir, 'feat: add note')
    return await fn(dir)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

async function commit(cwd, message) {
  const file = path.join(cwd, '.git', 'COMMIT_MESSAGE')
  await writeFile(file, `${message}\n`, 'utf8')
  await git(cwd, ['commit', '-q', '-F', file])
}

test('commit check fails outside a git checkout without running git', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'dsh-git-workflow-nogit-'))
  try {
    await assert.rejects(
      runCommitCheck({ root: dir, message: 'feat: x' }),
      /需要 Git 工作树/,
    )
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('commit check explains an unborn repository', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'dsh-git-workflow-empty-'))
  try {
    await git(dir, ['init', '-q', '-b', 'main'])
    await assert.rejects(runCommitCheck({ root: dir }), /还没有提交/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('commit check validates a supplied message', async () => {
  await withRepo(async (dir) => {
    const ok = await runCommitCheck({ root: dir, message: 'feat: 添加功能', requireChinese: true })
    assert.equal(ok.pass, true)
    assert.match(ok.report, /通过/)
    const bad = await runCommitCheck({ root: dir, message: 'feat：错误', requireChinese: false })
    assert.equal(bad.pass, false)
    assert.match(bad.report, /invalid-header/)
  })
})

test('commit check defaults to the next-push range without an upstream', async () => {
  await withRepo(async (dir) => {
    const result = await runCommitCheck({ root: dir, requireChinese: false })
    assert.equal(result.pass, true)
    assert.equal(result.checked, 2)
    assert.match(result.report, /没有上游/)
  })
})

test('commit check reads an explicit range and reports each commit', async () => {
  await withRepo(async (dir) => {
    await writeFile(path.join(dir, 'second.txt'), 'two\n')
    await git(dir, ['add', 'second.txt'])
    await commit(dir, 'bad message')
    const result = await runCommitCheck({ root: dir, range: 'HEAD~2..HEAD', requireChinese: false })
    assert.equal(result.checked, 2)
    assert.equal(result.pass, false)
    assert.match(result.report, /范围 HEAD~2\.\.HEAD/)
    assert.match(result.report, /bad message/)
  })
})

test('commit check enforces the expected author identity', async () => {
  await withRepo(async (dir) => {
    const bad = await runCommitCheck({
      root: dir,
      range: 'HEAD~1..HEAD',
      author: 'Bob <bob@example.com>',
      requireChinese: false,
    })
    assert.equal(bad.pass, false)
    assert.match(bad.report, /author-mismatch/)
    const good = await runCommitCheck({
      root: dir,
      range: 'HEAD~1..HEAD',
      author: 'Alice <alice@example.com>',
      requireChinese: false,
    })
    assert.equal(good.pass, true)
    const partial = await runCommitCheck({
      root: dir,
      range: 'HEAD~1..HEAD',
      author: 'Alice',
      requireChinese: false,
    })
    assert.equal(partial.pass, true)
    const noAuthor = await runCommitCheck({ root: dir, range: 'HEAD~1..HEAD', requireChinese: false })
    assert.match(noAuthor.report, /未提供 author/)
  })
})

test('ship report renders the closed-set receipt', () => {
  const { receipt } = buildShipReport({
    mode: 'push',
    executed: true,
    branch: 'main',
    commits: ['feat: 添加交付回执'],
    remote: { name: 'origin', matches: true, local_sha: 'a'.repeat(40), remote_sha: 'a'.repeat(40) },
    checks: { identity: 'pass', message: 'pass', project: 'skip', readback: 'pass' },
    unexecuted: ['未打标签'],
  })
  assert.match(receipt, /mode=push · executed=true/)
  assert.match(receipt, /checks: identity=pass · message=pass · project=skip · readback=pass/)
  assert.match(receipt, /remote: origin · matches=true/)
  assert.match(receipt, /- 未打标签/)
})

test('ship report rejects values outside the closed set', () => {
  assert.throws(
    () =>
      buildShipReport({
        mode: 'deploy',
        executed: false,
        branch: 'main',
        checks: { identity: 'pass', message: 'pass', project: 'pass', readback: 'pass' },
      }),
    /mode/,
  )
  assert.throws(
    () =>
      buildShipReport({
        mode: 'skipped',
        executed: true,
        branch: 'main',
        checks: { identity: 'pass', message: 'pass', project: 'pass', readback: 'pass' },
      }),
    /skipped/,
  )
  assert.throws(
    () =>
      buildShipReport({
        mode: 'commit',
        executed: true,
        branch: 'main',
        checks: { identity: 'pass', message: 'pass', project: 'pass', readback: 'maybe' },
      }),
    /checks\.readback/,
  )
  assert.throws(
    () =>
      buildShipReport({
        mode: 'commit',
        executed: true,
        branch: 'main',
        checks: { identity: 'pass', message: 'pass', project: 'pass', readback: 'pass' },
        extra: true,
      }),
    /不接受字段/,
  )
})

test('commit check rejects conflicting input modes', async () => {
  await withRepo(async (dir) => {
    await assert.rejects(
      runCommitCheck({ root: dir, message: 'feat: x', author: 'Alice' }),
      /只能单独使用/,
    )
    await assert.rejects(
      runCommitCheck({ root: dir, range: 'HEAD~1..HEAD', all: true }),
      /不能同时使用/,
    )
  })
})

test('registered commit tool executes through the host exec context', async () => {
  await withRepo(async (dir) => {
    const definitions = []
    apply({
      skills: { registerProvider(factory) { factory() } },
      tools: { register(definition) { definitions.push(definition) } },
    })
    const tool = definitions.find((definition) => definition.name === 'git_commit_check')
    const exec = { agent: { session: { header: { cwd: dir } } } }
    await assert.rejects(tool.execute({ message: 'feat: x', extra: true }, exec), /不接受字段/)
    const result = await tool.execute({ message: 'feat: 添加功能' }, exec)
    assert.equal(result.pass, true)
    assert.equal(tool.output.render({}, result)[0].type, 'text')
  })
})

test('registered ship tool renders through the host definition', async () => {
  const definitions = []
  apply({
    skills: { registerProvider(factory) { factory() } },
    tools: { register(definition) { definitions.push(definition) } },
  })
  const tool = definitions.find((definition) => definition.name === 'git_ship_report')
  const result = await tool.execute({
    mode: 'commit',
    executed: true,
    branch: 'main',
    commits: ['feat: 添加交付回执'],
    checks: { identity: 'pass', message: 'pass', project: 'pass', readback: 'skip' },
  }, {})
  assert.match(result.receipt, /mode=commit · executed=true/)
  assert.equal(tool.output.render({}, result)[0].text, result.receipt)
})

test('apply registers both tools when the host exposes a tool registry', () => {
  const registered = []
  apply({
    skills: { registerProvider(factory) { factory() } },
    tools: { register(definition) { registered.push(definition.name) } },
  })
  assert.deepEqual(registered.sort(), ['git_commit_check', 'git_ship_report'])
})

test('apply tolerates a context without a tool registry', () => {
  assert.doesNotThrow(() =>
    apply({ skills: { registerProvider(factory) { factory() } } }),
  )
})
