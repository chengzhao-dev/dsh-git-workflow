import assert from 'node:assert/strict'
import { readdir, readFile, access } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SKILLS = path.join(ROOT, 'skills')
const SKILL = path.join(SKILLS, 'shipping-github')

const EXPECTED = [
  'SKILL.md',
  'steps/01-read-constraints.md',
  'steps/02-define-scope.md',
  'steps/03-project-gate.md',
  'steps/04-write-message.md',
  'steps/05-stage-and-commit.md',
  'steps/06-push-and-verify.md',
  'steps/07-pr-and-issue.md',
  'steps/08-release-gate.md',
  'steps/09-ship-report.md',
  'scripts/checking-commit-identity.mjs',
  'references/git-workflow.md',
  'references/ci.md',
  'references/github-pages.md',
  'references/publish-gate.md',
  'references/repository-hygiene.md',
  'knowledge/repository-hygiene.md',
  'knowledge/pages-deployment.md',
  'knowledge/publish-surface.md',
  'knowledge/incidents/INDEX.md',
  'knowledge/incidents/desktop-publish-and-push-failure.md',
  'knowledge/incidents/pages-mojibake-and-source-drift.md',
]

const TEMPLATES = [
  'templates/repository/gitattributes.template',
  'templates/repository/gitignore.template',
  'templates/repository/editorconfig.template',
  'templates/repository/CONTRIBUTING.md',
  'templates/github-pages/pages.yml.template',
  'templates/github-pages/render-check.yml.template',
  'templates/github-pages/ci-prepare.action.yml.template',
]

const FORBIDDEN = [
  { pattern: /D:\\/i, label: 'Windows absolute path' },
  { pattern: /\/Users\//, label: 'macOS home path' },
  { pattern: /cpp-notes/, label: 'old repository name cpp-notes' },
  { pattern: /cpp-board-games/, label: 'old repository name cpp-board-games' },
  { pattern: /tictactoe/i, label: 'project-specific game name' },
]

async function exists(file) {
  try {
    await access(file)
    return true
  } catch {
    return false
  }
}

function parseFrontmatter(source) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(source)
  if (!match) return {}
  const data = {}
  for (const line of match[1].split(/\r?\n/)) {
    const pair = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line)
    if (pair) data[pair[1]] = pair[2].trim().replace(/^["']|["']$/g, '')
  }
  return data
}

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) files.push(...(await walk(full)))
    else if (entry.isFile()) files.push(full)
  }
  return files
}

async function checkSkill() {
  const skillFile = path.join(SKILL, 'SKILL.md')
  assert.ok(await exists(skillFile), 'skills/shipping-github/SKILL.md must exist')
  const source = await readFile(skillFile, 'utf8')
  const meta = parseFrontmatter(source)
  assert.equal(meta.name, 'shipping-github', 'SKILL.md frontmatter name must be shipping-github')
  assert.ok(meta.description && meta.description.length <= 1024, 'description is required and <= 1024 chars')
  assert.ok(meta.description.includes('Git'), 'description should mention Git')

  for (const relative of EXPECTED) {
    assert.ok(await exists(path.join(SKILL, relative)), `missing skill file: ${relative}`)
  }
}

async function checkLinks() {
  const files = await walk(SKILL)
  for (const file of files) {
    if (!file.endsWith('.md')) continue
    const source = await readFile(file, 'utf8')
    const links = [...source.matchAll(/\]\(([^)]+)\)/g)].map((match) => match[1].trim())
    for (const link of links) {
      if (!link || link.startsWith('#') || /^[a-z][a-z0-9+.-]*:/i.test(link)) continue
      const target = link.split('#')[0]
      if (!target) continue
      const resolved = path.resolve(path.dirname(file), target)
      assert.ok(
        resolved === SKILL || resolved.startsWith(SKILL + path.sep),
        `link escapes skill directory: ${file} -> ${link}`,
      )
      assert.ok(await exists(resolved), `broken link: ${file} -> ${link}`)
    }
  }
}

