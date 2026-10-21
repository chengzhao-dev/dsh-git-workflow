import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { apply } from '../lib/index.js'

function loadProvider() {
  let provider
  apply({
    skills: {
      registerProvider(factory) {
        provider = factory()
      },
    },
  })
  assert.ok(provider, 'apply() must register a skill provider')
  return provider
}

async function withTempDir(fn) {
  const dir = await mkdtemp(path.join(tmpdir(), 'dsh-git-workflow-'))
  try {
    return await fn(dir)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

async function makeGitDir(root) {
  await mkdir(path.join(root, '.git'), { recursive: true })
}

test('registers one provider named dsh-git-workflow', () => {
  const provider = loadProvider()
  assert.equal(provider.name, 'dsh-git-workflow')
  assert.equal(typeof provider.list, 'function')
  assert.equal(typeof provider.get, 'function')
})

test('lists nothing without a cwd', async () => {
  const provider = loadProvider()
  assert.deepEqual(await provider.list(), [])
})

test('lists nothing outside a git checkout', async () => {
  await withTempDir(async (dir) => {
    const provider = loadProvider()
    assert.deepEqual(await provider.list({ cwd: dir }), [])
  })
})

test('lists the skill inside a git checkout', async () => {
  await withTempDir(async (dir) => {
    await makeGitDir(dir)
    const provider = loadProvider()
    const skills = await provider.list({ cwd: dir })
    assert.equal(skills.length, 1)
    assert.equal(skills[0].name, 'shipping-github')
    assert.equal(skills[0].provider, 'dsh-git-workflow')
    assert.equal(skills[0].source, 'bundled')
    assert.equal(skills[0].rank, 550)
    assert.equal(skills[0].resourceBase.kind, 'directory')
    assert.match(skills[0].description, /Git/)
    assert.ok(skills[0].path.endsWith(path.join('skills', 'shipping-github', 'SKILL.md')))
  })
})

test('discovers the repository from a nested directory', async () => {
  await withTempDir(async (dir) => {
    await makeGitDir(dir)
    const nested = path.join(dir, 'a', 'b', 'c')
    await mkdir(nested, { recursive: true })
    const provider = loadProvider()
    const skills = await provider.list({ cwd: nested })
    assert.equal(skills.length, 1)
  })
})

test('accepts a worktree .git file as checkout marker', async () => {
  await withTempDir(async (dir) => {
    await writeFile(path.join(dir, '.git'), 'gitdir: /tmp/worktree/.git/worktrees/example\n')
    const provider = loadProvider()
    const skills = await provider.list({ cwd: dir })
    assert.equal(skills.length, 1)
  })
})

test('returns nothing when the signal is already aborted', async () => {
  await withTempDir(async (dir) => {
    await makeGitDir(dir)
    const provider = loadProvider()
    const controller = new AbortController()
    controller.abort()
    assert.deepEqual(await provider.list({ cwd: dir, signal: controller.signal }), [])
  })
})

test('get returns the skill body for a discovered candidate', async () => {
  await withTempDir(async (dir) => {
    await makeGitDir(dir)
    const provider = loadProvider()
    const [candidate] = await provider.list({ cwd: dir })
    const skill = await provider.get(candidate, { cwd: dir })
    assert.equal(skill.name, 'shipping-github')
    assert.match(skill.content, /shipping-github/)
    assert.ok(skill.resourceBase.path.startsWith(path.dirname(candidate.path)))
  })
})

test('get re-checks the gate when a cwd is supplied', async () => {
  await withTempDir(async (dir) => {
    await makeGitDir(dir)
    const provider = loadProvider()
    const [candidate] = await provider.list({ cwd: dir })
    const outside = await mkdtemp(path.join(tmpdir(), 'dsh-git-workflow-outside-'))
    try {
      assert.equal(await provider.get(candidate, { cwd: outside }), undefined)
    } finally {
      await rm(outside, { recursive: true, force: true })
    }
  })
})

test('get rejects candidates from another provider', async () => {
  await withTempDir(async (dir) => {
    await makeGitDir(dir)
    const provider = loadProvider()
    const [candidate] = await provider.list({ cwd: dir })
    assert.equal(await provider.get({ ...candidate, provider: 'other' }), undefined)
  })
})

test('get rejects a locator outside the packaged skills root', async () => {
  const provider = loadProvider()
  assert.equal(
    await provider.get({
      name: 'shipping-github',
      description: 'x',
      invocation: { modelInvocable: true, userInvocable: true },
      source: 'bundled',
      provider: 'dsh-git-workflow',
      rank: 550,
      locator: path.resolve('/tmp'),
      resourceBase: { kind: 'directory', path: '/tmp' },
      path: '/tmp/SKILL.md',
    }),
    undefined,
  )
})

test('get rejects a locator whose basename does not match the name', async () => {
  const provider = loadProvider()
  const skillRoot = path.resolve('skills')
  assert.equal(
    await provider.get({
      name: 'shipping-github',
      description: 'x',
      invocation: { modelInvocable: true, userInvocable: true },
      source: 'bundled',
      provider: 'dsh-git-workflow',
      rank: 550,
      locator: path.join(skillRoot, 'other-skill'),
      resourceBase: { kind: 'directory', path: path.join(skillRoot, 'other-skill') },
      path: path.join(skillRoot, 'other-skill', 'SKILL.md'),
    }),
    undefined,
  )
})
