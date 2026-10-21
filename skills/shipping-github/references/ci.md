# CI 与 GitHub Actions（操作清单）

本文件只写「怎么做」。为什么 CI 只覆盖一部分改动、为什么产物与源码分离，见 `knowledge/pages-deployment.md` 与 `knowledge/publish-surface.md`。

官方依据：

- [Workflow syntax](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions)
- [GITHUB_TOKEN 权限](https://docs.github.com/en/actions/security-for-github-actions/security-guides/automatic-token-authentication)
- [使用自定义 workflow 发布 Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)

## 工作流边界

- CI 只覆盖「能在干净 runner 上复现」的检查：文档渲染、静态检查、单元测试、格式检查。
- 需要本机工具链、GPU、交互式环境或大型游戏运行时的验证留在本地阶段脚本，不塞进 CI。
- 每个 workflow 显式声明最小 `permissions`；新增步骤只申请实际需要的权限。
- 一个仓库通常只需要两类：PR 检查（`pull_request`）与主分支发布（`push` 到 `main` + `workflow_dispatch`）。

## 触发与并发

```yaml
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  workflow_dispatch:

concurrency:
  group: pages
  cancel-in-progress: false
```

- 发布任务不取消进行中的运行，否则产物分支可能停在半更新状态。
- PR 检查可以用 `cancel-in-progress: true`，按 ref 分组，节省额度。
- 涉及部署的 job 设 `timeout-minutes`，避免挂死占用并发。

## 权限

```yaml
permissions:
  contents: write   # 推产物分支时需要
  pages: write      # 调 Pages API 时需要
```

- 用平台部署件（`configure-pages` → `upload-pages-artifact` → `deploy-pages`）时还需要 `id-token: write`。
- 只推产物分支、不用平台部署件时，`contents: write` + `pages: write` 足够；不要多加用不到的权限。
- `GITHUB_TOKEN` 由平台临时签发，不写入仓库、不外传。
- fork PR 默认拿不到写权限与 secrets；不要为让 fork PR 通过而改用 `pull_request_target` 执行不可信代码。

## 版本固定

- 第三方 action 钉到 commit SHA，并在行尾注释版本；tag 可变，SHA 不可变。
- 官方 action 至少钉主版本；涉及部署链路的也建议钉 SHA。
- 升级交给 Dependabot 或人工 PR，不在业务提交里顺手改版本。

```yaml
- uses: actions/checkout@<sha> # v4
- uses: actions/setup-python@<sha> # v5
```

## 缓存与依赖

- 缓存键只随依赖清单变化，不把整个仓库或时间戳塞进 key。
- 解释器版本与依赖版本要有唯一来源（项目配置文件），CI 从中派生，不新增第二份清单。
- runner 上没有本机路径时，只改「解释器指向」这一个字段，不复制整套配置。
- 缓存命中失败不能让检查静默降级；缺依赖就失败并打印安装命令。

## 复合动作

重复步骤（checkout 后的环境准备、版本派生、解释器切换）抽成 `.github/actions/<name>/action.yml`：

```yaml
name: ci-prepare
description: 从项目配置派生版本并准备解释器
inputs:
  python-version:
    description: Python 版本
    required: false
    default: "3.12"
runs:
  using: composite
  steps:
    - shell: bash
      run: echo "prepare"
```

- 复合动作只做环境准备，不藏业务检查；业务检查仍由项目统一入口执行。
- 输入要有默认值与说明；不要在 action 里硬编码仓库名或本机路径。
- 可直接复制 `templates/github-pages/ci-prepare.action.yml.template`，替换配置路径、版本字段与安装命令。

## Pages 发布流水线

典型顺序：

1. checkout（需要完整历史时设 `fetch-depth: 0`）
2. 环境准备（Quarto/Python/Node 等，版本从项目配置派生）
3. 渲染前检查（项目声明的 fast/check 入口）
4. 渲染/构建
5. 渲染后检查（产物契约、链接、编码、smoke）
6. 发布产物分支或平台部署件
7. 读回 Pages 源与页面 URL，不匹配即失败

具体写法与两种部署模式见 `github-pages.md`；发布前验收顺序见 `publish-gate.md`。

## 排错

```bash
gh run list --limit 10
gh run view <run-id> --log-failed
gh run watch <run-id>
```

- 先在本地用与 CI 相同的入口复现；不能复现时对比 runner 镜像、依赖版本、环境变量与工作目录。
- 不盲目追加 commit 触发 CI 试错；每次重跑都要有明确假设。
- 失败步骤的日志要看到具体命令与退出码；只有「step failed」时打开完整日志。
- 缓存污染表现为「本地过、CI 不过」且清理缓存后恢复；确认后再删缓存，不把删缓存当常规修复。
- 权限错误（403）先看 `permissions` 与 token 类型；`GITHUB_TOKEN` 不能改仓库设置，这类漂移需要一次性 PAT 或人工在 Settings 修正。

## 检查清单

- [ ] 触发分支与事件正确，没有在 fork PR 上执行不可信代码。
- [ ] `permissions` 最小化，部署 job 单独声明。
- [ ] 第三方 action 钉 SHA，升级有记录。
- [ ] 版本与依赖只有一个来源。
- [ ] 发布 job 有并发控制与超时。
- [ ] 失败会变红，不降级成 warning。
- [ ] 读回页面/部署源，而不是只看 job 绿。
