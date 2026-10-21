#!/usr/bin/env node
// Thin CLI over the compiled commit checker. The rules live in
// `lib/commit-rules.js`; this wrapper only parses flags and sets an exit code.
//
//   node skills/shipping-github/scripts/checking-commit-identity.mjs \
//     --author "Alice <alice@example.com>" [--range <range>] [--repo <path>]
//
// Default range is the range the next push would publish (upstream..HEAD, or
// the project default branch..HEAD), never the whole repository history.
import { runCommitCheck } from '../../../lib/tools/commit-check.js'

const USAGE = `usage: node skills/shipping-github/scripts/checking-commit-identity.mjs --author <name> [options]

  --author <name>      expected author/committer, e.g. "Alice <alice@example.com>"
  --range <range>      git revision range; defaults to the next-push range
  --all                explicitly check the whole reachable history
  --repo <path>        repository path; defaults to the current directory
  --no-chinese         disable the Chinese-description project rule
  --help               show this help

Exit codes: 0 all checks pass, 1 check failed, 2 usage or environment error.`

function parseArgs(argv) {
  const options = { requireChinese: true }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--help' || arg === '-h') return { help: true }
    if (arg === '--all') {
      options.all = true
      continue
    }
    if (arg === '--no-chinese') {
      options.requireChinese = false
      continue
    }
    if (arg === '--author' || arg === '--range' || arg === '--repo') {
      const value = argv[index + 1]
      if (typeof value !== 'string' || value.trim() === '' || value.startsWith('--')) {
        throw new Error(`${arg} 需要一个值。`)
      }
      options[arg.slice(2)] = value.trim()
      index += 1
      continue
    }
    throw new Error(`未知参数：${arg}`)
  }
  if (!options.author) throw new Error('缺少 --author：身份规则不能从 git config 猜测。')
  if (options.all && options.range) throw new Error('--all 与 --range 不能同时使用。')
  return options
}

async function main() {
  let options
  try {
    options = parseArgs(process.argv.slice(2))
  } catch (error) {
    console.error(`checking-commit-identity: ${error.message}\n\n${USAGE}`)
    return 2
  }
  if (options.help) {
    console.log(USAGE)
    return 0
  }

  try {
    const result = await runCommitCheck({
      root: options.repo ?? process.cwd(),
      author: options.author,
      range: options.range,
      all: options.all === true,
      requireChinese: options.requireChinese,
    })
    console.log(result.report)
    return result.pass ? 0 : 1
  } catch (error) {
    console.error(`checking-commit-identity: ${error instanceof Error ? error.message : String(error)}`)
    return 2
  }
}

process.exitCode = await main()
