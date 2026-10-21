# 步骤 7：PR 与 Issue

只有同时满足以下条件才执行：用户明确要求建 PR/Issue，且远端是 GitHub。否则跳过本步骤，不要主动创建。

## 前提

```bash
git remote -v          # 确认 GitHub 远端
gh auth status         # 确认已登录
```

- 没有 `gh` 或未认证：报告并让用户选择网页操作，不擅自安装或登录。
- PR 的目标分支、标题、正文范围按步骤 2 的约定；不擅自改合并方式或分支保护。

## PR

```bash
gh pr create --base main --head <branch> --title "type(scope): 中文说明" --body-file <body.md>
gh pr checks --watch
gh pr view --web
```

正文写：动机、改动面、验证方式、风险与回滚点。等 checks 通过再合并；合并方式按项目约定（squash/merge/rebase），不擅自改变。

## Issue

```bash
gh issue create --title "<标题>" --body-file <body.md>
```

写可复现步骤、期望结果、实际结果、环境；不贴密钥、令牌或完整个人路径。

## 结果

记下 PR/Issue URL 与 checks 结论；步骤 9 的 `mode` 用 `pr`，`checks.readback` 只有在真的读过页面/checks 后才填 `pass`。
