# 04 — IR Schemas

## 1. 存储格式

- 物理文件：Markdown + YAML frontmatter
- CAS：blob 按 sha256 存 OSS
- 索引：frontmatter 镜像到 `artifacts.metadata` JSONB
- 文件命名：`/workspace/.runs/<node-id>/<kind>.md`（sub-IR 用 `<kind>.<role>.md`）

## 2. RequirementIR（Stage 1 输出）

### 2.1 Frontmatter Schema (zod)
```ts
const RequirementIRSchema = z.object({
  title: z.string().min(1).max(200),
  one_liner: z.string().min(5).max(500),
  priority: z.enum(['P0', 'P1', 'P2', 'P3']),
  estimated_complexity: z.enum(['XS', 'S', 'M', 'L', 'XL']),
  in_scope: z.array(z.string()).min(1),
  out_of_scope: z.array(z.string()),
  success_criteria: z.array(z.string()).min(1),
  constraints: z.array(z.object({
    kind: z.enum(['tech', 'business', 'compliance', 'perf']),
    statement: z.string()
  })).default([]),
  risks: z.array(z.object({
    description: z.string(),
    likelihood: z.enum(['low', 'medium', 'high']),
    impact: z.enum(['low', 'medium', 'high']),
    mitigation: z.string().optional()
  })).default([]),
  impact_surface: z.array(z.string()).default([]),
  related: z.array(z.object({
    kind: z.enum(['issue', 'pr', 'doc']),
    url: z.string().url()
  })).default([])
})
```

### 2.2 Markdown 正文章节
- `## 背景` — 为什么要做
- `## 用户故事` — As a / I want / So that
- `## 验收标准明细` — 比 frontmatter.success_criteria 更详细
- `## 开放问题` — 待与人确认的疑问

## 3. DesignIR（Stage 2 输出）

### 3.1 Frontmatter Schema
```ts
const DesignIRSchema = z.object({
  approach_summary: z.string().min(20),
  architecture_decisions: z.array(z.object({
    id: z.string().regex(/^ADR-\d+$/),
    title: z.string(),
    context: z.string(),
    decision: z.string(),
    consequences: z.string(),
    alternatives_considered: z.array(z.string()).default([])
  })).default([]),
  affected_components: z.array(z.string()).min(1),
  data_model_changes: z.array(z.object({
    table: z.string(),
    change: z.enum(['add_table', 'add_column', 'alter_column', 'drop_column', 'add_index']),
    detail: z.string()
  })).default([]),
  api_changes: z.array(z.object({
    method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
    path: z.string(),
    change: z.enum(['add', 'modify', 'deprecate', 'remove']),
    detail: z.string()
  })).default([]),
  task_graph: z.object({
    nodes: z.array(z.object({
      id: z.string(),
      title: z.string(),
      kind: z.enum(['code', 'test', 'doc', 'migration']),
      estimated_effort_lines: z.number().int().positive()
    })),
    edges: z.array(z.object({
      from: z.string(),
      to: z.string()
    }))
  }),
  test_strategy: z.object({
    unit: z.array(z.string()),
    integration: z.array(z.string()),
    e2e: z.array(z.string())
  }),
  security_review: z.object({
    threats_considered: z.array(z.string()),
    mitigations: z.array(z.string()),
    requires_secrets: z.boolean()
  }),
  rollout: z.object({
    strategy: z.enum(['big_bang', 'feature_flag', 'gradual']),
    rollback_plan: z.string()
  })
})
```

### 3.2 task_graph 是 Stage 2 → Stage 3 的契约
- 必须机器可执行（节点 id 唯一，边无环）
- Stage 3 按拓扑序逐个节点跑 code/test/doc 任务
- task_graph 是核心字段，缺失或无效直接 Gate 失败

## 4. ImplementationIR（Stage 3 输出）

