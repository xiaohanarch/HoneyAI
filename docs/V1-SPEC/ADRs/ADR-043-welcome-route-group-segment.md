# ADR-043: Welcome 用 `(welcome)` route group + nested `welcome/` segment

- 状态: Accepted
- 日期: 2026-05-26

## Context

`app/(welcome)/page.tsx` 与 `app/page.tsx`(root `/`)存在路径冲突——同一 route group 内的 `page.tsx` 会占据 root segment。step URL 形态、`/welcome` 索引行为、tenant slug 解析来源、slug mismatch 处理策略、以及是否引入 `loading.tsx` 均需明确。

## Decision

采用 **P1 + I4 + S1 + G1 + V3 + LD1** 组合:

**G1 — route group 结构**:使用 `(welcome)` group 配合嵌套 `welcome/` segment 解决冲突。文件路径为 `app/(welcome)/welcome/page.tsx` 和 `app/(welcome)/welcome/step/[n]/page.tsx`,URL 路径为 `/welcome` 和 `/welcome/step/[n]`(n ∈ {1,2,3,4})。root `app/page.tsx` 保持现状不受影响。

**P1 — `/welcome/step/[n]` 动态 segment**:step 编号通过 `params.n` 读取,是 step 切换的唯一来源。

**I4 — `/welcome` 索引双向 redirect**:
- bootstrap 未完成 → redirect `/welcome/step/1`。
- bootstrap 已完成 → redirect `/t/[slug]/runs`。

**S1 — `getTenantBootstrap` 同时返回 `{ slug, bootstrap }`**:避免 slug 和 bootstrap 两次独立查询。

**V3 — slug mismatch redirect 到用户自己的 slug**:`t/[slug]/layout.tsx` 校验 URL slug 与 `session.tenantSlug` 不匹配时,redirect 到 `/t/{session.tenantSlug}/runs`,对用户友好(不返回 403)。

**LD1 — 不引入 `loading.tsx`**:action pending 状态由 `useActionState` 接管,`loading.tsx` 与之重复且切片 4.3 不需要 Suspense 边界优化。

## Consequences

**正面**:
- G1 结构让 root `/` 保持现状,welcome 路径完全独立,无路由冲突。
- V3 用户友好,避免用户因误改 URL slug 而卡在 403。
- `useActionState` pending 优于 `loading.tsx`,交互更精细。

**负面**:
- `(welcome)` group 嵌套 `welcome/` segment 的双层目录结构略显冗余,但这是 Next.js 解决 group + root 冲突的标准方式。
- slug mismatch redirect 会泄露用户自己的真实 slug(security trade-off,V1 可接受)。

**后续影响**:
- AC-01-12 slug mismatch redirect 是本决策的直接测试锚点(ADR-036)。
- `getTenantBootstrap` 返回 `{ slug, bootstrap }` 成为 bootstrap reader 的标准接口(ADR-040)。

## Alternatives Considered

- **P2 — 静态 `/welcome/step-1..4`**:4 个静态路由无法利用动态 param,代码重复且不利于循环处理。
- **P3 — query string**:URL 不表达层级语义,且 Next.js App Router 的 layout 嵌套无法基于 query 触发。
- **G2 — 干掉 group**:移除 `(welcome)` group 后无共享 layout,layout-level guard 失效。
- **V1 — 报 403**:用户体验差,且与 slug mismatch 属于导航错误而非权限错误的语义不符。

## Related

- 触发决策: `decisions/phase-2-4-3-open-questions.md §Q9`
- 关联 spec: 07-frontend.md §路由结构
- 关联 ADR: ADR-039(layout guard), ADR-040(bootstrap reader), ADR-036(AC-01-12)
