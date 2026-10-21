# 步骤 1：读项目约束

任何交付动作开始前只做这一件事：确认项目允许怎么做。项目规则优先于本技能。

## 读什么

按仓库根目录顺序：

1. `AGENTS.md`、`CONTRIBUTING.md`、`README` 中的贡献/发布段落。
2. `.gitattributes`、`.gitignore`、`.editorconfig`。
3. `.github/workflows/`、发布脚本、版本与标签约定。
4. 当前 Git 状态：

```bash
git status --short
git branch --show-current
git remote -v
git log --oneline -10
```

只在任务确实涉及提交、推送、变更总结、审查、冲突解决或发布说明时运行这些命令。

## 提取三项事实

- **维护者身份**：项目声明的 author/committer 姓名与邮箱。只从文档读取，不从 `git config`、提交历史或平台账号反推。
- **项目门禁**：CI 或 CONTRIBUTING 声明的检查入口（脚本、包管理器命令、lint/test 命令）。
- **提交规则**：类型范围、scope 约定、语言要求、必须或允许的 trailer、分支与标签规则。

## 身份缺失就停

项目没有声明维护者身份时：

- 不能核对 author/committer，也就不能声称提交身份合规。
- 停在提交之前，向用户报告「项目未声明维护者身份，无法核对」，请用户补充或点名身份。
- 不要用 `git config user.name` 代替声明，不要用最近提交的作者推断。

## 输出

在继续之前，用一句话记下：目标分支、授权路径范围、声明身份、项目门禁命令、用户是否要求 PR/Issue/发布。任何一项不清楚就问，不猜。
