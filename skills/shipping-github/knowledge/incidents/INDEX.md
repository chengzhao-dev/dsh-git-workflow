# GitHub 发布事故索引

本目录只收在 Git/GitHub 操作中真实发生、且能定位到具体机制的事故。每条记录症状、根因、修复与验证，不写泛化的「注意事项」。

| 文件 | 一句话 | 关键词 |
| --- | --- | --- |
| `desktop-publish-and-push-failure.md` | GitHub Desktop 只建本地仓，远端不存在导致 push 404 与 connection reset | GitHub Desktop、远端 404、curloptResolve、ls-remote |
| `pages-mojibake-and-source-drift.md` | Pages 源漂移与编码检查过软，渲染全绿但站点 404/乱码 | Pages source、site-url、gh-pages、编码、读回判定 |

新增事故时：

- 文件名用「现象-机制」的短横线式，放在本目录，不建子目录。
- 只记录能复现或能由日志证明的因果；推断写在「假设」里并标明未验证。
- 修复步骤给可执行命令或明确的操作位置；验证给可观察结果。
- 同一机制的不同表现合并进一条，不按项目复制多份。
