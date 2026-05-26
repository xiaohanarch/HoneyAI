# ADR-046: `TenantBootstrapState` 6 字段形状

- 状态: Accepted
- 日期: 2026-05-26

## Context

切片 4.3 需要在 `tenants.settings` jsonb 的 `bootstrap` 子键内持久化 Welcome 4 步状态。Q11 对 4 步表单字段细节做出了全面决策,需要将 GitHub App 判定方式(checkbox)、repo 输入形态(单字段)、Step 4 跳过状态(enum)、以及 `completedAt` 语义等决策落实为 TypeScript 类型定义,并确认 `@honeyai/db` 的类型注解策略。

## Decision

采用 **SP1 — `TenantBootstrapState` 6 字段 shape**,全部字段 optional:

```ts
type TenantBootstrapState = {
  anthropicKeyCiphertext?: string   // Step 1:加密后的 Anthropic API key(ADR-034 v1:base64)
  githubAppInstalled?: boolean       // Step 2:用户 checkbox 确认已安装 GitHub App
  githubAppMarkedAt?: string         // Step 2:ISO 8601 时间戳,记录安装确认时间
  pendingRepoOwnerName?: string      // Step 3:格式 "owner/name"(ADR-047 regex 校验)
  defaultSkillsApplied?: 'skipped' | 'imported'  // Step 4:SK2 enum 语义
  completedAt?: string               // Step 4 完成:ISO 8601 时间戳,truthy = bootstrap done
}
```

`completedAt` 是布尔等价的 truthy 标记:存在即表示 bootstrap 完成,guard 函数检查 `bootstrap.completedAt != null`。

**无 SQL migration**:按 Q11 O1 用户确认,`bootstrap` 作为嵌套子键存于已有 `tenants.settings` jsonb 列,仅需在 `@honeyai/db` 的 `tenants` schema 上加 `.$type<TenantSettings>()` TypeScript 注解。`TenantSettings` 扩展为 `{ bootstrap?: TenantBootstrapState; budget?: unknown }`。

**SP1 — 仅 Step 4 可跳过**:Step 1-3 字段为必填流程(form action 校验),Step 4 提供 import/skip 二选一(M-B)。

## Consequences

**正面**:
- 全 optional 字段支持断点续传(ADR-032 Q2),任意步骤完成即持久化。
- `pendingRepoOwnerName` 避免 `repositories.installationId NOT NULL` 阻塞(slice 3 GitHub App 接入后再落真表)。
- SK2 enum `'skipped' | 'imported'` 比布尔有更强的语义表达能力。

**负面**:
- 6 个 optional 字段意味着 guard 函数需要逐字段检查,不能依赖非 null 断言。
- `pendingRepoOwnerName` 是临时字段,slice 3 后需 migration 迁移到 `repositories` 表。

**后续影响**:
- slice 3 GitHub App 落地后,`pendingRepoOwnerName` → `repositories` 行的迁移脚本需新建 ADR。
- `budget` 子键预留空位,Phase 3 填充时扩展 `TenantSettings` 类型。

## Alternatives Considered

- **SK1 — nullable 布尔**:布尔无法区分"主动跳过"和"未到达 Step 4"两种 null 状态,语义模糊。
- **SK3 — 计数列**:对 5 个固定 seed 的计数无实际意义,过度设计。
- **SQL migration 增加新列**:slice 4.3 不做 migration,减少 PR 风险面,jsonb 子键足够(用户 O1 已确认)。

## Related

- 触发决策: `decisions/phase-2-4-3-open-questions.md §Q11`
- 关联 spec: 03-data-model.md §tenants.settings
- 关联 ADR: ADR-032(jsonb 持久化策略), ADR-034(key 加密), ADR-047(字段 regex 校验)
