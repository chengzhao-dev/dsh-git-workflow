# git 内容迁移计划：cpp-notes / cpp-board-games → dsh-git-workflow

> 历史记录：本文描述 2026-10 的迁移过程，不是当前结构说明。当前布局以根 README、`docs/plugin-layout.md` 与 `skills/shipping-github/steps/` 为准。文中 `scripts/checking-commit-identity.mjs` 现状位于 `skills/shipping-github/scripts/checking-commit-identity.mjs`，包作用域为 `@chengzhao-dev/dsh-git-workflow`。


## 1. 目标与边界

### 目标

1. 把 `D:\Github\cpp-notes`（下称 notes）与 `D:\Github\cpp-board-games`（下称 board）里所有**面向 agent 的 git / GitHub / 发布内容**收进 `D:\Github\dsh-git-workflow`，做成可安装的 DSH 插件。
2. 让插件提供唯一的 `shipping-github` 技能入口；两个仓库删除本地副本，只保留指向插件的引用。
3. 把只属于某一个仓库的运行配置（workflow YAML、页面部署目录、CI 复合动作）留在原仓，但把可复用的规则、模板、事故复盘迁到插件。
4. 迁移后两仓的所有检查命令仍能通过：不留下断链、失效的 `kb_id`、指向已删路径的断言或评测条目。
5. 本次只改工作区，**不 commit、不 push、不建 PR**。

### 不在范围内

- 不改 GitHub 仓库设置、Pages 源、branch protection、secrets。
- 不重写两仓的构建系统或 Quarto 内容。
- 不把两仓的 `_book/`、`temp/`、`build/` 产物搬进插件。
- 不把插件发布到 npm；只保证 `npm pack --dry-run` 与本地检查通过。

### 迁移判定规则

一个文件进入插件，当且仅当满足以下任一条件：

- 它描述**跨仓库可复用的 git/GitHub 流程**（提交、推送、PR/Issue、CI、Pages、发布闸门、仓库卫生）。
- 它是上述流程的**事故复盘或知识依据**。
- 它是可复用的**模板**（`.gitattributes`、`.gitignore`、CONTRIBUTING、Pages workflow 范式）。

一个文件留在原仓，当且仅当：

- 它绑定该仓的目录、构建入口、部署 URL、Quarto 配置或 CI 复合动作，换仓即失效。
- 它是该仓的项目事实（章节结构、游戏目录、风格冻结项），不属于 git 知识。

## 2. 现状清单

### 2.1 待迁移文件

| 来源 | 文件 | 去向 |
| --- | --- | --- |
| notes | `.agents/skills/shipping-github/SKILL.md` | `skills/shipping-github/SKILL.md`（与 board 版合并） |
| notes | `.agents/skills/shipping-github/references/git-workflow.md` | `skills/shipping-github/references/git-workflow.md`（合并） |
| notes | `.agents/skills/shipping-github/references/ci.md` | `skills/shipping-github/references/ci.md`（合并） |
| notes | `.agents/skills/shipping-github/references/github-pages.md` | `skills/shipping-github/references/github-pages.md` |
| notes | `.agents/knowledge/repo-github/hygiene/repository-hygiene.md` | `skills/shipping-github/knowledge/repository-hygiene.md` |
| notes | `.agents/knowledge/repo-github/publishing/github-pages-deployment.md` | `skills/shipping-github/knowledge/pages-deployment.md` |
| notes | `.agents/incidents/github/*.md`（2 个） | `skills/shipping-github/knowledge/incidents/`（去项目化合并） |
| notes | `.gitattributes`、`.gitignore` | `templates/repository/gitattributes.template`、`gitignore.template`（原仓保留运行副本） |
| notes | `.github/workflows/pages.yml`、`render-check.yml` | `templates/github-pages/pages.yml.template`、`render-check.yml.template`（范式，原仓保留） |
| board | `.agents/skills/shipping-github/SKILL.md` | 合并进插件 SKILL |
| board | `.agents/skills/shipping-github/references/git-workflow.md` | 合并进插件 git-workflow |
| board | `.agents/skills/shipping-github/references/ci.md` | 合并进插件 ci |
| board | `.agents/skills/shipping-github/references/github-pages.md` | 合并进插件 github-pages |
| board | `.agents/skills/shipping-github/references/publish-gate.md` | `skills/shipping-github/references/publish-gate.md`（generic 化） |
| board | `.agents/knowledge/repo-github/publish-surface.md` | 拆两半：git 划界进 `knowledge/publish-surface.md`；项目风格/目录/技能形态/书形进 `.agents/knowledge/agent-workspace/planning/project-decisions/publish-surface.md`（沿用 `bg-publish-surface-v1`） |
| board | `.agents/incidents/repo-github/*.md`（2 个） | 合并进 `skills/shipping-github/knowledge/incidents/`（去项目化） |
| board | 根 `.gitattributes`、`.gitignore`、`.editorconfig`、`CONTRIBUTING.md` | 仅取通用规则做模板；原文件保留 |
| board | `.github/actions/ci-prepare/action.yml`、两个 workflow | 通用 CI 规则进 `references/ci.md`；准备动作范式进 `templates/github-pages/ci-prepare.action.yml.template`；运行配置保留 |
| 两仓 | `.github/README.md` | 通用说明迁插件，原仓保留仓库 CI 索引 |

