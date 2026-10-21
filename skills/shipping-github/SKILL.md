---
name: shipping-github
description: 用 Git 与 GitHub 交付仓库改动：提交身份与提交信息校验、显式暂存、push 读回、PR/Issue、Actions、Pages 发布闸门与仓库卫生。用户明确要求提交、推送、建 PR、配置或排查 CI、发布 Pages、处理 git 行尾/忽略规则时使用；只改代码或写文档、没有交付要求时不使用。
metadata:
  short-description: Git 提交、CI 与 Pages 发布
---

# Skill: shipping-github

把工作区改动交付成远端可见结果。**默认只读**：提交、推送、建 PR、发布和其他远端修改，都必须由用户明确要求。本文件只做入口、边界与路由；具体动作在 `steps/`，命令细节在 `references/`。

## P0 硬边界

1. **默认不 commit、不 push、不建 PR、不改远端。** 只有用户明确要求才执行；范围只覆盖用户点名的路径组与目标分支。
2. **只 `git add` 显式路径。** 禁止 `git add -A`、`git add .`；暂存后用 `git diff --cached --stat` 与 `--check` 核对。
3. **不改写已推送历史。** 不用 `rebase -i`、`push --force`；刚失败且未推送的提交可 `git commit --amend`，未推送分支为跟上远端可做普通 rebase。不跳过 hooks，不改 `git config`。
4. **提交身份只有项目声明的维护者。** author 与 committer 都必须是声明身份；`Co-authored-by`、`Signed-off-by` 等第三方 trailer 默认禁止，项目明文要求时走 `allowed_trailers`。身份只从项目文档读取，绝不从 `git config` 猜测。
5. **远端只维护必要分支。** 源码分支加必要的产物分支；产物分支只由自动化写入。不为临时工作推远端分支。
6. **文本 LF、UTF-8 无 BOM。** 忽略与属性规则集中在仓库根；不把构建产物、缓存、本机配置或密钥写进版本库。

## 提交契约（摘要）

- 结构：`<type>[(<scope>)][!]: <description>`，冒号必须是英文半角且后跟一个空格；`!` 紧贴冒号。
- `type` 取 `feat`、`fix`、`build`、`chore`、`ci`、`docs`、`style`、`refactor`、`perf`、`test`、`revert` 之一；一次提交只用一个类型。
- 描述默认要求至少一个汉字、不超过 50 个字符、结尾不加句号；技术专名可保留英文。
- 可选正文与 footer 各用**一个空行**分隔；`BREAKING CHANGE` / `BREAKING-CHANGE` 必须全大写。
- 提交前调用 `git_commit_check` 检查完整信息；检查通过才允许 `git commit -F`。检查失败就改，不绕过。

## 步骤路由

按顺序执行用户要求的动作；提交或推送至少走 1–6，并以 9 收尾。不要一次读完所有步骤。

| 步骤 | 何时读 | 文件 |
| --- | --- | --- |
| 1 | 任何交付动作开始 | `steps/01-read-constraints.md` |
| 2 | 确定提交/推送范围 | `steps/02-define-scope.md` |
| 3 | 提交前跑项目门禁 | `steps/03-project-gate.md` |
| 4 | 写提交信息并调用检查 | `steps/04-write-message.md` |
| 5 | 显式暂存并提交 | `steps/05-stage-and-commit.md` |
| 6 | 推送并核对远端 SHA | `steps/06-push-and-verify.md` |
| 7 | 仅当用户要求 PR/Issue 且远端是 GitHub | `steps/07-pr-and-issue.md` |
| 8 | 仅当用户要求发布/CI/Pages | `steps/08-release-gate.md` |
| 9 | 每次交付结束 | `steps/09-ship-report.md` |

## 参考与知识

| 内容 | 位置 |
| --- | --- |
| git 命令细节、回滚、失败恢复 | `references/git-workflow.md` |
| Actions 权限、并发、版本固定、排错 | `references/ci.md` |
| Pages 部署模式、workflow、发布后读回 | `references/github-pages.md` |
| 发布前固定验收顺序 | `references/publish-gate.md` |
| `.gitattributes` / `.gitignore` / 分支 / 提交切分 | `references/repository-hygiene.md` |
| 取舍与失效模式 | `knowledge/repository-hygiene.md`、`knowledge/pages-deployment.md`、`knowledge/publish-surface.md` |
| 真实故障复盘 | `knowledge/incidents/INDEX.md` |

## 停止条件

出现以下任一情况，停止并报告，不自行「修一下」：

- 工作区有用户未提交的改动，且不在本次授权范围。
- 项目没有声明维护者身份，或近期提交出现陌生 author/committer、第三方 trailer、Cursor 标记。
- 需要 force-push、改写已推送历史、改仓库设置、改 secrets 或删除分支。
- 本地门禁失败原因不明，或 CI 失败但本地无法复现。
- 远端 SHA 读回不一致，且当前凭据无权修正。

## 完成判据

- [ ] 只改动授权范围内的文件；`git status` 无意外条目。
- [ ] 每个提交都通过 `git_commit_check`，按可独立回滚的边界分组，没有提交数量配额。
- [ ] 推送后远端 SHA 与本地 `HEAD` 一致。
- [ ] 用户要求的 PR/Issue/发布动作已完成并读回；未要求的远端动作没有发生。
- [ ] 已调用一次 `git_ship_report`，回执与实际执行、检查和未做项一致。
