# GitHub Desktop 只建本地仓，远端不存在导致推送失败

**日期**：2026-09-29　**关键词**：GitHub Desktop、Publish repository、push 失败、远端 404、connection reset、curloptResolve、ls-remote

## 症状

- GitHub Desktop 里「New repository」建好仓库后无法推送到 GitHub。
- `GET /repos/<owner>/<repo>` 返回 404；`GET /user/repos` 列表里没有该仓库。
- push 间歇性报 `Connection was reset`，重试有时可行有时不可行。

## 根因

1. GitHub Desktop 的「New repository」只创建本地仓库；远端仓库要靠「Publish repository」创建，而这一步可能因网络问题**静默失败**，远端从未存在过。根因不是 token 权限——已保存凭据的 scopes 含 `repo, workflow`，足够建仓。
2. 次要坑：在 Git Bash/Windows 里用 `curl -d '{...中文...}'` 内联 JSON 时中文被代码页破坏，API 返回 `Problems parsing JSON`。
3. 网络层：到 github.com 的连接不稳定，域名解析到的 IP 可能不可达。

## 修复方案

1. 用 GitHub API 补建远端公开仓库。中文描述放进 UTF-8 编码的文件，再用 `--data-binary` 发送，绕开命令行内联中文的编码破坏：

   ```bash
   curl -s -X POST \
     -H "Authorization: token $cred" \
     -H "Accept: application/vnd.github+json" \
     https://api.github.com/user/repos \
     --data-binary @<payload-file>.json
   ```

2. push 遇到 connection reset 时，把域名固定到可达的 GitHub IP 再试，多个 IP 依次轮换：

   ```bash
   git -c http.curloptResolve="github.com:443:140.82.113.3" push origin main
   ```

   候选 IP 会随时间变化，使用前先确认可达；命令里的 IP 只是当下可用值，不是固定配置。

3. 用 GitHub Desktop 建仓后，确认它显示过「Publish repository」成功，或直接用上面的 API 检查远端是否存在，再开始提交代码。

## 验证方法

- 远端存在性：`GET /repos/<owner>/<repo>` 返回 200。
- push 成败判据：`git ls-remote origin main` 返回的 SHA 与本地 `git rev-parse HEAD` 一致。不要用 `git status -sb` 判断——没有 upstream tracking 时 ahead 信息不可靠。
