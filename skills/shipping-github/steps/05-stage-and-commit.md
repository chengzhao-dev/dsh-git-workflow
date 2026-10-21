# 步骤 5：显式暂存并提交

只暂存步骤 2 清单里的路径，提交信息用步骤 4 已通过检查的完整文本。

## 暂存

```bash
git add path/one path/two
git diff --cached --stat
git diff --cached --check
```

- 禁止 `git add -A`、`git add .`；即使用户要求提交整个工作区，也先用 `git status --short` 列清文件，再逐个显式暂存已确认的路径。
- 二进制或大文件先确认是否该入库；生成物、缓存、本机配置应先进 `.gitignore`。
- 取消暂存用 `git restore --staged <path>`，不要用 `reset --hard`。
- 暂存后发现多出未授权文件，先取消暂存并报告，不要直接提交。

## 提交

先确认 Git 将使用的身份就是步骤 1 声明的维护者（只读核对，不改 `git config`）：

```bash
git var GIT_AUTHOR_IDENT
git var GIT_COMMITTER_IDENT
```

与声明不一致时停止，请用户设置身份；或经用户授权，用一次性的 `git -c user.name=<name> -c user.email=<email> commit -F <message-file>` 提交。不要用 `git config` 改全局或仓库配置来「顺手修好」。

把步骤 4 的完整信息写入仓库外的临时文件（不要提交这个文件），然后：

```bash
git commit -F <message-file>
```

- 用 `-F` 而不是 `-m`：保留正文、footer 和换行，避免 shell 引号与转义改变信息。
- 不使用 `--no-verify`、不跳过 hooks。
- 一个提交只做一件事；分组按可独立回滚的边界，没有固定数量配额。

## 提交后复核

在提交后调用工具 `git_commit_check`（不带 `message`；默认检查下一次 push 的范围），或显式检查刚生成的提交：

```json
{
  "range": "HEAD~1..HEAD",
  "author": "Alice <alice@example.com>",
  "require_chinese": true
}
```

- 未推送的提交发现问题：修正后允许 `git commit --amend`（仅限刚失败且未推送的提交）。
- 已推送的提交发现问题：追加新提交或 `git revert`，不改写历史。
- 复核通过才进入推送；不要用「检查过了」代替复核命令的真实输出。
