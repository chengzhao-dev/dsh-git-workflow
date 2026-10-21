# 贡献指南

## 开始之前

- 先读仓库根的 `AGENTS.md` 或 `README.md` 里的维护约定；本文件只写贡献流程，不重复项目规则。
- 确认本地工具版本满足项目要求；本机路径与凭据不要提交。

## 改动流程

1. 从最新的 `main` 开始，不改写公共历史。
2. 小步修改，按可独立回滚的边界组织提交；同一行为变更跨多个文件时放在同一组。
3. 提交前运行项目声明的检查命令，确认通过；不要只跑改动相关的子集。
4. 提交信息用 `type(scope): 中文说明`，`type` 取 `feat`、`fix`、`build`、`chore`、`ci`、`docs`、`style`、`refactor`、`perf`、`test`、`revert` 之一；一次提交只用一个类型。
5. 冒号必须是英文半角且后跟一个空格；破坏性变更在冒号前加 `!`。正文和 footer 各用一个空行与上一段分隔；`BREAKING CHANGE` 必须全大写。
6. 描述至少包含一个汉字、不超过 50 个字符、结尾不加句号；技术专名可以保留英文。
7. 用 `git commit -F <message-file>` 提交完整信息，不要用 `-m` 重拼多段文本；提交前用项目声明的检查工具核对信息格式。
8. 只 `git add` 本次改动的显式路径，不用 `git add -A` 把无关改动卷进来。

## 提交身份

- 项目应在 `AGENTS.md` 或本文件写明维护者的姓名与邮箱；未写明时不要凭 `git config` 或历史提交猜测，先补声明或停下核对。
- 默认只使用维护者本人的 author/committer 身份；不添加 `Co-authored-by`、`Signed-off-by` 或 AI 工具 trailer，除非项目明确要求。
- 推送前检查：

```bash
git log --format='%an <%ae> %cn <%ce>' -n 30 | sort -u
git log --format='%B' -n 30 | grep -Ei 'co-authored-by|signed-off-by|cursor|generated-by|made with cursor' || true
```

## 不要提交

- 构建产物、缓存、依赖目录、日志、临时文件。
- 本机配置、绝对路径、密钥、token、`.env`。
- 与本次改动无关的个人实验文件。

## 文档与链接

- 文档改动要检查相对链接与图片路径，确保在仓库内和发布站点上都可达。
- 中文内容保存为 UTF-8 无 BOM；不要用系统代码页转换过再提交。
- 新增或移动文件后，更新引用它的索引、目录和链接。

## 发布

发布由维护者按 `shipping-github` 技能的 `references/publish-gate.md` 执行；贡献者不需要手动触发 Pages 部署，也不要把产物推到产物分支。
