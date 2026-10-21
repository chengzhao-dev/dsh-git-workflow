# dsh-git-workflow

[中文](README.md)

Git and GitHub delivery tooling for DeepSeek Harness. The package provides one skill and two read-only tools:

- `shipping-github`: a nine-step delivery procedure covering message and identity checks, explicit staging, push verification, PR/Issue, Actions, Pages release gates, and repository hygiene. Read-only by default; commits and remote actions happen only on an explicit user request.
- `git_commit_check`: validates one commit message or a commit range with a read-only `git log`; it never stages, commits, pushes, or writes files.
- `git_ship_report`: renders one closed-set delivery receipt. It does not execute Git.

It does not manage repositories or make release decisions for a project. The skill appears only when the current working directory is inside a Git checkout; project `AGENTS.md`, check scripts, and CI configuration still take precedence.

## What it provides

| Item | Description |
| --- | --- |
| `shipping-github` skill | Single skill entry point; no commit/push by default, only on explicit request |
| Commit rules | Official Conventional Commits structure plus plugin extensions; 11 types, Chinese description, `-F` commits |
| Commit check | `git_commit_check` validates one message or a range; default is the next-push range, not all history |
| Delivery receipt | `git_ship_report` reports mode, branch, commits, remote SHA, four checks, and unexecuted items |
| Identity rules | author/committer must be the maintainer declared by the project; no third-party `Co-authored-by` trailers |
| Repository hygiene | `.gitattributes` / `.gitignore` / `.editorconfig`, line-ending normalization, ignore rules, branch protection |
| CI rules | Least privilege, queued deployments, pinned action versions, log-based troubleshooting |
| Pages release | Two deployment sources, artifact branches, read-back verification, drift handling |
| Release gate | Pre-render checks → render → artifact smoke → publish → live read-back |
| Templates | Repository dotfiles, CONTRIBUTING, Pages workflow patterns |
| Knowledge and incidents | Rationale and real failure cases with verification steps |

## Install

```bash
dsh plugin --profile web add npm:@chengzhao-dev/dsh-git-workflow@0.1.0
```

Replace `--profile` with the profile actually in use. The desktop app runs a `desktop` profile that it manages as its own; try `dsh plugin --profile desktop add npm:@chengzhao-dev/dsh-git-workflow@0.1.0` first, and if the app rejects the write, use Settings → Plugins → Add plugin with `npm:@chengzhao-dev/dsh-git-workflow@0.1.0`. A GitHub tag also works: `github:chengzhao-dev/dsh-git-workflow#v0.1.0`, but pin a commit or tag and make sure `lib/` is committed.

## Workspace gate and tool boundaries

The skill provider returns candidates only when the current working directory is inside a Git checkout:

- Walk up from cwd looking for `.git` (directory or worktree `.git` file), at most 64 levels.
- No filesystem scanning; no dependence on project name, language, or layout.
- Outside a Git repository the skill is not listed, so commit/release flows cannot be triggered accidentally.

Both tools are registered at `apply()`, so they are visible in every workspace. Visibility is not permission: at execution `git_commit_check` re-confirms the cwd is inside a Git checkout, fails outside one, and runs no Git command in that case. The tools never write files, stage, commit, or push.

The default check range is what the next push would publish: `@{upstream}..HEAD` when an upstream exists, otherwise the range relative to the project default branch. All reachable history is inspected only when the caller explicitly passes `all: true`.

## Skill layout

```text
skills/shipping-github/
├── SKILL.md                     # entry: hard boundaries, step routing, stop conditions
├── steps/
│   ├── 01-read-constraints.md   # read project rules and declared identity
│   ├── 02-define-scope.md       # define commit/push scope
│   ├── 03-project-gate.md       # run the project gate
│   ├── 04-write-message.md      # write the message and call git_commit_check
│   ├── 05-stage-and-commit.md   # explicit staging, commit with -F
│   ├── 06-push-and-verify.md    # push and verify the remote SHA
│   ├── 07-pr-and-issue.md       # only when asked: PR/Issue
│   ├── 08-release-gate.md       # only when asked: release/CI/Pages
│   └── 09-ship-report.md        # close with git_ship_report
├── references/
│   ├── git-workflow.md          # Git commands, rollback, failure recovery
│   ├── ci.md                    # Actions permissions, concurrency, pinning, debugging
│   ├── github-pages.md          # deployment sources, workflows, read-back, failures
│   ├── publish-gate.md          # fixed pre-release sequence
│   └── repository-hygiene.md    # dotfiles, ignores, branches, commit splitting
├── knowledge/
│   ├── repository-hygiene.md    # why the hygiene rules exist
│   ├── pages-deployment.md      # why deployment sources and artifact branches work this way
│   ├── publish-surface.md       # general public-surface boundaries
│   └── incidents/               # real incident reviews and index
└── scripts/
    └── checking-commit-identity.mjs  # thin CLI over the compiled rules
```

`SKILL.md` keeps only the hard constraints and routing. A commit or push follows steps 1–6 and closes with step 9; steps 7 and 8 run only when the user explicitly asks for a PR/Issue or a release.

## Templates

Files under `templates/` are patterns, not auto-copied:

- `repository/gitattributes.template`, `gitignore.template`, `editorconfig.template`: copy to the project root and drop the `.template` suffix (`.gitignore` cannot be shipped under its real name in an npm package).
- `repository/CONTRIBUTING.md`: contribution flow, 11 commit types, and commit identity checks.
- `github-pages/pages.yml.template`, `render-check.yml.template`: replace `<setup-command>`, `<check-command>`, `<render-command>`, and `<output-dir>` with project values.
- `github-pages/ci-prepare.action.yml.template`: a composite action that derives versions and cache keys from project config; copy to `.github/actions/ci-prepare/action.yml` and replace the placeholders.

Templates contain no repository names, URLs, or output directories. Read the existing project configuration before applying them; do not overwrite blindly.

## Relationship to project rules

Priority: explicit user instruction > project `AGENTS.md` / contribution guide > this skill.

- If the project has release scripts, use the project commands; the skill only supplies sequence and checks.
- The project's CI, Pages source, and branch protection are project facts. The skill neither changes nor assumes them.
- Commit identity comes only from project documentation. If the project declares no maintainer, report that identity cannot be verified and stop; never guess from `git config`.
- On a rule conflict, stop and explain; do not silently pick a side.

## Development

```bash
npm install
npm run build      # tsc -> lib/
npm test           # build + node --test tests/*.test.mjs
npm run check      # tsc --noEmit + link/metadata/package-identity checks
npm run pack:check # npm pack --dry-run
```

Requires Node.js >= 22 and DSH >= 0.2.0-rc.1.

The identity script lives under the skill. It checks the next-push range by default and only scans all history with an explicit `--all`:

```bash
node skills/shipping-github/scripts/checking-commit-identity.mjs --author "Maintainer Name <maintainer@example.com>"
```

The script calls the compiled `lib/commit-rules.js` and `lib/tools/commit-check.js`; run `npm run build` first.

## Repository layout

```text
.
├── src/                 # TypeScript source (provider, two tools, commit rules)
├── lib/                 # tsc output (published)
├── skills/              # skill content (steps, references, knowledge, script)
├── templates/           # repository and Pages templates
├── tests/               # rule, tool, and provider behavior tests
├── scripts/             # repository link/metadata checks (not published)
├── docs/                # plugin boundaries, flow, layout, versioning, migration (not published)
├── cordis.patch.yml     # DSH plugin registration
├── locale/              # plugin metadata (zh/en)
└── icon.svg
```

## License

MIT. See [LICENSE](LICENSE).
