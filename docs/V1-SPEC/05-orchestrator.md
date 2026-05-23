# 05 — Orchestrator

## 1. Run 生命周期 FSM

```
created → scheduling → running → (paused_at_gate) → running → ... → completed
                                                                  ↘ failed
                                                                  ↘ cancelled
```

### 状态定义
- `created` — 已创建但 worker 还没接
- `scheduling` — worker 接到，正在 kubectl create Job
- `running` — sandbox pod 已 Ready，正在跑节点
- `paused_at_gate` — 当前节点是 Gate，等用户操作
- `completed` — Stage3 PR 创建成功，全流程结束
- `failed` — 任意节点失败 3 次重试仍失败
- `cancelled` — 用户主动取消

### 状态二元（重申 ADR-007）
`completed` 与 `failed` 互斥，不存在"部分完成"。

## 2. Node 生命周期 FSM

```
pending → running → (success | failed)
                       ↘ retry → running → ...
```

### Node 类型
- **agent** — 调 LLM (Claude Code CLI) 产出 artifact
- **gate** — 人工查看 + 通过
- **merge** — 合并多个 sub-IR
- **deploy** — Stage3 最后 git push + create PR

### Stage 节点拓扑（V1.0）

**Stage 1: 需求富化**
```
stage1.enrich (agent)
  → stage1.gate (gate, 编辑 RequirementIR)
```

**Stage 2: 设计与拆解**
```
stage2.design (agent)
  → stage2.security (agent, 并行 sub-IR)
  → stage2.merge (merge)
  → stage2.gate (gate, 编辑 DesignIR)
```

**Stage 3: 编码 + UT**
```
stage3.implement (agent, 按 task_graph 拓扑序在 sandbox 内多次 LLM 调用)
  → stage3.quality (agent, 跑 lint/typecheck/build/test)
  → stage3.pr (deploy, git push + gh pr create)
```

## 3. Gate 行为

### 3.1 进入 Gate
- 上游 agent 节点 success
- Run 状态切 `paused_at_gate`
- SSE 推送 `gate_opened` 事件 → UI 弹出编辑器

### 3.2 用户操作
- 编辑 IR → saveArtifact() → 新版本号
- 点 [通过 Gate] → passGate(version)
- 校验：当前 artifact version == passGate 时的 version_pinned（防并发覆盖）

### 3.3 Gate 通过校验
- 强制要求用户**至少打开**编辑器（前端记录 viewed_at）
- 不要求修改
- 未 viewed 直接点 [通过] → 拒绝 + 弹窗 "请先查看内容"

## 4. 重试机制

### 4.1 重试分类（与失败类对应）
| 失败类 | 自动重试 | 间隔 | 最大次数 |
|---|---|---|---|
| llm_rate_limited | ✅ | 指数 5s/30s/120s | 3 |
| llm_quality_failed | ✅ | 立即（带 schema 反馈给 LLM） | 3 |
| sandbox_timeout | ❌ | — | 0 (人工) |
| sandbox_oom | ❌ | — | 0 (人工) |
| external_failed | ✅ | 30s | 1 |
| user_cancelled | ❌ | — | 0 |

### 4.2 手动重试
- UI 按钮 [从此节点重试]
- 保留上游 artifact，从失败节点重新 enqueue
- 加 `node_retries` 行记录
- sandbox_oom 时允许选资源档（2Gi/4Gi/8Gi）

### 4.3 重试锁
- `job_locks` 表行级锁
- 同节点同时间只允许一个 retry 进行
- 后点击的用户看到 "节点已在重试中"

## 5. 并发模型

### 5.1 Run 级
- 同 tenant 同 repo **可以**并发跑多个 Run（每 Run 独立 sandbox pod）
- 上限受 k3s 资源 quota 自然限制（4 个并发 ≈ 8Gi）
- 不做 Run 队列；超资源直接 sandbox pod Pending

### 5.2 Run 内
- 单 Run 节点**串行**执行（同 sandbox pod 内 kubectl exec 多次）
- 例外：Stage2.security 与 Stage2.design 并行（V1 暂不实现，先串行）

### 5.3 IR 编辑
- Tiptap 编辑器**乐观锁**
- 保存时带 `if_version` 字段，冲突时弹窗
- V1 不做 CRDT 多人协同

