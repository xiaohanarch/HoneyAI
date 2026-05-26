# ADR-040: Bootstrap reader 用 React `cache()`

- 状态: Accepted
- 日期: 2026-05-26

## Context

`/t/[slug]/layout.tsx` 和各 step page 组件均需读取 `tenants.settings.bootstrap` 状态。若每个 Server Component 单独查询,同一请求内会产生多次重复 db 读取(N+1)。React 19 提供 `cache()` 函数用于 per-request 级别的函数调用去重。Server Action 写入后还需保证 cache 失效,否则下一请求可能读到过期状态。

## Decision

`getTenantBootstrap` 函数用 React `cache()` 包裹实现每请求 dedup:

```ts
export const getTenantBootstrap = cache(async (tenantId: string) => {
  // SELECT settings FROM tenants WHERE id = $1 (withTenant proxy)
  return { slug: string, bootstrap: TenantBootstrapState | null }
})
```

定义于 `packages/web/lib/bootstrap/read.ts`。

**Server Action 写入后调用 `revalidatePath('/t/[slug]', 'layout')` 进行防御性失效**,保证下一请求重新读取最新 jsonb 状态。

**接受 B1 — N+1 策略**:每次 `getTenantBootstrap` 调用为单独 PG SELECT,响应时间 < 1ms,V1 无需 JOIN 优化。

`cache()` 仅 per-request 范围,不跨请求共享;V1 不引入 `unstable_cache`(跨请求共享的 Next.js 缓存)。

## Consequences

**正面**:
- 同一请求内(layout + page 等多次 RSC 渲染)自动 dedup,无重复 db 查询。
- `cache()` 是 React 19 官方推荐的 RSC dedup 方案,无额外依赖。
- `revalidatePath('layout')` 失效粒度精确,避免全页面 revalidate。

**负面**:
- `cache()` 仅 per-request,跨请求不共享;高并发下仍是每请求一次 PG 查询。
- 若忘记在某个 Server Action 后调用 `revalidatePath`,可能读到过期状态(防御性而非强制)。

**后续影响**:
- 如果 V2 出现性能瓶颈,可升级为 `unstable_cache` + 显式 tag revalidation。
- `getTenantBootstrap` 是 layout guard(ADR-039)和 page 组件的共同依赖,接口稳定后不应随意变更。

## Alternatives Considered

- **D2 — 显式传参**:需要从 layout 向所有子 page 手动传递 bootstrap 对象,prop drilling 严重且 RSC 不支持跨 segment 传参。
- **`unstable_cache`(跨请求共享)**:V1 bootstrap 状态变更频率低但数据量小,无需跨请求共享;且 unstable API 稳定性风险。

## Related

- 触发决策: `decisions/phase-2-4-3-open-questions.md §Q7`
- 关联 spec: 02-architecture.md §data-access, 07-frontend.md §RSC fetch 边界
- 关联 ADR: ADR-039(guard 形态), ADR-031(RSC + Server Action), ADR-046(TenantBootstrapState shape)