### 4.1 Frontmatter Schema
```ts
const ImplementationIRSchema = z.object({
  pr: z.object({
    title: z.string().max(72),
    body: z.string(),
    branch: z.string(),
    base: z.string().default('main'),
    draft: z.boolean().default(false)
  }),
  commits: z.array(z.object({
    sha: z.string().length(40),
    message: z.string(),
    files_changed: z.number().int().nonnegative()
  })),
  files_changed: z.array(z.object({
    path: z.string(),
    change: z.enum(['add', 'modify', 'delete', 'rename']),
    additions: z.number().int().nonnegative(),
    deletions: z.number().int().nonnegative()
  })),
  tests: z.object({
    added: z.array(z.string()),
    modified: z.array(z.string()),
    coverage_pct: z.number().min(0).max(100).optional()
  }),
  quality_gates: z.object({
    lint: z.enum(['pass', 'fail', 'skipped']),
    typecheck: z.enum(['pass', 'fail', 'skipped']),
    build: z.enum(['pass', 'fail', 'skipped']),
    security_scan: z.enum(['pass', 'fail', 'skipped']),
    findings: z.array(z.object({
      severity: z.enum(['low', 'medium', 'high', 'critical']),
      rule: z.string(),
      file: z.string(),
      line: z.number().int().positive(),
      message: z.string()
    })).default([])
  }),
  ai_self_review: z.object({
    confidence: z.enum(['low', 'medium', 'high']),
    known_limitations: z.array(z.string()),
    suggested_human_review: z.array(z.string())
  }),
  task_completion: z.array(z.object({
    task_id: z.string(),       // 引用 DesignIR.task_graph.nodes[].id
    status: z.enum(['done', 'partial', 'skipped']),
    notes: z.string().optional()
  })),
  links: z.object({
    pr_url: z.string().url().optional(),
    commit_urls: z.array(z.string().url()).default([])
  })
})
```

## 5. 校验时机（zod 校验在 3 个位置）

1. **Server Action saveArtifact()** — 用户编辑 Tiptap 后保存，校验失败拒绝并返回 error path
2. **Tiptap onChange debounced 500ms** — 实时高亮缺失字段（非阻断，仅警示）
3. **Agent 节点输出后** — sandbox-runner 收到 LLM 完整输出后校验，失败触发 llm_quality_failed 重试

## 6. 编辑器形态（Tiptap）

```
┌──────────────────────────────────────────┐
│ Frontmatter 表单（上半部）                 │
│ ─ title:        [______________]         │
│ ─ priority:     ( ) P0 ( ) P1 ...        │
│ ─ in_scope:     + 添加                   │
│ ─ ...                                    │
│ ─ [显示 YAML 源码] (折叠按钮)             │
├──────────────────────────────────────────┤
│ Markdown 富文本（下半部）                  │
│ ─ Tiptap + @tiptap/extension-markdown    │
│ ─ 工具栏：H1/H2/列表/代码块/引用          │
└──────────────────────────────────────────┘
[ 保存 ]  [ 通过 Gate ]
```

## 7. 跨阶段数据流

- Agent 节点对**上游 IR 只读**
- Gate 是**唯一允许人工编辑的时间窗口**
- sub-IR 命名 `<kind>.<role>.md`（如 `design.security.md`）
- merge 节点把 sub-IRs 合并产出最终 `<kind>.md`
- 失败节点 artifact 保留 `status: failed`，方便回看

## 8. 具体示例

### 8.1 RequirementIR 示例（黄金路径 A）
````markdown
---
title: 给 /health 端点添加 db/redis 状态返回
one_liner: GET /health 返回 200 + {db: ok/down, redis: ok/down}
priority: P2
estimated_complexity: XS
in_scope:
  - 修改 /health 路由
  - 加 db ping
  - 加 redis ping
  - 加单元测试
out_of_scope:
  - 鉴权
  - rate limit
  - 历史指标
success_criteria:
  - GET /health 始终返回 200
  - body 字段 db 和 redis 各自为 'ok' 或 'down'
  - db/redis 不可用时不抛 500
  - 测试覆盖率 >= 80%
constraints:
  - kind: tech
    statement: 必须复用现有 db.pool 和 redis.client，不要新建连接
  - kind: tech
    statement: 返回格式参考 k8s liveness probe 风格（短字符串）
risks:
  - description: redis 不可达时 ping 阻塞影响 /health 响应时间
    likelihood: medium
    impact: medium
    mitigation: ping 加 500ms 超时
impact_surface:
  - src/routes/health.ts
  - src/health/db_check.ts
  - src/health/redis_check.ts
  - tests/health.test.ts
related: []
---

## 背景
当前 /health 仅返回 200 OK 字符串，监控系统无法判断 db 和 redis 是否健康。
SRE 反馈需要细化健康状态。

## 用户故事
As a SRE 工程师
I want /health 返回结构化健康信息
So that 我能在监控面板分别看到 db/redis 状态

## 验收标准明细
1. 正常情况：`{db: 'ok', redis: 'ok'}` 200
2. db 挂：`{db: 'down', redis: 'ok'}` 200
3. redis 挂：`{db: 'ok', redis: 'down'}` 200
4. 都挂：`{db: 'down', redis: 'down'}` 200
5. db check 不超过 500ms
6. redis check 不超过 500ms
7. 总响应时间 < 1s

## 开放问题
- 是否需要返回版本号 / 启动时间？→ 暂不（out_of_scope）
````

