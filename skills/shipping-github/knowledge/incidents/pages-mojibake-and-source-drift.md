# GitHub Pages 站点 404 与乱码：渲染全绿但线上打不开

**日期**：2026-09-29　**关键词**：GitHub Pages、404、乱码、site-url、Pages source、gh-pages、发布前检查

## 症状

- `https://<owner>.github.io/<repo>/` 打不开：HTTP 404（Site not found），或打开后中文乱码。
- Actions 里渲染与部署步骤全绿，没有任何一步报错。

## 根因

1. Pages 源从未配置成功（出现过 `build_type: workflow` + source `main`，与 workflow 发布 `gh-pages` 分支的模式不匹配，线上一直 404）。workflow 里纠正 Pages 源的 curl 步骤把非预期返回**降级成 warning**，job 照样绿，问题被掩盖。
2. 排查陷阱：`GET /repos/<owner>/<repo>/pages` **未认证时一律返回 404**，不能用它判断「站点未启用」，必须带 token 查询。
3. 站点配置缺少根地址（Quarto Book 是 `book.site-url`），渲染器不生成 `sitemap.xml`，站内相对链接在子路径部署下可能失效。
4. 内容编码检查默认是软报告（soft），乱码文件不阻断 CI，直接渲染发布。
5. 发布 workflow 只跑渲染命令，没有跑仓库统一校验入口，也没有对产物目录做发布前 smoke 检查。

## 修复方案

1. 在站点配置里补根地址，例如 Quarto Book 的 `book:` 下 `site-url: "https://<owner>.github.io/<repo>"`（与 `repo-url` 同级）。
2. 发布 workflow（如 `pages.yml`）按顺序执行：渲染前 `<check-command> --profile fast` → 渲染 → 后处理（如 `defer_mermaid.py`）→ 渲染后 `<check-command> --profile full`（含产物 smoke 检查）→ 发布产物分支。
3. Pages 源校验步骤以**读回判定**收口：`POST`（首次创建）/`PUT`（纠正，成功返回 204）尽力而为，最后 `GET /repos/<owner>/<repo>/pages` 读回 source，不是预期分支/目录即 `exit 1`，不允许降级成 warning。注意 `GITHUB_TOKEN` 首次创建可能 403（Resource not accessible by integration），需一次性用 PAT 或在 Settings → Pages 手动启用。
4. 发布架构定为：GitHub Actions 渲染并校验后把产物推到 `gh-pages` 分支，Pages 以 legacy 模式从 `gh-pages /` 提供 HTML；`gh-pages` 只由 Actions 更新。
5. 已知边界（绿跑日志证据）：legacy 模式下 `GITHUB_TOKEN` 对 POST/PUT 一律 403，**Actions 无法自愈 Pages 配置漂移**，读回判定只负责检测报警；修复漂移需一次性用 PAT（如 `PUT build_type=legacy + source gh-pages /`）或到 Settings → Pages 手动改回。
6. 仓库统一校验入口应包含产物 smoke：入口页存在、charset 正确、无 BOM/U+FFFD/乱码特征、`sitemap.xml` 就绪（站点根地址生效的标志）。

## 验证方法

- `curl -s -o /dev/null -w "%{http_code}" https://<owner>.github.io/<repo>/` 返回 200。
- `GET /repos/<owner>/<repo>/pages` 返回 200，且 `source` 为预期分支与目录。
- 本地发布前预演：渲染后跑 `<check-command>` 的产物检查项，全绿再发布。