## 6. Reconcile Loop

worker 每 5 分钟扫一次：
1. `runs WHERE status IN ('scheduling','running','paused_at_gate') AND updated_at < now() - 10min`
2. 检查对应 sandbox pod 状态
3. pod 不存在 → Run 标记 failed (sandbox_died)
4. pod Pending 超时 → Run 标记 failed (sandbox_timeout)
5. 触发对应失败 UX

## 7. 取消 Run
- 用户点 [终止 Run]
- Server Action cancelRun()
- enqueue worker job: killRun
- worker: kubectl delete Job → pod 立即 terminate
- 已花 token 计入 cost_events (不退款)

## 8. SSE 事件类型

```ts
type RunEvent =
  | { kind: 'run_created' }
  | { kind: 'run_status_changed', from, to }
  | { kind: 'node_started', node_id, node_kind }
  | { kind: 'node_progress', node_id, message }
  | { kind: 'node_finished', node_id, status }
  | { kind: 'gate_opened', node_id, artifact_id }
  | { kind: 'gate_passed', node_id, by_user }
  | { kind: 'artifact_created', artifact_id, kind }
  | { kind: 'cost_updated', total_micro_usd }
  | { kind: 'error', node_id, failure_class, message }
```

## 9. 数据写入路径

- 所有节点状态变更走 `db.transaction()`
- 在事务尾部 `pg_notify('run:<id>', json)` 触发 SSE
- artifact 写入：先 PUT OSS → 再 INSERT artifacts/artifact_blobs（事务）
- 失败保证：OSS 失败回滚事务；事务失败 OSS blob 由后台 GC 清理

## 10. FSM 转换表

### 10.1 Run FSM
| from | event | to | side effect |
|---|---|---|---|
| created | scheduleRun() | scheduling | enqueue worker, INSERT sandboxes |
| scheduling | sandboxReady | running | INSERT first node, kubectl exec |
| scheduling | sandboxPendingTimeout | failed (sandbox_timeout) | UPDATE runs status, pg_notify |
| running | nodeFinished (last node success) | completed | UPDATE finishedAt, totalCost rollup |
| running | nodeFinished (Gate kind) | paused_at_gate | open gate, pg_notify gate_opened |
| running | nodeRetryExhausted | failed (<failure_class>) | UPDATE runs status, pg_notify error |
| paused_at_gate | passGate() | running | enqueue advanceRun |
| paused_at_gate | cancelRun() | cancelled | kubectl delete Job |
| running | cancelRun() | cancelled | kubectl delete Job |
| (any non-terminal) | reconcileSweep (orphaned) | failed (sandbox_died) | UPDATE runs status |

### 10.2 Node FSM
| from | event | to | side effect |
|---|---|---|---|
| pending | startNode() | running | UPDATE startedAt, kubectl exec sandbox-runner |
| running | success | success | INSERT artifact, advance run.advanceRun |
| running | failure (class∈auto-retry) ∧ retry<3 | running | retry_count++, kubectl exec (with backoff) |
| running | failure (class∈auto-retry) ∧ retry≥3 | failed | UPDATE finishedAt, propagate to run |
| running | failure (class∈manual-only) | failed | UPDATE finishedAt, expose retry button |
| failed | retryNode(manual) | running | acquire job_locks row, kubectl exec |
| (any) | cancelRun() | skipped | UPDATE finishedAt |

### 10.3 Gate FSM
| from | event | to | side effect |
|---|---|---|---|
| (none) | nodeStart (Gate) | opened | INSERT gates row openedAt |
| opened | userViewedEditor | opened (+ viewedAt) | UPDATE viewedAt |
| opened | saveArtifact | opened | INSERT new artifact version |
| opened | passGate(version) ∧ viewedAt ∧ versionMatches | passed | UPDATE passedAt/By/pinnedArtifactId, advanceRun |
| opened | passGate(version) ∧ ¬viewedAt | (拒) | 弹窗 "请先查看内容" |
| opened | passGate(version) ∧ versionMismatch | (拒) | 弹窗 "他人已修改" |

## 11. 完整 SSE 事件示例

