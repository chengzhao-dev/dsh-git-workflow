# 版本与发布

## 0.x 规则

当前处于 0.x，不承诺 1.0.0；版本按影响面递增：

- **patch**：措辞修订、文档修正、测试补充、内部重构、行为不变的依赖更新。
- **minor**：新增技能名称、新增工具名称、新增或改变公开入参/输出字段、提交规则出现会让旧提交不再通过的变化。
- **major**：不计划；真要做破坏性重命名时先单独讨论，不默认发 1.0.0。

一次发布只回答一个问题：用户升级后会不会看到不同的技能/工具/规则？会，就至少 minor；不会，就 patch。

`package.json`、`package-lock.json` 与两份 README 的安装地址必须同版本；`npm run check` 会核对 README 里的安装地址，缺一处就不过。

## 发布前

1. `npm test`、`npm run check` 与 `npm run pack:check` 通过。
2. `lib/` 已重新构建并提交，源码与产物一致。
3. `package.json` 版本、`package-lock.json` 顶层版本一致。
4. README 的安装地址与版本号同步。
5. 发布说明写清新增/变更/修复，以及是否有迁移动作。

## 标签与 npm

发布只有一个入口：在**用于发布的那一个提交**上创建 annotated tag，再推送标签。

```bash
git tag -a v0.1.1 -m "v0.1.1"
git push origin v0.1.1
```

- 标签必须指向已推送的 `main` 提交，且该提交的内容就是 `package.json` 里那个版本。不要给更早的提交补打新标签，否则 GitHub tag、npm 的 `gitHead` 与 Release 会各指一个提交。
- 推送标签触发 `.github/workflows/publish.yml`：核对标签与 `package.json` 版本 → `npm ci` → `npm test` → `npm run check` → `npm publish` → 创建 GitHub Release。
- 版本号在 npm 上已存在时工作流会红（`cannot publish over the previously published versions`）。这是版本号用错，不是发布故障：升版本后重新打标签，不要重推同一个标签。
- 不再手工 `npm publish`。本地没有 OIDC，`publishConfig.provenance` 会让普通 `npm publish` 报 `EUSAGE`；绕过它的手工发布会留下没有 provenance 的版本，还会抢在标签发布之前占掉版本号。

## 信任与 provenance

- npm 端使用 trusted publishing：npmjs.com 上该包的 Trusted Publisher 指向本仓库的 `publish.yml` 与 `npm publish` 动作。工作流只需 `id-token: write`，不配置 `NPM_TOKEN`。
- 核对：`npm trust list @chengzhao-dev/dsh-git-workflow` 应出现本仓库与 `publish.yml`；`https://registry.npmjs.org/-/npm/v1/attestations/@chengzhao-dev/dsh-git-workflow@<version>` 应返回 attestation 数据。
- 信任关系缺失或配错时，标签发布会在 `npm publish` 处以 `ENEEDAUTH` 失败。改 npmjs.com 上的 Trusted Publisher 配置，不要在仓库里加长期 token。

## 发布后核对

1. Actions 绿色，且 `npm publish` 与创建 Release 两步都真的执行。
2. `npm view @chengzhao-dev/dsh-git-workflow@<version> version gitHead`：版本正确，`gitHead` 等于标签指向的提交。
3. `git rev-parse v<version>^{commit}` 与发布时的 `origin/main` 一致。
4. GitHub Releases 有对应版本，且指向同一提交。
5. 商店/registry 的上架展示不在本插件发布范围内。
