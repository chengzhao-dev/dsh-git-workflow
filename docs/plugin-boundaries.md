# 插件边界

本插件只做两件事：在 Git checkout 内提供一个交付技能，并提供两个只读检查工具。它不代管仓库，也不替项目做发布决定。

## 技能可见性

- `shipping-github` 只在当前工作目录位于 Git checkout 内时出现在技能列表。判断方式是向上查找 `.git` 目录或 worktree 的 `.git` 文件，最多 64 层。
- 不在 Git 仓库内时技能不出现；这是为了避免在普通目录误触发提交或发布流程。
- 技能出现不等于获准执行：默认只读，提交、推送、PR、发布都需要用户明确要求。

## 工具边界

- `git_commit_check` 与 `git_ship_report` 在插件 `apply()` 时注册，因此在所有工作区可见。这样做是为了不依赖技能是否被路由到。
- 可见不等于可执行。`git_commit_check` 在执行时重新确认 cwd 位于 Git checkout 内；非 Git 目录直接失败，且不运行任何 git 命令。
- `git_commit_check` 只读 `git log` 检查提交信息，不写文件、不暂存、不提交、不推送，也不改 `git config`。
- `git_ship_report` 只校验入参并渲染回执，不执行 git、不访问网络、不写文件。
- 两个工具都拒绝未知字段和闭集外的值；`git_ship_report` 的 `mode`、`checks` 状态、`executed` 组合都有校验。

## 身份

- 维护者身份只从项目的 `AGENTS.md`、`CONTRIBUTING.md` 等声明读取，不从 `git config` 或历史提交猜测。
- 项目没有声明维护者时，技能停在提交前，报告「无法核对」。
- 默认禁止 `Co-authored-by`、`Signed-off-by` 与 Cursor 相关标记；项目明文要求 DCO 等 trailer 时，才通过 `allowed_trailers` 放行对应 token。

## 提交范围

- 默认检查下一次 push 会发布的范围：优先 `@{upstream}..HEAD`，没有 upstream 时相对项目默认分支。
- 只有调用方显式传 `all: true` 才检查全部可达历史；README 与技能都不把「全部历史」当默认。
- 这不是提交权限，只是检查范围；检查通过仍需用户明确要求才提交。

## 包边界

- npm 包包含 `lib/`、`skills/`、`templates/`、`cordis.patch.yml`、`locale/`、图标、两份 README 与 LICENSE。
- `docs/`、`tests/`、仓库级 `scripts/` 不进入 npm 包；技能内的 `skills/shipping-github/scripts/` 随包发布。
- `lib/` 是构建产物但必须提交，保证从 Git 标签安装时无需构建。
