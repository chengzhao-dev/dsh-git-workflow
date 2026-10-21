# dsh-git-workflow

[English](README.en.md)

给 DeepSeek Harness 的 Git / GitHub 交付技能包。安装后提供一个技能 `shipping-github` 和两个只读工具：

- `shipping-github`：九步交付工序，覆盖提交信息与身份校验、显式暂存、push 读回、PR/Issue、Actions、Pages 发布闸门与仓库卫生。默认只读，用户明确要求才执行提交或远端动作。
- `git_commit_check`：检查一条提交信息，或检查一段提交范围；只读 `git log`，不写文件、不暂存、不提交。
- `git_ship_report`：把一次交付收敛成闭集回执；只渲染结果，不执行 git。

它不代管仓库，也不替项目做发布决定。技能只在当前工作目录位于任意 Git checkout 内时出现；进入项目后仍以项目自己的 `AGENTS.md`、检查脚本和 CI 配置为准。

## 提供什么

| 内容 | 说明 |
| --- | --- |
| `shipping-github` 技能 | 唯一技能入口；默认不 commit/push，只在用户明确要求时执行 |
| 提交规范 | Conventional Commits 官方结构 + 插件扩展；11 种类型、中文描述、`-F` 提交 |
| 提交检查 | `git_commit_check` 校验单条信息或提交范围；默认检查下一次 push 的范围，不是全部历史 |
| 交付回执 | `git_ship_report` 输出模式、分支、提交、远端 SHA、四项检查与未做项 |
| 身份约束 | author/committer 只用项目声明的维护者身份；禁止 `Co-authored-by` 等第三方 trailer |
| 仓库卫生 | `.gitattributes` / `.gitignore` / `.editorconfig`、行尾归一化、忽略规则、分支保护 |
| CI 规则 | 最小权限、并发排队、固定 action 版本、日志排错 |
| Pages 发布 | 两种部署源、产物分支、读回验证、配置漂移处置 |
| 发布闸门 | 渲染前检查 → 渲染 → 产物 smoke → 发布 → 线上读回 |
| 模板 | 仓库点文件、CONTRIBUTING、Pages workflow 范式 |
| 知识依据与事故 | 为什么这样定、真实失败案例与验证方法 |

## 安装

```bash
dsh plugin --profile web add npm:@chengzhao-dev/dsh-git-workflow@0.1.0
```

`--profile` 换成实际运行的 profile。桌面应用固定跑 `desktop` profile，且该 profile 由应用独占管理；可先试 `dsh plugin --profile desktop add npm:@chengzhao-dev/dsh-git-workflow@0.1.0`，如果应用拒绝写入，再走「设置 → 插件 → 添加插件」，地址填 `npm:@chengzhao-dev/dsh-git-workflow@0.1.0`。跟 GitHub 标签也可以写 `github:chengzhao-dev/dsh-git-workflow#v0.1.0`，但要锁定 commit 或 tag，并确认 `lib/` 已在仓库里。

## 工作区门禁与工具边界

技能 provider 只在当前工作目录位于 Git checkout 内时返回候选：

- 从 cwd 向上查找 `.git`（目录或 worktree 的 `.git` 文件），最多 64 层。
- 不扫描文件系统，不依赖项目名、语言或目录结构。
- 不在 Git 仓库内时，技能不出现在列表里；避免在任意目录误触发提交/发布流程。

两个工具在插件 `apply()` 时注册，因此在所有工作区可见；这是为了不依赖技能是否被路由。**可见不等于可执行**：`git_commit_check` 在执行时重新确认 cwd 在 Git checkout 内，非 Git 目录直接失败，且不会运行任何 git 命令。工具不写文件、不暂存、不提交、不推送。

提交检查的默认范围是下一次 push 会发布的范围：优先 `@{upstream}..HEAD`；没有 upstream 时相对项目默认分支。只有调用方显式传 `all: true` 才检查全部可达历史。

## 技能结构