async function checkTemplates() {
  for (const relative of TEMPLATES) {
    assert.ok(await exists(path.join(ROOT, relative)), `missing template: ${relative}`)
  }
}

async function checkForbidden() {
  const files = [...(await walk(SKILL)), ...(await walk(path.join(ROOT, 'templates')))]
  for (const file of files) {
    const source = await readFile(file, 'utf8')
    for (const { pattern, label } of FORBIDDEN) {
      if (pattern.test(source)) {
        assert.fail(`${label} found in ${path.relative(ROOT, file)}`)
      }
    }
  }
}

async function checkFrontmatterLinks() {
  const skillFile = path.join(SKILL, 'SKILL.md')
  const source = await readFile(skillFile, 'utf8')
  for (const match of source.matchAll(/`(steps\/[^`]+|references\/[^`]+|knowledge\/[^`]+)`/g)) {
    assert.ok(await exists(path.join(SKILL, match[1])), `SKILL.md references missing file: ${match[1]}`)
  }
}

async function checkPackaging() {
  const pkg = JSON.parse(await readFile(path.join(ROOT, 'package.json'), 'utf8'))
  assert.equal(pkg.name, '@chengzhao-dev/dsh-git-workflow', 'package name must be scoped')
  assert.equal(pkg.publishConfig?.access, 'public', 'publishConfig.access must be public')
  assert.equal(pkg.publishConfig?.provenance, true, 'publishConfig.provenance must be true')
  assert.equal(pkg.dsh?.catalog?.category, 'skill', 'dsh.catalog.category must be skill')
  assert.deepEqual(pkg.dsh?.catalog?.capabilities, ['skills', 'tools'], 'catalog capabilities must be skills/tools')
  assert.equal(pkg.dsh?.bundle?.patch, './cordis.patch.yml', 'bundle patch must point at cordis.patch.yml')

  const files = pkg.files ?? []
  for (const required of ['lib', 'skills', 'templates', 'cordis.patch.yml', 'locale', 'README.md', 'README.en.md', 'LICENSE']) {
    assert.ok(files.includes(required), `package.json files must include ${required}`)
  }
  for (const excluded of ['docs', 'tests', 'scripts', 'src']) {
    assert.ok(!files.includes(excluded), `package.json files must not include ${excluded}`)
  }

  const lock = JSON.parse(await readFile(path.join(ROOT, 'package-lock.json'), 'utf8'))
  assert.equal(lock.name, pkg.name, 'package-lock top name must match package.json')
  assert.equal(lock.packages?.['']?.name, pkg.name, 'package-lock root package name must match')
  assert.equal(lock.packages?.['']?.version, pkg.version, 'package-lock root version must match')

  const patch = await readFile(path.join(ROOT, 'cordis.patch.yml'), 'utf8')
  assert.ok(patch.includes(`name: '${pkg.name}'`), 'cordis.patch.yml must load the scoped package name')

  for (const relative of ['README.md', 'README.en.md']) {
    const readme = await readFile(path.join(ROOT, relative), 'utf8')
    assert.ok(
      readme.includes(`npm:${pkg.name}@${pkg.version}`),
      `${relative} must show npm:${pkg.name}@${pkg.version}`,
    )
  }

  for (const relative of ['locale/zh.json', 'locale/en.json']) {
    const locale = JSON.parse(await readFile(path.join(ROOT, relative), 'utf8'))
    assert.ok(locale.meta?.title && locale.meta?.description, `${relative} needs meta.title/description`)
  }

  assert.ok(await exists(path.join(ROOT, 'lib', 'index.js')), 'lib/index.js must exist; run npm run build')
}

async function main() {
  await checkSkill()
  await checkLinks()
  await checkTemplates()
  await checkForbidden()
  await checkFrontmatterLinks()
  await checkPackaging()
  console.log('skill links and metadata: ok')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