### 8.2 DesignIR 示例（黄金路径 A，对应上面）
````markdown
---
approach_summary: |
  在 src/health/ 新增两个独立 check 模块（db_check.ts, redis_check.ts），
  各自封装 500ms 超时的 ping 函数。/health 路由 Promise.all 并发调用，
  结果合并返回。失败不抛错，统一返回 'down'。
architecture_decisions:
  - id: ADR-001
    title: 健康检查独立模块而非内联
    context: /health 路由原本只有 3 行
    decision: 拆出 src/health/ 目录，每个被检对象一个文件
    consequences: 文件变多但可测；后续加 kafka/s3 check 容易扩
    alternatives_considered:
      - 在 health.ts 内联，更短但不利扩展
affected_components:
  - src/routes/health.ts
  - src/health/db_check.ts (new)
  - src/health/redis_check.ts (new)
  - src/health/index.ts (new)
data_model_changes: []
api_changes:
  - method: GET
    path: /health
    change: modify
    detail: 响应体从 'OK' 字符串改为 JSON {db, redis}
task_graph:
  nodes:
    - id: T1
      title: 新增 src/health/db_check.ts
      kind: code
      estimated_effort_lines: 30
    - id: T2
      title: 新增 src/health/redis_check.ts
      kind: code
      estimated_effort_lines: 30
    - id: T3
      title: 修改 src/routes/health.ts 调用 check
      kind: code
      estimated_effort_lines: 20
    - id: T4
      title: 新增 tests/health.test.ts 覆盖 4 种状态组合
      kind: test
      estimated_effort_lines: 80
  edges:
    - { from: T1, to: T3 }
    - { from: T2, to: T3 }
    - { from: T3, to: T4 }
test_strategy:
  unit:
    - db_check 超时返回 'down'
    - redis_check 超时返回 'down'
  integration:
    - /health 端到端 4 种状态
  e2e: []
security_review:
  threats_considered:
    - 信息泄露：/health 是否泄露数据库类型/版本
  mitigations:
    - 只返回 ok/down，不含详细错误
  requires_secrets: false
rollout:
  strategy: big_bang
  rollback_plan: revert PR
---

## 设计正文

### 模块拆分
（详细说明）

### 错误处理策略
所有 check 函数实现 `() => Promise<'ok' | 'down'>`，内部 catch 全部异常返回 'down'。
````

### 8.3 ImplementationIR 示例（黄金路径 A）
````markdown
---
pr:
  title: "feat(health): 添加 db/redis 状态返回"
  body: |
    实现 RequirementIR #abc12 中的 /health 增强。

    - 新增 src/health/db_check.ts
    - 新增 src/health/redis_check.ts
    - 修改 /health 路由并发调用
    - 新增 4 个测试覆盖状态组合

    Closes #N/A
  branch: feat/health-detailed-status
  base: main
  draft: false
commits:
  - sha: a1b2c3d4e5f6789012345678901234567890abcd
    message: "feat(health): add db_check module"
    files_changed: 1
  - sha: b1c2d3e4f56789012345678901234567890abcde
    message: "feat(health): add redis_check module"
    files_changed: 1
  - sha: c1d2e3f456789012345678901234567890abcdef
    message: "feat(health): update route to return JSON"
    files_changed: 1
  - sha: d1e2f3456789012345678901234567890abcdef0
    message: "test(health): add 4-state coverage"
    files_changed: 1
files_changed:
  - path: src/health/db_check.ts
    change: add
    additions: 28
    deletions: 0
  - path: src/health/redis_check.ts
    change: add
    additions: 29
    deletions: 0
  - path: src/routes/health.ts
    change: modify
    additions: 18
    deletions: 3
  - path: tests/health.test.ts
    change: add
    additions: 85
    deletions: 0
tests:
  added:
    - tests/health.test.ts
  modified: []
  coverage_pct: 92
quality_gates:
  lint: pass
  typecheck: pass
  build: pass
  security_scan: pass
  findings: []
ai_self_review:
  confidence: high
  known_limitations:
    - redis_check 超时仅依赖 Promise.race，未取消底层连接
    - 测试用 mock，未跑真实 db/redis（依赖 testcontainers，本仓库未配置）
  suggested_human_review:
    - 确认 500ms 超时是否合理（根据 prod redis 延迟调整）
task_completion:
  - task_id: T1
    status: done
  - task_id: T2
    status: done
  - task_id: T3
    status: done
  - task_id: T4
    status: done
links:
  pr_url: https://github.com/user/repo/pull/42
  commit_urls:
    - https://github.com/user/repo/commit/a1b2c3d