### 2.2 两仓需要删除/改写的引用

| 仓库 | 位置 | 处理 |
| --- | --- | --- |
| notes | `.agents/skills/shipping-github/**` | 删除 |
| notes | `.agents/knowledge/repo-github/**` | 删除 |
| notes | `.agents/incidents/github/**` | 删除 |
| notes | `.agents/incidents/INDEX.md` | 删 github 两行 |
| notes | `.agents/README.md` | 技能表改指插件；知识目录删 repo-github |
| notes | `.agents/knowledge/KNOWLEDGE.md` | 删 repo-github 目录树，改为插件说明 |
| notes | `.agents/knowledge/agent-workspace/context/codex-context-compaction.md:8` | 去掉 `cpp-tooling-repo-hygiene-v1` 依赖 |
| notes | `.agents/knowledge/agent-workspace/navigation/host-planning-delivery.md:8,43` | 去掉依赖；依据改指插件知识 |
| notes | `.agents/skills/governing-agents/references/catalog.md:20,34` | 删项目内 shipping 行；加插件来源 |
| notes | `.agents/skills/governing-agents/references/structure.md:83,91` | repo-github 标为已迁插件 |
| notes | `.agents/context/project.md`「公开面与发布」 | 保留 Pages 事实，出处改插件 |
| notes | `AGENTS.md` 第 6、9 条与结构表 | 命令/技能位置改插件 |
| notes | `.agents/skills/governing-agents/scripts/test_agent_controls.py:199,224` | 删本地 skill 断言，改查 AGENTS 指向插件 |
| notes | `.agents/skills/maintaining-python/scripts/eval_set.py:81-84` | 删 4 条 shipping 知识评测 |
| notes | `.github/README.md`、`.github/workflows/*.yml` | 通用段迁插件，注释改指插件 |
| board | `.agents/skills/shipping-github/**` | 删除 |
| board | `.agents/knowledge/repo-github/**` | 删除（内容拆到插件 + 新项目知识文件） |
| board | `.agents/incidents/repo-github/**` | 删除 |
| board | `.agents/incidents/INDEX.md` | 删 repo-github 两行 |
| board | `.agents/README.md` | 技能表改指插件 |
| board | `.agents/knowledge/KNOWLEDGE.md:34` | 改指 `agent-workspace/planning/project-decisions/publish-surface.md` + 插件 |
| board | `.agents/knowledge/agent-workspace/planning/project-decisions/publish-surface.md` | 新建，承接非 git 项目决策（沿用 `bg-publish-surface-v1`） |
| board | `.agents/skills/governing-agents/references/catalog.md:19` | 删 shipping 行，注明插件 |
| board | `.agents/skills/governing-agents/references/structure.md:91` | repo-github 标为已迁插件 |
| board | `.agents/context/project.md:58-59` | Pages 事实保留，出处改插件 + 新 kb_id |
| board | `AGENTS.md` 第 7 条、技能清单、结构表 | 改指插件 |
| board | `CONTRIBUTING.md` | CI 边界保留，git 身份规则改指插件 |
| board | `.agents/skills/governing-agents/scripts/testing-controls.py:87,110` | 删本地 skill 存在断言，改 AGENTS 指向插件 |
| board | `.agents/skills/maintaining-python/scripts/retrieval/listing-evals.py:123-133` | 删发布条目，其余改到新项目知识文件名/标题 |
| board | `.github/README.md`、workflows | 注释与说明指插件 |

