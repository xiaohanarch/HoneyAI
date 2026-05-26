# ADR-039: Bootstrap 校验放在 layout 而非 middleware

- 状态: Accepted
- 日期: 2026-05-26

## Context

`/t/[slug]/layout.tsx` 当前是 stub,需要在合适层级实施 bootstrap 完成状态校验(guard)。候选位置有 middleware(全局)、layout(路由 group 级)、page(单页级)三种。同时 `/welcome` 路由也需要"反向 guard"——防止已完成 bootstrap 的用户重复进入 wizard。

## Decision

选 **L2 — layout-level guard helper**:

- `app/(welcome)/layout.tsx`:调用 `requireBootstrapIncomplete(tenantId)`;bootstrap 已完成则 redirect `/t/[slug]/runs`,防止用户回到 wizard。
- `app/t/[slug]/layout.tsx`:调用 `requireBootstrapComplete(tenantId)`;bootstrap 未完成则 redirect `/welcome/step/1`。

guard helper 定义于 `packages/web/lib/bootstrap/guard.ts`,暴露两个异步函数,内部读取 `getTenantBootstrap`(见 ADR-040)。

slice 4.5 才在 middleware 加全局兜底,切片 4.3 不触碰 middleware。

**tenantId 来源策略(TS-C)**:
- `/welcome` 路由:tenantId 从 session 取(URL 无 slug)。
- `/t/[slug]/layout.tsx`:从 URL segment 取 slug,再与 session.tenantSlug 做校验(slug mismatch 见 ADR-043)。

## Consequences

**正面**:
- layout-level 是 Next.js 15 守卫模式标准位,与 App Router 嵌套路由结构对齐。
- `(welcome)/layout.tsx` 反向 guard 防止已完成用户重复填写(幂等语义)。
- 不修改 middleware 降低切片 4.3 全局影响面。

**负面**:
- middleware 缺席期间(切片 4.3–4.4),存在 layout guard 被绕过的理论风险(直接访问 page 路由但无 layout)。
- 切片 4.5 补全 middleware 后,layout guard 和 middleware 存在短暂重叠,需 ADR-049+ 协调。

**后续影响**:
- 切片 4.5 全局 middleware 落地后,layout guard 可保留作为深度防御层,或降级为 assert-only。
- `requireBootstrapComplete` 和 `requireBootstrapIncomplete` 是 AC-01-03/04 的实现锚点。

## Alternatives Considered

- **L1 — middleware**:切片 4.3 还未规划 middleware,贸然引入影响面过广;且 middleware 无法直接调用 db。
- **L3 — page-level**:每个 page 重复校验逻辑,违反 DRY;layout 天然共享。

## Related

- 触发决策: `decisions/phase-2-4-3-open-questions.md §Q7`
- 关联 spec: 07-frontend.md §路由守卫
- 关联 ADR: ADR-040(Bootstrap reader cache), ADR-043(slug mismatch), ADR-036(AC-01-03/04)