---

## 实现摘要

按 DesignIR.task_graph 拓扑序完成 4 个任务。
所有 quality gates 通过。
````

## 9. zod 自动生成 Tiptap 表单

```ts
// packages/web/src/components/editor/SchemaFormGenerator.tsx
// 接收 zod schema → 递归渲染对应表单控件

function renderField(key: string, zType: ZodTypeAny): JSX.Element {
  if (zType instanceof ZodString) return <Input ... />
  if (zType instanceof ZodEnum) return <RadioGroup options={zType.options} />
  if (zType instanceof ZodArray) return <ArrayInput element={renderField(key, zType.element)} />
  if (zType instanceof ZodObject) return <NestedObject schema={zType.shape} />
  if (zType instanceof ZodNumber) return <NumberInput min={zType.min} max={zType.max} />
  // ...
}
```

## 10. 校验错误显示

zod 校验失败时返回 `{ path: ['task_graph','nodes',0,'id'], message: 'Required' }`，
Tiptap 在对应字段高亮 + 错误文案。Server Action 保存失败时整页 Toast。

## 11. IR 版本规则（人工编辑层）

### 11.1 存储模型
- IR markdown 文档**不进 OSS**，落 PostgreSQL `ir_documents` 表 TEXT 列（详见 03 §6.6b）
- 主键 `(run_id, stage, version)` — append-only INSERT，**不 in-place UPDATE**
- 当前版本查询：`SELECT ... ORDER BY version DESC LIMIT 1`，配复合索引 O(1)

### 11.2 版本号
- `version` = monotonic int，初始值 1
- save 触发 INSERT 新行，`version = COALESCE(MAX(version), 0) + 1`，由 server 在事务内分配
- 用户 UI 可见（"v3 → v4"），便于审计

### 11.3 乐观锁（保存冲突）
- 客户端必须带"当前 version"参数提交 save
- server 在事务内检查：若 `MAX(version) ≠ 客户端 version` → 返回 `IRVersionConflictError`，拒绝写入
- 配合 §11.4 编辑锁通常不会触发；触发即说明锁系统失效，UI 强制刷新

### 11.4 编辑锁（advisory）
- 进入编辑模式（点击 IR 区域 [编辑] 按钮）→ server 在 Redis `SETEX ir_lock:<run>:<stage> 300 <user_id>:<expires_at>`
- 5 分钟空闲 TTL；编辑器每 60s 发 keep-alive PATCH 续锁
- 离开编辑（保存 / 取消 / 关闭浏览器）→ server DEL key
- 第二人尝试编辑同一 IR → 看到 "李工正在编辑（剩余 04:32）"，按钮 [查看 / 等待 / 强抢]
- **[强抢] 必须二次确认**："强抢将让李工的未保存内容丢失，确认？"
- 强抢成功 → 旧锁持有者 UI 通过 SSE `ir.lock.changed` 事件收到通知，编辑器置只读
- 所有锁状态变化广播 SSE，全 tab 实时同步

### 11.5 失败场景
- IR 编辑提交时 zod 校验失败：不写 DB，返回字段路径错误（与 §10 一致）
- IR 编辑提交时持有锁过期且被他人抢占：返回 `IREditLockLostError`，UI 提示"编辑权已被强抢，您的内容已暂存为本地草稿"（仅浏览器 localStorage，不入 DB）

### 11.6 与 artifact 的语义对比
| 维度 | `ir_documents` | `artifacts` |
|---|---|---|
| 可变性 | append-only 版本流 | 写后不可变 |
| 编辑者 | 人（Gate 期） | 机器（sandbox 节点） |
| 存储 | PostgreSQL TEXT | OSS blob |
| 版本/重试语义 | `version`（用户改了几次） | `attempt`（节点重试第几次） |
| 锁 | Redis advisory lock | 无（写一次） |
| 删除 | 与 tenant 级联 | 与 tenant 级联（与 Run 同寿命） |

## 12. 验收清单（V1.0 种子）

> 见 [00-README.md §验收清单约定](./00-README.md#验收清单约定acceptance-criteria)。

- [ ] **AC-04-01** `[Happy]` `[Concurrency]`：用户保存 IR v3 → DB 新插入 `version=4` 行，原 v3 行保留不变；并发两人同时基于 v3 提交 → 后到者收到 `IRVersionConflictError`，DB 仅产生一个 v4
- [ ] **AC-04-02** `[Failure]`：RequirementIR frontmatter 缺少 `acceptance_criteria` 字段提交 → zod 校验失败，返回 422 + 字段路径 `acceptance_criteria: Required`，不写 DB
