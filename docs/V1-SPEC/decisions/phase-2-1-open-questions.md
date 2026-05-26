# Phase 2.1 Open Questions — 切片 1:`@honeyai/orchestrator`

> **来源**:Phase 2.0 merge 后(PR #6 → `61e345f`)切入切片 1 + 切片 4 并行准备阶段(2026-05-26)
> **当前状态**:**全部 10 项已拍板**(2026-05-26 用户 Option A 一次性默认通过)
> **门禁**:✅ 已解除 —— 切片 1 可进入 Superpowers writing-plans 阶段
> **后续变更**:任意已拍板项变更必须新建 ADR-0XX(自 ADR-032 起递增)

## 状态总览

### 切片 1 内子任务划分(已拍板)

| # | 子切片 | 范围 | 依赖 |
|---|---|---|---|
| 1.1 | 基础设施 + FSM 骨架 | error class enum / FSM switch reducer / TS factories / Run/Node 状态类型 | core(已并) |
| 1.2 | Node + Gate + IR 乐观锁 | Node 状态转移 / Gate approve-reject / `ir_documents.version` 乐观锁检查 | 1.1 |
| 1.3 | Reconcile + Redis 编辑锁 | setInterval reconcile / ioredis 客户端 / advisory lock / leader-election 接口预留 | 1.2 |
| 1.4 | 端到端 + SSE | BullMQ mock + `@testcontainers/redis` 并发 AC / SSE 事件类型 / 强抢 `ir.lock.changed` | 1.3 |

### 切片 1 留白(已拍板)

| # | 主题 | 拍板 | 关联 ADR |
|---|---|---|---|
| Q1 | Orchestrator FSM 范式 | **A — TypeScript exhaustive switch reducer** | ADR-027(待开,实施 PR) |
| Q2 | Fixture 格式 | **A — TS factories(`packages/orchestrator/src/test/fixtures.ts`)** | 无(实现细节) |
| Q3 | BullMQ mocking 策略 | **A — 内存 mock + 关键 AC 用真实 Redis(testcontainers)** | ADR-028(待开,实施 PR) |
| Q4 | Redis 客户端选型 | **A — `ioredis`** | 无(已是事实标准) |
| Q5 | Reconcile 触发机制 | **A — `setInterval` + leader-election 接口预留** | 无(实现细节) |
| Q6 | Error class enum 范围 | **A — spec 06 §retry 8 类严格枚举** | 无(spec 强约束) |
| Q7 | Gate UI 调用契约 | **A — orchestrator 暴露 service fn;web 包 Server Action 包装** | 无(分层共识) |
| Q8 | IR 编辑锁 TTL | **A — env `EDIT_LOCK_TTL_MS` 默认 300_000** | 无(配置项) |
| Q9 | 强抢 SSE 协议 | **A — 事件名 `ir.lock.changed`** | 无(spec 04 §11 扩展) |
| Q10 | 并发 AC 测试基础设施 | **A — `@testcontainers/redis`,仅 `*.redis.test.ts` 用** | ADR-028(待开,实施 PR) |

---

## 子切片 1.1 — 基础设施 + FSM 骨架

- **范围**:
  - `packages/orchestrator/src/errors.ts` — 8 类 retry-able / non-retry-able error class
  - `packages/orchestrator/src/fsm/run.ts` — Run 状态机(switch reducer)
  - `packages/orchestrator/src/fsm/node.ts` — Node 状态机(switch reducer)
  - `packages/orchestrator/src/test/fixtures.ts` — TS factory functions(`makeRun()` / `makeNode()` / `makeArtifact()`)
- **不含**:Gate 逻辑、Redis、BullMQ、reconcile
- **AC 范围**:Run 状态转移 happy + 8 个 retry 触发条件单测
- **预估 PR 体量**:~300 行(含测试)

## 子切片 1.2 — Node + Gate + IR 乐观锁

- **范围**:
  - Node 上 LLM / sandbox / gate 三类节点状态转移
  - Gate `approve` / `reject` 副作用(spec 05 §FSM)
  - `ir_documents.version` 乐观锁检查(读 → diff → INSERT next version → ON CONFLICT 抛 `version_conflict`)
- **不含**:Redis advisory lock(留给 1.3)、SSE 广播(留给 1.4)
- **AC 范围**:Gate 二选一覆盖 + IR 乐观锁冲突 happy + 重试

## 子切片 1.3 — Reconcile + Redis 编辑锁

- **范围**:
  - `ioredis` 客户端封装 + 健康检查
  - `acquireEditLock(runId, stage, userId, ttlMs)` / `releaseEditLock` / `forceUnlock`
  - Reconcile 循环:`setInterval(reconcile, RECONCILE_INTERVAL_MS)` + `LeaderElector` interface(MVP impl = "always-leader",留给 V1.0 替换)
- **不含**:SSE 协议(留给 1.4)、worker 进程封装(留给 `@honeyai/worker`)

## 子切片 1.4 — 端到端 + SSE

- **范围**:
  - BullMQ 内存 mock(`packages/orchestrator/src/test/mock-queue.ts`)
  - `@testcontainers/redis` 起容器仅 `*.redis.test.ts` 使用
  - SSE 事件类型:`ir.lock.changed` / `node.state.changed` / `run.state.changed`
  - 强抢锁端到端(用户 A 持锁 → 用户 B 强抢 → A 收 `ir.lock.changed` SSE)
- **AC 范围**:并发抢锁 happy + 锁丢失 UX 路径

---

## Q1. Orchestrator FSM 范式

候选:

- **A — TypeScript exhaustive switch reducer**:reducer 函数 `(state, event) => state`,`switch (event.type)` + `default: assertNever(event)` 强制覆盖
- B — xstate v5 actor model(完整 FSM 框架,体量大,学习曲线高)
- C — Class-based state pattern(每状态一个 class + transition method)

**拍板**:**A — switch reducer**(2026-05-26)
**理由**:Run/Node 状态机均为单向递进(<10 个状态 / 节点),不需要嵌套并行子机或 history;`assertNever` 编译期强制覆盖 + zero runtime deps,且 SSE 重放、reconcile diff 都比 xstate actor 模型更直观。
**风险**:未来如需 hierarchical FSM(嵌套子机),需要重构 —— 但 spec 05 明确不引入,V1 范围内无此需求。
**ADR**:ADR-027(实施 PR 内入档)

---

## Q2. Fixture 格式

候选:

- **A — TS factory functions**(`packages/orchestrator/src/test/fixtures.ts`):`makeRun(overrides?)` / `makeNode(overrides?)` 返回完整对象,IDE 跳转 + 类型提示满分
- B — YAML 文件 + 加载器:`fixtures/run-happy.yaml`,reader 函数解析
- C — JSON 文件 + 加载器

**拍板**:**A — TS factories**(2026-05-26)
**理由**:与 db 包 `packages/db/src/test/factories.ts` 已有模式一致;orchestrator 测试需要 partial override 高频,TS factory 的 `overrides?: Partial<T>` 模式最贴合。
**风险**:无。fixture 与产品代码同源,schema 变更编译报错。
**ADR**:无(实现细节)

---

## Q3. BullMQ mocking 策略

候选:

- **A — 内存 mock + 关键 AC 用真实 Redis(testcontainers)**:绝大多数测试用 `packages/orchestrator/src/test/mock-queue.ts` 内存 FIFO;并发 / 死锁 / 强抢类 AC 用 `*.redis.test.ts` 起 `@testcontainers/redis`
- B — 全用真实 Redis(慢 + CI 资源开销大)
- C — 全用 mock(覆盖不到 Redis 原子性 / advisory lock 语义)

**拍板**:**A — 双轨**(2026-05-26)
**理由**:速度 + 覆盖兼顾。spec 04 §11 强抢锁、spec 06 §retry 死锁恢复必须真实 Redis,其余业务逻辑 mock 即可。
**风险**:`*.redis.test.ts` 跑时间 > 5s 的会上升,接受。
**ADR**:ADR-028(实施 PR 内入档,与切片 1.4 一同落)

---

## Q4. Redis 客户端选型

候选:

- **A — `ioredis`**(事实标准,BullMQ 默认依赖,支持 cluster / sentinel / pipeline)
- B — `redis@4`(官方客户端,API 接近 ioredis 但生态使用较少)
- C — `node-redis@3`(legacy,已不再推荐)

**拍板**:**A — `ioredis`**(2026-05-26)
**理由**:BullMQ 内部就用 ioredis,装两个 client 同跑徒增冲突;ioredis 的 pipeline / Lua script API 对 advisory lock 实现最友好。
**风险**:无。
**ADR**:无(事实标准)

---

## Q5. Reconcile 触发机制

候选:

- **A — `setInterval` + leader-election 接口预留**:`packages/orchestrator/src/reconcile.ts` 内 `setInterval(reconcile, env.RECONCILE_INTERVAL_MS)`,通过 `LeaderElector` interface 抽象;MVP impl `AlwaysLeaderElector` 直接返回 true(单 worker 场景);V1.0 切换 Redis SETNX 选主
- B — node-cron + crontab 表达式(MVP 不需要 cron,过度设计)
- C — k8s CronJob(MVP 不在 k8s)

**拍板**:**A — setInterval + leader 接口**(2026-05-26)
**理由**:Phase 1 / Phase 2 均单 worker 部署,setInterval 足够;leader interface 预留是 V1.0 多 worker 的对接点,接口设计不影响 MVP 行为。
**风险**:setInterval 在长跑进程中累积 drift 微弱(< 1ms / hour),容忍。
**ADR**:无(实现细节)

---

## Q6. Error class enum 范围

候选:

- **A — spec 06 §retry 8 类严格枚举**:`llm_rate_limited` / `llm_quality_failed` / `sandbox_timeout` / `sandbox_oom` / `sandbox_died` / `sandbox_disk_full` / `external_failed` / `user_cancelled`
- B — 开放枚举 + `unknown` 兜底
- C — 自由 string + retry policy 查表

**拍板**:**A — 严格 8 类**(2026-05-26)
**理由**:spec 06 已明确 retry policy 与 8 类一一对应,运行时新增类必须改 spec + retry table,无中间灰度;`assertNever` 配合 switch reducer 编译期覆盖。
**风险**:无。如 V1 后期发现遗漏类,走 ADR 增加。
**ADR**:无(spec 强约束)

---

## Q7. Gate UI 调用契约

候选:

- **A — orchestrator 暴露 service functions;web 包用 Server Action 包装**:`orchestrator.approveGate(runId, nodeId, userId)` / `rejectGate(...)`,web 内 Server Action 一行透传
- B — orchestrator 暴露 REST endpoint(`POST /api/gate/approve`)
- C — orchestrator 暴露 tRPC procedure

**拍板**:**A — service fn + Server Action 透传**(2026-05-26)
**理由**:spec 02 §unified-nextjs(ADR-003)已明确不拆 API / Web;Server Action 直接 import orchestrator service fn 是 unified Next.js 的语义;不引 tRPC(详见 ADR-031)。
**风险**:无。
**ADR**:无(分层共识)

---

## Q8. IR 编辑锁 TTL

候选:

- **A — env `EDIT_LOCK_TTL_MS` 默认 300_000(5 分钟)**:与 spec 04 §11 "5min idle" 对齐;通过 env 可调
- B — 硬编码 300_000
- C — 写入 `tenants` 表配置(per-tenant 自定义,过度设计)

**拍板**:**A — env + 默认 300_000**(2026-05-26)
**理由**:env 可调便于 dev 短 TTL 调试(如 5_000 ms),prod 仍按 spec 默认;无需 per-tenant 灵活度。
**风险**:无。
**ADR**:无(配置项;`@honeyai/core/env` 增字段需走常规变更但不动 ADR)

---

## Q9. 强抢 SSE 协议

候选:

- **A — 事件名 `ir.lock.changed`**,payload `{ runId, stage, holderId, action: 'acquired' | 'released' | 'force_unlocked', forcedBy?: string }`
- B — 分两事件 `ir.lock.acquired` / `ir.lock.released`
- C — 仅广播 `version_changed` 不发锁事件

**拍板**:**A — 统一 `ir.lock.changed`**(2026-05-26)
**理由**:前端订阅一个事件名 + 用 action 字段分支即可;符合 spec 02 §7 "SSE 事件命名按资源 . 动作模式";B 的多事件名增加订阅复杂度。
**风险**:无。
**ADR**:无(spec 04 §11 扩展,实施 PR 同 patch spec)

---

## Q10. 并发 AC 测试基础设施

候选:

- **A — `@testcontainers/redis`,仅 `*.redis.test.ts` 文件用**:文件命名约定 + vitest config 拆分 project(`fast` / `redis`),CI 串行跑 redis project
- B — 全部测试都起 Redis 容器(慢 + 资源浪费)
- C — 用 ioredis-mock(不支持 Lua / WATCH,advisory lock 语义偏移)

**拍板**:**A — testcontainers + 文件命名约定**(2026-05-26)
**理由**:与 db 包 `@testcontainers/postgresql` 已有模式同构;`*.redis.test.ts` 命名约定使 IDE / CI 一眼可见慢测试范围。
**风险**:CI redis 容器拉取时间 ~5-10s 首次,后续 cached;接受。
**ADR**:ADR-028(实施 PR 内入档)

---

## 拍板流程

1. ✅ 2026-05-26 用户 Option A 一次性默认通过 10 项
2. 同 PR(本 PR `docs/phase-2-1-and-4-prep`)落 **ADR-027** + **ADR-028** 入档
3. ⛔ 门禁解除后 Superpowers writing-plans 进入切片 1.1 plan 阶段
4. 切片 1.1 → 1.2 → 1.3 → 1.4 顺序实施,每子切片独立 PR

---

## 不在切片 1 范围(显式排除)

- ❌ Claude Code CLI 接入(切片 2)
- ❌ sandbox 容器运行时(切片 2,采纳 ADR-020 本地 Docker)
- ❌ GitHub OAuth / App / PR 创建(切片 3)
- ❌ Next.js 任何代码(切片 4+)
- ❌ Tiptap 编辑器 / IR 编辑 UI(切片 4 / 5)
- ❌ 真实 LLM 调用(切片 2 起)
- ❌ ECS 部署 / k3s sandbox(V1.0)

切片 1 = orchestrator FSM + Gate + IR 乐观锁 + Redis 编辑锁 + reconcile + SSE 事件类型,**fixture 驱动,不接 LLM**。