```typescript
// 流式输出节选（实际是 text/event-stream）

event: run_created
data: {"runId":"01HX...","tenantId":"01HX..."}

event: run_status_changed
data: {"runId":"01HX...","from":"created","to":"scheduling"}

event: node_started
data: {"nodeId":"01HX...","nodeKind":"agent","name":"stage1.enrich"}

event: node_progress
data: {"nodeId":"01HX...","kind":"thinking","content":"分析需求..."}

event: node_progress
data: {"nodeId":"01HX...","kind":"tool_call","tool":"Read","args":{"file_path":"README.md"}}

event: node_progress
data: {"nodeId":"01HX...","kind":"tool_result","tool":"Read","output_len":4523}

event: cost_updated
data: {"runId":"01HX...","totalMicroUsd":12340,"deltaMicroUsd":340}

event: artifact_created
data: {"artifactId":"01HX...","kind":"requirement_ir","version":1}

event: node_finished
data: {"nodeId":"01HX...","status":"success"}

event: gate_opened
data: {"nodeId":"01HX...","artifactId":"01HX...","artifactKind":"requirement_ir"}

event: gate_passed
data: {"nodeId":"01HX...","byUserId":"01HX...","pinnedVersion":2}

event: error
data: {"nodeId":"01HX...","failureClass":"llm_quality_failed","message":"task_graph 缺少 root","retryCount":3}

event: run_status_changed
data: {"runId":"01HX...","from":"running","to":"completed"}
```

### 11.1 客户端代码示例
```ts
// packages/web/src/lib/sse.ts
export function useRunStream(runId: string) {
  const setEvent = useRunStore(s => s.applyEvent)
  useEffect(() => {
    const es = new EventSource(`/api/runs/${runId}/stream`)
    const handlers = ['run_status_changed', 'node_started', 'node_progress',
                      'node_finished', 'gate_opened', 'gate_passed',
                      'cost_updated', 'artifact_created', 'error']
    handlers.forEach(kind => {
      es.addEventListener(kind, e => setEvent(kind, JSON.parse(e.data)))
    })
    return () => es.close()
  }, [runId])
}
```

## 12. 重试策略代码示意
```ts
// packages/orchestrator/src/retry/policy.ts
const POLICY: Record<FailureClass, { auto: boolean; max: number; backoffMs: number[] }> = {
  llm_rate_limited:    { auto: true,  max: 3, backoffMs: [5_000, 30_000, 120_000] },
  llm_quality_failed:  { auto: true,  max: 3, backoffMs: [0, 0, 0] }, // 立即重试，带 schema 反馈
  external_failed:     { auto: true,  max: 1, backoffMs: [30_000] },
  sandbox_timeout:     { auto: false, max: 0, backoffMs: [] },
  sandbox_oom:         { auto: false, max: 0, backoffMs: [] },
  sandbox_died:        { auto: false, max: 0, backoffMs: [] },
  sandbox_disk_full:   { auto: false, max: 0, backoffMs: [] },
  user_cancelled:      { auto: false, max: 0, backoffMs: [] },
}

export function shouldAutoRetry(klass: FailureClass, attempt: number): boolean {
  const p = POLICY[klass]
  return p.auto && attempt < p.max
}

export function nextBackoffMs(klass: FailureClass, attempt: number): number {
  return POLICY[klass].backoffMs[attempt] ?? 0
}
```

## 13. Reconcile Loop 伪代码
```ts
// packages/orchestrator/src/reconcile.ts
export async function reconcileLoop() {
  setInterval(async () => {
    const orphaned = await db.select().from(runs)
      .where(and(
        inArray(runs.status, ['scheduling', 'running', 'paused_at_gate']),
        lt(runs.updatedAt, sql`now() - interval '10 minutes'`),
      ))

    for (const run of orphaned) {
      const pod = await k8s.getPod(run.tenantId, run.id)
      if (!pod) {
        await markRunFailed(run.id, 'sandbox_died', 'Pod 不存在')
      } else if (pod.status === 'Pending' && pod.age > '15m') {
        await markRunFailed(run.id, 'sandbox_timeout', 'Pod 长时间 Pending')
      } else if (pod.status === 'Failed') {
        await markRunFailed(run.id, classifyPodFailure(pod), pod.message)
      }
    }
  }, 5 * 60 * 1000)
}
```
