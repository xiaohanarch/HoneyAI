# ADR-017: 本地 Node 引擎上界放宽至 `>=22.11.0`（去掉 `<23` 上界）

- 状态: Accepted
- 日期: 2026-05-25

## Context

`ADR-008` + `phase-1-resolved-questions.md §A5` 锁定 **Node 22 LTS** 为 V1 运行时。Phase 1 plan §A1 初稿
root `package.json` 写：

```json
"engines": { "node": ">=22.11.0 <23" }
```

执行 A1 时本地开发机 Node 版本为 `v24.14.1`。`<23` 上界会让 pnpm 直接拒绝安装。

候选：
- **A**：开发者切到 Node 22.11.0（最严，与 spec 字面 1:1）
- **B**：放宽上界为 `>=22.11.0`，本地放行 Node ≥ 22.x（含 24.x）；CI 仍固定 22.11.0
- **C**：仅删除 `engines`（最松，无 floor 保护）

## Decision

选 **B —— 放宽上界为 `>=22.11.0`，去掉 `<23` 上界**。

生效约束：
- `package.json` 的 `engines.node` = `">=22.11.0"`
- CI workflow 仍固定 `node-version: '22.11.0'`（见 plan §K1），保证生产构建仍在 Node 22 LTS 上跑
- Dockerfile / k8s 镜像基础层最终也按 Node 22 LTS 走（Phase 2+ 落地）
- 本地放行 Node 24+ 仅为开发体验便利；任何"只在 Node 24 才能跑通"的写法**不允许进入仓库**
- 不锁上界的"代价归属"：开发者在 Node 24 上遇到行为差异时**必须自己回到 22 LTS 验证**，不准把"反正本地是 24"作为修复理由

## Consequences

- 正面:
  - 解除 Phase 1 A1 启动阻塞，开发者无需被迫切 Node 版本
  - 不影响生产 / CI（仍 22.11.0）
  - 与多数开源 Node 库的实际 `engines` 实践一致（很少锁严格上界）
- 负面:
  - 本地 vs CI 行为差异窗口扩大（Node 24 默认 ESM resolution / fetch / Web Streams 行为已有少量不兼容案例）
  - 偏离 `phase-1-resolved-questions.md §A5` 字面"Node 22 LTS"，需读者结合本 ADR 理解
- 后续影响:
  - 若 Phase 2+ 出现"本地 Node 24 能跑 / CI Node 22 不能跑"的真实事故 ≥ 2 次，触发 ADR-XXX 收紧回 `<23` + 强制 corepack/fnm
  - Tech Debt 不另立条目（保持 spec 表面一致性的成本 < 收益）

## Alternatives Considered

- **A**：开发者强制 Node 22.11.0 —— 与 spec 字面对齐最强，但每个新开发者首次 onboarding 都要装 fnm/nvm，摩擦高；无业务收益
- **C**：删 `engines` —— 失去 floor 保护，可能允许 Node 18 / 20 误入，与"V1 用 Node 22 LTS 的现代特性（fetch/Web Streams）"潜在冲突

## Related

- `ADR-008-phase-1-scope.md`（锁 Node 22 LTS）
- `docs/V1-SPEC/decisions/phase-1-resolved-questions.md §A5`
- `docs/superpowers/plans/2026-05-25-phase-1-monorepo-db-skeleton.md §A1`
- `CLAUDE.md` §Tech Stack —— Node 行同步 patch 为"Node 22 LTS（CI/Prod 固定 22.11.0；本地放行 ≥22.11.0，见 ADR-017）"
