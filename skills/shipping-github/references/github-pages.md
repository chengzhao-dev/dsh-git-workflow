# 发布到 GitHub Pages（操作清单）

本文件只写「怎么做」。为什么两种部署源不能混、为什么产物分支用孤立提交，见 `knowledge/pages-deployment.md`。

> Quarto Book 的默认输出目录是 `_book/`，website 是 `_site/`。下文的 `<output-dir>` 换成项目实际产物目录，`publish_dir` 与上传 `path` 必须一致。

## 两种部署源

GitHub Pages 只有两类来源，二选一，不能混：

| 模式 | Pages 设置 | 谁写产物 | 需要的权限 |
| --- | --- | --- | --- |
| 分支部署 | Deploy from a branch → `<branch>` / `(root)` 或 `/docs` | CI 把产物推到分支 | `contents: write`（推分支）；纠正源时 `pages: write` |
| 工作流部署 | GitHub Actions | `upload-pages-artifact` + `deploy-pages` | `pages: write`、`id-token: write` |

混用的典型表现：Pages 源指向 `main`，workflow 却推 `gh-pages`，线上一直 404；或者同时配置两套部署件，旧源覆盖新源。

## 模式一：Actions 渲染 + 产物分支

适用于希望产物分支可检查、又能保留源码历史的项目。

```yaml
name: pages
on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: write
  pages: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  deploy:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@<sha> # v4
      - name: Render
        run: <render-command>
      - name: Verify output
        run: <check-output-command>
      - uses: peaceiris/actions-gh-pages@<sha> # v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_branch: gh-pages
          publish_dir: ./<output-dir>
          force_orphan: true
```

要点：

- `force_orphan: true`：每次部署用孤立提交覆盖产物分支，不累积历史；代价是失去产物级回滚，只能回源码重渲染。
- Pages 设置选 **Deploy from a branch** → `gh-pages` / `(root)`。
- `permissions` 只需 `contents: write` + `pages: write`；不用 `configure-pages`/`upload-pages-artifact`/`deploy-pages`，也不需要 `id-token: write`。
- 产物分支只由 Actions 更新；人工推源码上去会在下次部署时被整体覆盖。

### 幂等纠正 Pages 源

首次部署时源可能尚未设置。先 POST 再 PUT，409 表示已存在，属正常：

```bash
gh api -X POST "repos/<owner>/<repo>/pages" \
  -f "source[branch]=gh-pages" -f "source[path]=/" || true
gh api -X PUT "repos/<owner>/<repo>/pages" \
  -f "source[branch]=gh-pages" -f "source[path]=/" || true
gh api "repos/<owner>/<repo>/pages" --jq '.source'
```

- 未认证的 `GET /repos/<owner>/<repo>/pages` 一律返回 404，不能用来判断「站点未启用」；必须带 token。
- `GITHUB_TOKEN` 对 POST/PUT 常返回 403（`Resource not accessible by integration`），**Actions 无法自愈配置漂移**。
- 读回 `source` 不是 `gh-pages` `/` 时让 job 失败；修复漂移用一次性 PAT 或到 Settings → Pages 手工改回。不要把失败降级成 warning。

## 模式二：平台部署件

适用于希望部署与 CI 检查合并在同一 job、或团队协作的项目。

```yaml
permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/configure-pages@<sha> # v5
      - uses: actions/upload-pages-artifact@<sha> # v3
        with:
          path: ./<output-dir>
      - id: deployment
        uses: actions/deploy-pages@<sha> # v4
```

Pages 设置选 **GitHub Actions**。产物作为 artifact 上传，不写分支；`environment` 与 `id-token` 是部署必需项。

## 备选模式

| 模式 | 关键步骤 | 适用 |
| --- | --- | --- |
| `quarto publish gh-pages` | 交互式选仓库后自动渲染并推 `gh-pages` | 单文档、小站点、快速发布 |
| 渲染到 `docs/` + 分支部署 | 项目配置设 `output-dir: docs`，提交后选 `main` + `/docs` | 想在源码仓库直接看到产物 |
| 平台部署件 | 见模式二 | 团队协作、与 CI 合并 |

## 站点路径与链接

- 项目站点地址带仓库名前缀：`https://<owner>.github.io/<repo>/`；用户/组织站点不带。前缀变化会让写死的绝对地址全断。
- 页面内资源用相对路径，由渲染器在生成时修正；不要手写 `https://<owner>.github.io/...`。
- 框架需要站点根地址时（如 Quarto Book 的 `site-url`、Vite 的 `base`），必须填带仓库名前缀的完整地址；缺了会导致 sitemap 缺失、相对链接在子路径下失效。
- 本地正常、线上 404 优先怀疑大小写：托管端区分大小写，本地文件系统通常不区分。
- 单文件分发要显式开启内嵌资源（如 `embed-resources: true`）；默认渲染仍会产出依赖目录，要把目录一起上传。

## 发布前检查

- [ ] 本地渲染/构建通过，无错误。
- [ ] 相对链接与图片路径在带仓库名前缀的站点下仍正确。
- [ ] 中文内容为 UTF-8 无 BOM，无乱码；编码检查不是软报告。
- [ ] 入口页（如 `index.qmd` / `index.html`）存在。
- [ ] 部署源（分支 + 目录，或工作流）与所选模式匹配。
- [ ] 产物目录被 `.gitignore` 排除，不在源码分支提交。
- [ ] 发布 workflow 跑的是项目统一检查入口，并对产物做 smoke 检查。

## 发布后读回

```bash
curl -s -o /dev/null -w "%{http_code}\n" "https://<owner>.github.io/<repo>/"
curl -s "https://<owner>.github.io/<repo>/" | grep -F "<关键字符串>"
gh api "repos/<owner>/<repo>/pages" --jq '.html_url, .source'
gh run list --workflow pages.yml --limit 3
```

判定顺序：

1. 工作流是否成功；失败先看 `gh run view <id> --log-failed`。
2. Pages 源是否是预期分支/目录，或是否使用平台部署件。
3. 页面 URL 是否 200，关键内容是否出现（不是只看 200）。
4. 最后才考虑缓存与全球分发延迟。

任务成功但页面未变时不要重复触发部署；原因未确认前重复部署只会加深半更新风险。

## 故障处置

- **404**：先查 Pages 源与部署模式是否匹配，再查入口文件名大小写与 `base`/`site-url`。
- **中文乱码**：查源文件编码与 BOM、构建链是否经过系统代码页/GBK 往返、HTTP 响应 charset；不要靠重推解决。
- **资源 404 但首页 200**：查 `base`/`site-url` 前缀与相对路径；子路径部署最容易漏。
- **workflow 绿但站点没变**：查 Pages 源是否被改回其它分支、是否有第二个部署 workflow 覆盖、产物目录是否为空。
- **403**：查 `permissions` 与 token 类型；`GITHUB_TOKEN` 不能改仓库设置。
- 详见 `incidents/pages-mojibake-and-source-drift.md`。
