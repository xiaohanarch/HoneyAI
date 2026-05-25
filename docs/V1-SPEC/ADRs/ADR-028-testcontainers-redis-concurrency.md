# ADR-028: 并发 AC 测试用 `@testcontainers/redis`,仅 `*.redis.test.ts` 用

- 状态: Accepted
- 日期: 2026-05-26

## Context

切片 1 涉及 Redis advisory lock(spec 04 §11 IR 编辑锁)+ BullMQ 工作流。验收 AC 涉及多客户端并发抢锁 / 死锁恢复 / 强抢二次确认,需真实 Redis 语义(WATCH / Lua / SETNX);而绝大多数业务逻辑 reducer / Gate / Node 状态转移不需要 Redis。

候选:

- A — 双轨:绝大多数测试用内存 mock(`packages/orchestrator/src/test/mock-queue.ts`),并发 / 锁类 AC 用 `*.redis.test.ts` 文件 + `@testcontainers/redis`
- B — 全部测试都起 Redis 容器(慢 + CI 资源浪费)
- C — `ioredis-mock`(不支持 Lua / WATCH / 完整事务语义,advisory lock 行为偏移)

## Decision

选 **A — 双轨**。

- 命名约定:`*.redis.test.ts` 文件名后缀 = 需起 `@testcontainers/redis` 的测试
- vitest config 拆 project:`fast`(默认)与 `redis`(单独跑)
- CI 串行跑 `redis` project,本地开发可仅跑 `fast`
- mock 队列 `packages/orchestrator/src/test/mock-queue.ts` 实现 BullMQ 最小 API surface(`add` / `process` / `getJob`)

## Consequences

**正面**:
- 速度:`fast` project ~2-5s 跑完全部 reducer / Gate / Node 单测
- 覆盖:advisory lock + 强抢 + 死锁恢复用真实 Redis 语义验证
- 与 `@honeyai/db` `@testcontainers/postgresql` 模式同构,团队心智一致

**负面**:
- CI 首次拉 Redis 镜像 ~5-10s,后续 cached
- 两套测试基础设施(mock + real)需 sync 维护

**后续影响**:
- 切片 1.4 同时落入 `mock-queue.ts` 与首批 `*.redis.test.ts`
- 切片 5 SSE 端到端可复用 `*.redis.test.ts` 设施
- redis 镜像版本(`redis:7-alpine`)pin 在 `vitest.workspace.ts` testcontainer 配置内

## Alternatives Considered

- **B — 全真实 Redis**:CI 时间膨胀 3-5×,本地 vitest watch 启动延迟 > 5s,开发体验差
- **C — ioredis-mock**:advisory lock 依赖 SETNX + Lua,mock 实现不全;V1 AC 跑通 ≠ prod 跑通,与项目"不准用 pg-mem / SQLite in-memory"同质风险

## Related

- 触发决策:`decisions/phase-2-1-open-questions.md §Q3` + `§Q10`
- 关联 spec:04-ir.md §11 IR 版本规则
- 关联 ADR:ADR-013(drizzle-zod 同文件 re-export 等 db 测试基础设施),`@testcontainers/postgresql` 既有模式