```text
skills/shipping-github/
├── SKILL.md                     # 入口：硬边界、步骤路由、停止条件、完成判据
├── steps/
│   ├── 01-read-constraints.md   # 读项目约束与声明身份
│   ├── 02-define-scope.md       # 定提交/推送范围
│   ├── 03-project-gate.md       # 跑项目门禁
│   ├── 04-write-message.md      # 写提交信息并调用 git_commit_check
│   ├── 05-stage-and-commit.md   # 显式暂存并用 -F 提交
│   ├── 06-push-and-verify.md    # 推送并读回远端 SHA
│   ├── 07-pr-and-issue.md       # 仅按需：PR/Issue
│   ├── 08-release-gate.md       # 仅按需：发布/CI/Pages
│   └── 09-ship-report.md        # 用 git_ship_report 收尾
├── references/
│   ├── git-workflow.md          # git 命令、回滚、失败恢复
│   ├── ci.md                    # Actions 权限、并发、固定版本、排错
│   ├── github-pages.md          # 部署源、workflow、读回、故障
│   ├── publish-gate.md          # 发布前固定顺序
│   └── repository-hygiene.md    # 点文件、忽略、分支、提交切分
├── knowledge/
│   ├── repository-hygiene.md    # 卫生规则的依据
│   ├── pages-deployment.md      # 部署方式与产物分支的依据
│   ├── publish-surface.md       # 公开面划界的一般原则
│   └── incidents/               # 真实事故复盘与索引
└── scripts/
    └── checking-commit-identity.mjs  # 薄 CLI，复用编译后的规则
```

`SKILL.md` 只保留必须常驻的硬约束与路由；提交或推送至少走步骤 1–6 并以 9 收尾，步骤 7/8 只在用户明确要求 PR/Issue 或发布时使用。

## 模板

`templates/` 里的文件是范式，不是自动复制：

- `repository/gitattributes.template`、`gitignore.template`、`editorconfig.template`：复制到项目根后去掉 `.template` 后缀（`.gitignore` 在 npm 包内不能以原名发布）。
- `repository/CONTRIBUTING.md`：贡献流程、11 种提交类型与提交身份检查。
- `github-pages/pages.yml.template`、`render-check.yml.template`：把 `<setup-command>`、`<check-command>`、`<render-command>`、`<output-dir>` 换成项目实际值。
- `github-pages/ci-prepare.action.yml.template`：版本与缓存键从项目配置派生的复合动作范式；复制到 `.github/actions/ci-prepare/action.yml` 后替换占位符。

模板不写死仓库名、URL 或输出目录；使用前先读项目现有配置，不要直接覆盖。

## 与项目规则的关系

优先级：用户明确指令 > 项目 `AGENTS.md` / 贡献指南 > 本技能。

- 项目已有发布脚本时，用项目的命令；本技能只提供顺序与检查项。
- 项目的 CI、Pages 源、分支保护是项目事实，技能不修改，也不假设。
- 提交身份只从项目文档读取；项目没有声明维护者时报告「无法核对」并停止，不从 `git config` 猜测。
- 发现规则冲突时先停下说明，不静默选一边。

## 本地开发

```bash
npm install
npm run build      # tsc -> lib/
npm test           # build + node --test tests/*.test.mjs
npm run check      # tsc --noEmit + 链接/元数据/包身份检查
npm run pack:check # npm pack --dry-run
```

要求 Node.js >= 22、DSH >= 0.2.0-rc.1。

提交身份脚本位于技能目录，默认检查下一次 push 的范围（显式 `--all` 才检查全部历史）：

```bash
node skills/shipping-github/scripts/checking-commit-identity.mjs --author "Maintainer Name <maintainer@example.com>"
```

脚本调用编译后的 `lib/commit-rules.js` 与 `lib/tools/commit-check.js`，先 `npm run build` 再运行。

## 仓库结构

```text
.
├── src/                 # TypeScript 源码（provider + 两个工具 + 提交规则）
├── lib/                 # tsc 产物（随包发布）
├── skills/              # 技能内容（步骤、参考、知识、脚本）
├── templates/           # 仓库与 Pages 模板
├── tests/               # 规则、工具与 provider 行为测试
├── scripts/             # 仓库自身的链接/元数据检查（不进 npm 包）
├── docs/                # 插件边界、流程、布局与版本约定（不进 npm 包）
├── cordis.patch.yml     # DSH 插件注册
├── locale/              # 中英文插件元数据
└── icon.svg
```

## 许可

MIT。见 [LICENSE](LICENSE)。
