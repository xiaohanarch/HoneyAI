# ADR-003: Unified Next.js 不拆 API / Web

- 状态: Accepted
- 日期: 2026-05-23

## Context
V1 前端 + API 部署方案候选：
- A. Next.js（RSC + Server Actions + Route Handlers）单进程
- B. Next.js 纯 SSR + 独立 Node API（Express / NestJS / Hono）
- C. Next.js + Edge function 化 API

约束：单节点 ECS、4C/16G、团队人数少、要快上线。

## Decision
选 **A. Unified Next.js（App Router，Node runtime）**。
- 前端、Server Action（mutations）、Route Handler（SSE / webhooks / metrics）同一进程
- 与 worker（BullMQ）通过 Redis + Postgres 通信，不互相 HTTP 调用
- Edge runtime 不用（依赖 Node fs / process）

## Consequences
- 正面:
  - 无跨服务 CORS / auth token 传递问题
  - Server Action 直接复用 db / repo 层
  - 部署只一个 web Deployment + 一个 worker Deployment
  - 类型从 DB → API → 组件全链路 TS，无 OpenAPI codegen 步骤
- 负面:
  - web 进程同时承担 SSR + API，CPU/内存竞争
  - web 重启 = 全站短暂 503（V1 接受，单租户 + 灰度部署 + 健康检查兜底）
- 后续影响:
  - V1.x 若 SSE 连接数压力大，可拆 `packages/sse-gateway` 单独服务
  - prom-client 必须区分 RSC / Server Action / Route Handler 三类路由指标

## Alternatives Considered
- **B. Next.js + 独立 API**: 团队小、无必要早拆；放弃
- **C. Edge runtime API**: SSE 在 Edge 有 connection 时长限制 + sandbox-runner 必须 Node 调用；不适配
- **tRPC**: 也可选，但 Server Action 已经覆盖 mutations 场景，无需额外抽象

## Related
- 02-architecture.md §packages/web
- ADR-002（SSE+POST 同源）
