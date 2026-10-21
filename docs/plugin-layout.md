# 插件布局

## 会进 npm 包

```text
package.json
cordis.patch.yml
lib/                         # tsc 产物，必须提交
skills/shipping-github/      # SKILL.md、steps/、references/、knowledge/、scripts/
templates/                   # 仓库点文件、CONTRIBUTING、Pages workflow
locale/                      # zh.json、en.json
icon.svg
README.md
README.en.md
LICENSE
```

`files` 字段显式列出这些路径；`docs/`、`tests/`、仓库级 `scripts/` 不在其中。

## 只在仓库

```text
src/                         # TypeScript 源码
tests/                       # node:test 测试
scripts/checking-skill-links.mjs
docs/                        # 本目录：边界、流程、布局、版本与迁移记录
.github/workflows/           # CI 与发布
tsconfig.json
.gitignore / .npmignore
```

## 关键文件

| 路径 | 作用 |
| --- | --- |
| `src/index.ts` | 插件入口：skill provider + 两个工具注册 |
| `src/workspace.ts` | Git checkout 判定（`.git` 目录/文件，64 层上限） |
| `src/commit-rules.ts` | 纯提交信息解析与扩展规则 |
| `src/tools/commit-check.ts` | `git_commit_check`：只读 `git log` |
| `src/tools/ship-report.ts` | `git_ship_report`：闭集回执 |
| `src/tools/registry.ts` | 宿主 tool registry 的结构类型 |
| `skills/shipping-github/SKILL.md` | 技能入口：硬边界、步骤路由、停止条件 |
| `skills/shipping-github/steps/` | 01–09 步骤文件 |
| `skills/shipping-github/scripts/checking-commit-identity.mjs` | 复用编译规则的薄 CLI |

## 构建与发布

- `npm run build`：`tsc -p tsconfig.json` 输出到 `lib/`。
- `npm test`：先构建，再跑 `tests/*.test.mjs`。
- `npm run check`：`tsc --noEmit` + 仓库链接/元数据/包身份检查。
- `npm run pack:check`：`npm pack --dry-run`，核对包内文件。
- GitHub Actions：push/PR 跑 `npm test`（含构建）与 `npm run check`；`v*` 标签先跑两者，再 `npm publish --provenance`。

## 为什么 `lib/` 要提交

用户可能通过 `github:chengzhao-dev/dsh-git-workflow#v0.1.0` 安装。DSH 不会在安装时构建插件，所以 `lib/` 必须与源码一起提交，且发布前重新构建，避免源码与产物漂移。
