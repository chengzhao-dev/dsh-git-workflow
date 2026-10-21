# 插件流程

## 加载

1. DSH 读取 `cordis.patch.yml`，按 scoped 包名 `@chengzhao-dev/dsh-git-workflow` 插入插件。
2. `src/index.ts` 导出 `name='dsh-git-workflow'` 与 `inject=['skills','tools']`。
3. `apply()` 注册 `shipping-github` 的 skill provider；如果宿主提供 `ctx.tools.register`，再注册 `git_commit_check` 与 `git_ship_report`。
4. `inject` 声明同时依赖 `skills` 与 `tools`，目标宿主两者都提供；`apply()` 仍对 `ctx.tools.register` 做防御性判断，避免类型或宿主差异导致注册抛错。

## 技能路由

技能 provider 的 `list()` 以会话 cwd 为输入：

1. `findGitRoot(cwd)` 向上找 `.git`，最多 64 层。
2. 找不到：返回空列表，技能不出现。
3. 找到：返回 `shipping-github` 候选，rank 550，来源 bundled。
4. `get()` 再次校验 cwd、候选 provider、技能名、locator 必须位于包内 `skills/`，防止路径逃逸。

技能被路由后，模型按 `SKILL.md` 的步骤路由读取文件：

- 步骤 1–3：读约束、定范围、跑项目门禁。
- 步骤 4：写信息并调用 `git_commit_check`（只传 `message`，不核对身份）。
- 步骤 5：显式暂存，`git commit -F`，再用 range 模式核对 author/committer。
- 步骤 6：push 后读回远端 SHA。
- 步骤 7：仅用户要求 PR/Issue 时。
- 步骤 8：仅用户要求发布/CI/Pages 时。
- 步骤 9：调用一次 `git_ship_report` 生成回执。

提交或推送至少走 1–6 并以 9 收尾；没有固定提交数量。

## 工具执行

### `git_commit_check`

- 入参：`message`（可选）、`author`、`range`、`all`、`require_chinese`、`extra_types`、`allowed_trailers`。
- 有 `message`：先确认 cwd 在 Git checkout 内，再按 `src/commit-rules.ts` 校验这条信息。
- 无 `message`：解析范围（显式 range → `@{upstream}..HEAD` → 默认分支 → `HEAD`），用 `git log` 读取最多 200 个提交，逐条校验并核对 author/committer。
- 输出：`{ pass, checked, report }`；report 是给人看的检查报告，不写文件。

### `git_ship_report`

- 入参是闭集：`mode`、`executed`、`branch`、`commits`、`remote`、`checks`、`unexecuted`。
- `mode=skipped` 时 `executed` 必须为 false；`checks` 四项必填，状态只能是 pass/fail/skip。
- 输出：`{ receipt }`，回执就是最终交付卡；工具不执行 git。

## 失败路径

- 非 Git 目录：`git_commit_check` 抛错，报告「需要 Git 工作树」，不运行 git。
- 提交信息不合规：返回 `pass=false` 与带行号的 issues；模型改信息，不绕过。
- 入参越界：工具直接抛错，不用默认值掩盖。
- 身份无法核对：技能停止并报告，绝不从 `git config` 猜测。
