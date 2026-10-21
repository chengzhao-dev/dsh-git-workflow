# 版本与发布

## 0.x 规则

当前处于 0.x，不承诺 1.0.0；版本按影响面递增：

- **patch**：措辞修订、文档修正、测试补充、内部重构、行为不变的依赖更新。
- **minor**：新增技能名称、新增工具名称、新增或改变公开入参/输出字段、提交规则出现会让旧提交不再通过的变化。
- **major**：不计划；真要做破坏性重命名时先单独讨论，不默认发 1.0.0。

一次发布只回答一个问题：用户升级后会不会看到不同的技能/工具/规则？会，就至少 minor；不会，就 patch。

## 发布前

1. `npm test`、`npm run check` 与 `npm run pack:check` 通过。
2. `lib/` 已重新构建并提交，源码与产物一致。
3. `package.json` 版本、`package-lock.json` 顶层版本一致。
4. README 的安装地址与版本号同步。
5. 发布说明写清新增/变更/修复，以及是否有迁移动作。

## 标签与 npm

- 版本提交后创建 annotated tag：`git tag -a v0.1.0 -m "v0.1.0"`。
- 推送标签触发 `.github/workflows/publish.yml`：`npm ci` → `npm test` → `npm run check` → `npm publish --provenance`。
- npm 端使用 trusted publishing；`npm trust list` 应指向本仓库的 `publish.yml` 与 `npm publish` 动作。不一致时停下，把配置命令交给用户，不擅自改信任设置。
- 成功判据：Actions 绿色，且 `npm view @chengzhao-dev/dsh-git-workflow@<version> version` 返回该版本。
- 若 npm 要求包先存在才允许配置 trusted publishing，只做一次本地 `npm publish --provenance` 引导；首次引导失败不等于后续标签发布失败。
- 商店/registry 的上架展示不在本插件发布范围内。
