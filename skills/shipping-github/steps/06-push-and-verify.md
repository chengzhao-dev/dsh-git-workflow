# 步骤 6：推送并核对远端 SHA

推送成功的判据只有一个：远端分支 SHA 与本地 `HEAD` 一致。`git status -sb` 的 ahead 信息不能代替读回。

## 执行

```bash
git fetch origin
git push origin HEAD
git rev-parse HEAD
git ls-remote origin refs/heads/<branch>
```

- 首次推送用 `git push -u origin <branch>` 建立 upstream。
- 比对 `git rev-parse HEAD` 与 `git ls-remote` 的 SHA；不一致就是没成功。
- 目标分支不是当前分支时，显式写 `HEAD:<branch>`，不要想当然。
- 不 force-push；不改写已推送历史；不删除远端分支，除非用户点名。

## 被拒时

1. `git fetch origin` 看远端是否前进。
2. 需要合并时用普通 merge；只对未推送的本地提交 rebase，不 force-push。
3. 冲突或权限问题超出授权范围时停止并报告。

## 网络失败

- `Connection was reset` / 超时：重试一次；仍失败再查网络、代理与 DNS，不连续推空提交试错。
- 远端 404：先确认仓库是否存在（`git ls-remote`、平台页面），不要把「本地有 commit」当成「远端已建仓」。

## 记录

记下远端名、分支、本地 SHA、远端 SHA、是否一致，供步骤 9 的 `remote` 字段使用；没有核对就填 `matches: null`，不要编造 `true`。
