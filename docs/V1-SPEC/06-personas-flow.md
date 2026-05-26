# 06 — Personas & Flow

> 本文档补充 `01-product.md` 的用户画像与流程叙事，聚焦关键 UX 路径的步骤级描述。

## §1 主用户：团队 Tech Lead "李工"

见 `01-product.md §6.1`。

## §2 副用户：团队成员"小王"

见 `01-product.md §6.2`。

## §3 黄金路径叙事

见 `01-product.md §7`（路径 A / B / C）。

## §4 Welcome 4-step Bootstrap Flow

用户首次登录后，若 `bootstrap.completedAt` 为空，自动 redirect 到 `/welcome/step/1`，依序完成：

1. **Step 1 — Anthropic API Key**: 输入 `sk-ant-...` 格式密钥，加密存储至 `tenants.settings.bootstrap.anthropicKeyCiphertext`。
2. **Step 2 — GitHub App 安装**: 跳转外部安装链接后，点击"我已完成"，记录 `githubAppInstalled: true`。
3. **Step 3 — GitHub Repo**: 输入 `owner/repo` 格式，记录 `pendingRepoOwnerName`。
4. **Step 4 — Default Skills**: 选择导入 5 个默认 skill/rule/command/hint/hook，或跳过。完成后写入 `completedAt`，redirect 到 `/t/[slug]`。

每步均有 `ProgressCards` 侧边栏显示当前进度（idle / running / done 三态）。Layout guard 确保已完成用户不会再次进入 Welcome 流程（AC-01-04）。

> 实现参见 `packages/web/app/(welcome)/welcome/step/[n]/actions.ts`（slice 4.3）。

## §5 验收清单（V1.0 种子）

> 见 [00-README.md §验收清单约定](./00-README.md#验收清单约定acceptance-criteria)。

- [ ] **AC-06-01** `[Happy]`：首次登录用户访问 `/` → 自动 redirect `/welcome/step/1`
- [ ] **AC-06-02** `[Happy]`：4 步全部完成后 redirect `/t/[slug]`，再次访问 `/welcome` 自动 redirect 回 `/t/[slug]`
- [ ] **AC-06-03** `[Failure]`：中途刷新页面 → 保留已完成步骤状态，从中断步骤恢复
