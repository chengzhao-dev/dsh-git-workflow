# 发布闸门（操作清单）

发布前按固定顺序验收。顺序不能换：先生成、再检查产物、最后发布；任何一步失败都停，不用重推碰运气。

为什么这样划界、哪些内容不该上公开面，见 `knowledge/publish-surface.md`。

## 0. 先读项目自己的发布入口

项目可能已经有统一检查脚本、`AGENTS.md` 发布条款或 CI 配置。先读它们，用项目声明的命令；本文只给通用顺序，不覆盖项目规则。

确认：

- 发布目标（源码分支 + 产物分支，或平台部署件）。
- 发布命令与检查入口（脚本名、profile、包管理器命令）。
- 哪些目录是产物、哪些是本机配置、哪些绝不能入库。

## 1. 范围与状态

```bash
git status --short
git branch --show-current
git remote -v
git log --oneline -5
```

- 只发布本次授权范围内的改动；用户既有未提交改动不得被卷入。
- 确认当前分支是发布分支；不在 detached HEAD。
- 确认远端是目标仓库，不是 fork 或旧地址。

## 2. 生成物被忽略

```bash
git check-ignore -v <output-dir> <cache-dir> <local-config>
```

- 每个产物/缓存/本机配置路径都应命中一条忽略规则。
- 源码与项目自有技能目录不应出现在忽略输出里。
- 产物目录、缓存、编辑器配置、密钥一旦入库，clone 体积与 diff 噪音会同时失控。

## 3. 发布前检查（渲染/构建之前）

运行项目声明的快速检查：

```bash
<check-command> --profile fast
```

覆盖：格式、拼写、链接、配置 schema、技能/文档结构、编码。编码检查必须能阻断，不能只是 warning。

## 4. 渲染/构建

```bash
<render-command>
```

- 用与 CI 相同的入口和参数，避免「本地过、CI 不过」。
- 渲染后处理脚本（如 Mermaid 延迟、资源内嵌）要显式执行；本地命令不一定会自动跑。
- 失败先修因，不跳过步骤。

## 5. 产物检查（发布之前）

对 `<output-dir>` 做 smoke：

- [ ] 入口文件存在（`index.html` / `index.qmd` 的产物）。
- [ ] 关键页面/资源存在，数量与预期一致。
- [ ] 编码正确：UTF-8 无 BOM、无 U+FFFD、无乱码特征。
- [ ] 站点根地址/前缀已设置（`site-url`、`base`），sitemap 或等价索引已生成（若项目需要）。
- [ ] 没有草稿、临时文件、本机路径、密钥进入产物。
- [ ] 产物大小没有异常膨胀（缓存或依赖被误打包）。

运行项目声明的完整检查：

```bash
<check-command> --profile full
```

## 6. 提交与推送

只在用户明确要求时执行：

```bash
git add <explicit-paths>
git diff --cached --check
git commit -F <message-file>
git push origin HEAD
```

- 提交信息遵循 `references/git-workflow.md`。
- 不把产物目录提交到源码分支。
- 推送后核对远端 SHA 与本地一致。

## 7. 发布与读回

CI 发布后：

```bash
gh run list --limit 3
gh run view <run-id> --log-failed
curl -s -o /dev/null -w "%{http_code}\n" "<site-url>"
curl -s "<site-url>" | grep -F "<关键字符串>"
```

- 工作流必须成功，且发布步骤真的执行（不是被条件跳过）。
- 页面 URL 返回 200，关键内容出现；只返回 200 不算通过。
- Pages 源/部署件与所选模式一致；读回失败就让任务红，不降级成 warning。
- 本地检查通过 ≠ 已发布；两者要分别报告。

## 8. 回滚

- 源码问题：追加 `git revert <sha>`，重新触发发布。
- 产物问题：修复后重跑 workflow；产物分支用孤立提交覆盖，不需要手工清理历史。
- Pages 配置漂移：用一次性 PAT 或到 Settings → Pages 手工改回；`GITHUB_TOKEN` 通常无权修正。
- 不在未确认原因时反复触发部署。

## 闸门记录

发布完成后记录：提交 SHA、工作流 run id、页面 URL、读回的关键内容、未执行的操作。失败时记录：失败步骤、错误原文、已排除的原因、下一步假设。
