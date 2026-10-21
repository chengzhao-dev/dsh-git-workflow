# 步骤 9：交付回执

每次交付结束调用一次 `git_ship_report`。回执是最终交付卡，不要再写一段平行总结重复它。

## 调用

```json
{
  "mode": "push",
  "executed": true,
  "branch": "main",
  "commits": ["feat(parser): 添加提交信息校验"],
  "remote": {
    "name": "origin",
    "local_sha": "0123456789abcdef0123456789abcdef01234567",
    "remote_sha": "0123456789abcdef0123456789abcdef01234567",
    "matches": true
  },
  "checks": {
    "identity": "pass",
    "message": "pass",
    "project": "pass",
    "readback": "pass"
  },
  "unexecuted": ["未打标签", "未创建 PR"]
}
```

## 字段规则

- `mode`：`commit`、`push`、`pr`、`pages`、`skipped` 之一，表示本次停在哪个动作。
- `executed`：该动作是否真的执行；`mode=skipped` 时必须为 `false`。
- `commits`：本次涉及的提交标题，最多 8 条；没有就省略。
- `remote`：远端名、本地/远端 SHA、是否一致。只做本地提交时可省略；未核对时 `matches` 填 `null`，不要填 `true`。
- `checks`：四项必填。`identity`（作者/committer）、`message`（`git_commit_check`）、`project`（项目门禁）、`readback`（推送/PR/发布读回）。未做该项填 `skip`，不要用 `pass` 代替。
- `unexecuted`：明确没做的动作，例如「未打标签」「未创建 PR」，最多 8 条。
- 未知字段、超出闭集、`skipped` 却 `executed=true` 都会直接报错；按提示修正，不要绕过。

## 诚实性

- 只有真实命令输出支持时才填 `pass`；推断、计划或「应该没问题」都填 `skip` 或 `fail`。
- 推送成功但未核对远端 SHA，`readback` 不能填 `pass`。
- 回执生成后，用一两句话说明结果与下一步；不要重复整张卡。
