# 仓库卫生（操作清单）

行尾、忽略规则、分支拓扑与提交切分的可执行做法。为什么这样定见 `knowledge/repository-hygiene.md`；可直接复制的文件见包内 `templates/repository/`。

## `.gitattributes`

目标：任何机器、任何平台检出后字节一致。

```gitattributes
* text=auto eol=lf

*.sh text eol=lf
*.ps1 text eol=crlf
*.bat text eol=crlf
*.cmd text eol=crlf

*.png binary
*.jpg binary
*.pdf binary
*.woff2 binary
```

- 文本统一 LF；依赖 Windows 换行符的脚本保留 CRLF，这是例外而不是疏漏。
- 图片、字体、PDF、压缩包显式标 `binary`，否则 Git 可能按文本改写而损坏。
- 规则变更后做一次重规范化：

```bash
git add --renormalize .
git status --short
git diff --cached --stat
git commit -F <message-file>
```

- 重规范化会产生一次大提交，这是预期代价；分批做会让每次提交都混入行尾噪音。
- 不要在子目录放第二份 `.gitattributes` 复制同一规则；例外才局部覆盖。

## `.gitignore`

- 规则集中在仓库根一份；嵌套目录只允许「反向强制纳入」的特例。
- 覆盖：构建产物、缓存、依赖目录、编辑器/OS 文件、本机配置、密钥、临时目录。
- 忽略注释的 `#` 必须在行首；行内注释不生效。
- 验证：

```bash
git check-ignore -v <output-dir> <cache-dir> <local-config>
git status --ignored --short | head
```

- 个人临时忽略放 `.git/info/exclude`，不要为个人习惯改仓库 `.gitignore`。
- 已经被跟踪的产物要先 `git rm --cached`，再确认忽略规则命中。

## `.editorconfig`

- 放在仓库根，`root = true` 必须在任何节之前；EditorConfig 从被打开文件向上查找，放子目录盖不住其它目录。
- 统一 charset、end_of_line、缩进、末尾换行；与 `.gitattributes` 保持一致（例如 `.ps1` 用 CRLF、缩进 2，Python 缩进 4）。
- 它不是 Git 功能，但和行尾/编码基线是同一套约束，通常一起维护。

## 分支拓扑

- 远端只保留有下游消费者的分支：源码分支 + 产物分支（若用分支部署）。
- 本地临时分支随意建，合并后 `git branch -d`；不要 `git push -u origin <feat-branch>`。
- 保护规则至少覆盖：
  - 源码分支：禁止强推、禁止删除。
  - 产物分支：禁止删除；只允许自动化写入。
- 用仓库级 ruleset 禁止新建远端分支，比口头约定可靠；紧急时可临时关闭。
- 产物分支只由 CI 更新；人工推送会在下次部署时被整体覆盖。

## 提交切分

- 判据是「出错时希望回滚到哪」，不是文件类型是否相同。
- 同一行为变更跨多个文件时合并成一组；拆开制造不可运行的中间状态。
- 按可独立回滚的边界分组，没有固定提交数量；不为拆分而拆分。
- 每组：显式 `git add` → `git diff --cached --check` → `git diff --cached --stat` → 用 `git_commit_check` 检查信息 → `git commit -F`。
- 提交信息前缀让读者不看 diff 就能判断影响面；格式见 `steps/04-write-message.md`。

## 本机信息边界

- 判定标准：「换一台机器这条内容还成立吗」。不成立就不进版本库。
- 解释器绝对路径、凭据、个人编辑器配置、用户主目录路径属于本机信息；写进文档也会泄露目录结构。
- 项目需要固定工具版本时，提交「版本清单」而不是「本机路径」；路径由各机器自己解析。
- 密钥、token、`.env` 永不入库；发现已提交时先轮换凭据，再清历史（需要用户授权）。

## 首次归一化与迁移

新仓库或从旧仓库迁入时：

```bash
git init -b main
git add --renormalize .
git status --porcelain
git diff --cached --stat
```

- 确认输出里没有依赖目录、产物、缓存、本机配置。
- 大文件与二进制先决定是否该入库；需要时用 Git LFS，不要直接提交。
- 迁移完成后再加保护规则，避免在整理期间被强推覆盖。
