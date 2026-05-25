# ADR-031: Web 数据获取用 RSC + Server Action,不引 tRPC / TanStack Query

- 状态: Accepted
- 日期: 2026-05-26

## Context

`@honeyai/web` 是 unified Next.js 15 App Router(ADR-003 已锁定不拆 API / Web)。客户端 / 服务端数据获取层选型,候选:

- A — RSC(server fetch / drizzle 直读)+ Server Action(mutation),不引 tRPC / TanStack Query
- B — tRPC(端到端类型安全 RPC,过度抽象,unified Next.js 内收益弱)
- C — REST API routes + TanStack Query(典型 client-only 架构,违背 unified Next.js 意图)

## Decision

选 **A — RSC + Server Action**。

- 查询(`GET`):Server Component 直接 `await db.query.runs.findMany({...})`(配合 `withTenant` 中间件)
- 变更(`POST` / `PUT` / `DELETE`):`'use server'` Server Action,RHF `formAction` 或 `useTransition` 触发
- 实时数据(SSE):走 ADR-002 路径,client-side `EventSource` 订阅,与数据获取层正交
- 局部 client mutation 状态:`useTransition` / `useOptimistic`(React 19 内置)
- 不引入 tRPC / TanStack Query / SWR

## Consequences

**正面**:
- 与 ADR-003 unified-nextjs 哲学完全一致(无重复抽象层)
- 类型安全由 Drizzle schema + zod + Server Action 函数签名端到端保证,与 tRPC 等价
- 包体积最小(0 byte 额外 client JS)
- RSC 静态优化 / Server Action 直读直写 → DB 是最短路径

**负面**:
- 失去 TanStack Query 的 client 缓存 / refetch interval / mutation queue 等便利
- 任何需要 client polling 的场景需手写 `setInterval` + `useEffect`(V1 仅 SSE 长流,无 polling)
- React 19 `useOptimistic` API 相对新,文档密度低

**后续影响**:
- 切片 4 起所有数据 fetch / mutation 严格遵循此模式
- 切片 5 SSE 与 Server Action 配合:用户 approve Gate → Server Action 写 db → orchestrator 发 SSE 事件 → client `EventSource` 收到刷新 UI
- 切片 5 Gate UI 调用 orchestrator service fn(`decisions/phase-2-1-open-questions.md §Q7`)即 Server Action 内一行透传

## Alternatives Considered

- **B — tRPC**:unified Next.js 内 client → server 调用本就同进程,tRPC procedure 多一层 wrapper 而无额外类型 / 校验收益;Server Action 已是 React 一等公民
- **C — REST + TanStack Query**:client-only 架构与 RSC 矛盾;`/api/*` route 重复 Server Action 已能做的事

## Related

- 触发决策:`decisions/phase-2-4-open-questions.md §Q12`
- 关联 spec:02-architecture.md §unified-nextjs
- 关联 ADR:ADR-002(SSE 不用 WS),ADR-003(unified Next.js)