## 3. 插件设计

### 3.1 形态

照 `dsh-cpp-workflow` 的插件契约：

- `package.json`：ESM，`main: ./lib/index.js`，`dsh.bundle.patch: ./cordis.patch.yml`，`peerDependencies` 含 `@deepseek-ai/dsh-skill`。
- `cordis.patch.yml`：additive insert，`id: git-workflow`、`name: dsh-git-workflow`。
- `src/index.ts`：注册一个技能 provider，技能名 `shipping-github`，rank 550。
- `src/workspace.ts`：只有当前工作目录位于任意 git checkout 内才列出技能（向上找 `.git`，最多 64 层；不扫描文件系统）。
- `lib/`：`tsc` 产物，`npm test` 前重新构建。
- `tests/`：workspace 门禁、frontmatter、路径逃逸、技能发现。
- `scripts/checking-skill-links.mjs`：校验技能内相对链接；另加“插件技能不得出现具体仓库名/本机路径”的静态检查。
- `scripts/checking-commit-identity.mjs`：通用化的提交身份门禁（作者、committer、禁用 trailer），来源是 board `.agents/skills/governing-agents/scripts/checking-identity.py`；项目仍保留各自接线脚本。

### 3.2 技能内容

```text
skills/shipping-github/
├── SKILL.md
├── references/
│   ├── git-workflow.md          # 提交、身份、推送、PR/Issue、禁止操作、恢复
│   ├── ci.md                    # Actions 权限、并发、固定版本、触发、排错
│   ├── github-pages.md          # 两种部署源、workflow 写法、读回验证、故障
│   ├── publish-gate.md          # 发布前固定顺序（generic）
│   └── repository-hygiene.md    # gitattributes/gitignore/分支/提交切分
├── knowledge/
│   ├── repository-hygiene.md    # 为什么这样定
│   ├── pages-deployment.md      # 为什么两种源不能混
│   ├── publish-surface.md       # 公开面划界的一般原则
│   └── incidents/
│       ├── INDEX.md
│       ├── desktop-publish-and-push-failure.md
│       └── pages-mojibake-and-source-drift.md
```

`SKILL.md` 只做四件事：硬边界、工序脊柱、按需路由、停止条件。具体命令放 `references/`，原因放 `knowledge/`，复盘放 `knowledge/incidents/`。

### 3.3 模板

```text
templates/
├── repository/
│   ├── gitattributes.template
│   ├── gitignore.template
│   ├── editorconfig.template
│   └── CONTRIBUTING.md
└── github-pages/
    ├── pages.yml.template
    ├── render-check.yml.template
    └── ci-prepare.action.yml.template
```

模板中的仓库名、URL、输出目录用 `<repo>`、`<owner>`、`<output-dir>` 占位；不写死 notes/board。

## 4. 执行顺序

1. 建插件骨架（package、tsconfig、cordis、locale、icon、README、LICENSE、根点文件）。
2. 写 `src/` 与测试，先让 workspace 门禁与 frontmatter 测试通过。
3. 合并两仓技能/知识/事故为插件内容；去项目化；补 `publish-gate` 与 `repository-hygiene`。
4. 从两仓 workflow/点文件提炼模板。
5. 两仓删除本地副本，逐处改写引用、索引、context、AGENTS、tests、eval。
6. 跑插件检查；跑两仓相关检查；对两仓做全量残留 grep。
7. 回填本计划的执行结果与校验记录。

## 5. 验收标准

### 插件

