# ADR-002: 实时通信用 SSE+POST 不用 WebSocket

- 状态: Accepted
- 日期: 2026-05-23

## Context
Run 执行过程需要实时推送给 UI：
- 节点状态变化（pending → running → completed）
- LLM token 流（grill chat / IR 富化对话）
- 进度日志 / artifact ready 通知
- 成本累计

候选传输：WebSocket / SSE+POST / 短轮询。

## Decision
选 **SSE（Server-Sent Events，下行）+ HTTP POST（上行）**。
- Run 订阅：`GET /api/runs/:id/stream`（EventSource）
- 用户操作（通过 Gate / 中断 / 编辑 IR）：POST Server Action
- 事件类型见 05-orchestrator §SSE event schema

## Consequences
- 正面:
  - 浏览器原生 EventSource，无需库
  - HTTP/2 多路复用即可（不需要 sticky session）
  - 反向代理（Ingress / Cloudflare）兼容性极好
  - 自动重连 + Last-Event-ID 恢复
  - Next.js Route Handler 直接 `Response(stream)` 实现
- 负面:
  - 单向（下行），上行另走 POST → 两个 endpoint
  - 浏览器对每域 EventSource 连接数有限（HTTP/1.1 ≤ 6，HTTP/2 无限制）→ V1 强制 HTTP/2
- 后续影响:
  - sse_active_connections 是关键指标（已在 prom-client 暴露）
  - 反代必须关闭 buffer（nginx `proxy_buffering off`）

## Alternatives Considered
- **WebSocket**: 双向，但需 sticky session、心跳、自实现重连、Next.js 原生不友好（需要单独 ws server）；V1 不需要双向流，复杂度过剩
- **短轮询**: 简单但浪费请求 + 延迟感差 + 服务端无法主动推；放弃
- **Long polling**: 介于两者间，但 SSE 已经更优，无理由选

## Related
- 05-orchestrator.md §SSE event schema
- 07-frontend.md §useRunStream hook
- ADR-003（Unified Next.js 保证 SSE 与 Server Action 同源）