- `npm run check` 通过：`tsc`、链接检查、`node --test`。
- `node --test` 覆盖：非 git 目录不列技能；git 目录列一个；`getSkill` 拒绝逃逸路径；frontmatter 名称正确。
- `npm pack --dry-run` 包含 `lib`、`skills`、`templates`、`cordis.patch.yml`、`locale`。
- 技能内所有相对链接存在；无 `D:\`、`/Users/`、`cpp-notes`、`cpp-board-games`、`tictactoe` 等具体仓库痕迹。

### 两仓

- 不存在 `.agents/skills/shipping-github/`、`.agents/knowledge/repo-github/`、`.agents/incidents/github|repo-github/`。
- 全仓 grep `shipping-github|repo-github|publish-gate|git-workflow|github-pages` 只剩指向插件的说明，无文件路径引用。
- 无失效 `kb_id`：`cpp-tooling-repo-hygiene-v1`、`cpp-tooling-pages-deploy-v1` 不再被引用；board 的 `bg-publish-surface-v1` 只指向迁到 `agent-workspace/planning/project-decisions/` 的项目知识文件。
- notes：`test_agent_controls.py`、`eval_set.py`、`kb-check`/`kb-eval` 与 `check --profile knowledge` 通过。
- board：`testing-controls.py`、`listing-evals.py` 与 `check --profile knowledge` 通过。
- `git status` 只显示预期的删除/修改/新增；不产生 commit。

### 不做

- 不 `git add`、不 commit、不 push。
- 不删除两仓的 `.github/workflows`、`.gitattributes`、`.gitignore`、`.editorconfig`、`CONTRIBUTING.md` 运行副本。

## 6. 执行结果（2026-10-20）

### 插件

- `npm run check`：`tsc` 构建通过，`skill links and metadata: ok`，`node --test` 12/12 通过。
- `npm pack --dry-run`：31 个文件，包含 `lib/`、`skills/`、`templates/`、`scripts/`、`cordis.patch.yml`、`locale/`；`docs/` 是迁移记录，不进包。
- 技能目录内无 `cpp-notes`、`cpp-board-games`、`tictactoe`、本机绝对路径；模板与 README 只含占位符。
- 真实加载冒烟：`import { apply } from './lib/index.js'` 注册后，在仓库根 `list({cwd})` 返回 `shipping-github@550`，`get(candidate,{cwd})` 返回正文（约 2.6K 字符）。
- 提交身份脚本：`node scripts/checking-commit-identity.mjs --author chengzhao-dev` 通过；换一个作者名即退出码 1，证明比对生效。

### cpp-notes

- 已删除 `.agents/skills/shipping-github/`、`.agents/knowledge/repo-github/`、`.agents/incidents/github/`。
- `run.ps1 check --profile fast` 通过；`check --profile knowledge` 3 项通过；`check --profile full` 21 项已检查、跳过 1 项。
- 全仓 grep（排除 `.git`、`temp`、`_book`）只剩指向插件 `dsh-git-workflow` 的说明，以及 `naming.md` 中把 `shipping-github` 当作命名示例的两行。

### cpp-board-games

- 已删除 `.agents/skills/shipping-github/`、`.agents/knowledge/repo-github/`、`.agents/incidents/repo-github/`。
- `bg-publish-surface-v1` 的非 git 内容移到 `.agents/knowledge/agent-workspace/planning/project-decisions/publish-surface.md`，`domain` 改为 `agent-workspace`，ID 不变；GitHub 划界进插件 `knowledge/publish-surface.md`。
- `run.ps1 check --profile fast` 13 项通过；`check --profile python` 1 项通过；`check --profile knowledge` 3 项通过；`check --profile full` 17 项全通过。
- 全仓 grep（同样排除生成目录）只剩指向插件与 `bg-publish-surface-v1` 的说明。

### 未做的事

- 两仓与插件都没有 `git add`、commit、push；board 的旧 git 路径已从 index 移除（`git rm -r --cached`），移动后的项目知识文件仍是未跟踪状态，留给用户决定何时暂存。
- 未删除两仓运行所需的 `.github/workflows`、`.github/actions`、`.gitattributes`、`.gitignore`、`.editorconfig`、`CONTRIBUTING.md`。
- 项目侧仍保留：board `.agents/skills/governing-agents/scripts/checking-identity.py`（接线脚本，通用版已进插件 `scripts/checking-commit-identity.mjs`）、board `.agents/context/conventions/agent-workspace/` 的编码与仓库布局事实、notes `.agents/skills/governing-agents/assets/config/editorconfig`（脚手架资产，插件有同名模板）、两仓 `.agents/mcp` 的 git 只读工具与 `run.py status`。这些要么是项目事实，要么与项目路径绑定；通用规则与模板已进插件。
