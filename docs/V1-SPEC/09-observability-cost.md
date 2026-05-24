# 09 — Observability & Cost

## 1. 日志（Loki + Grafana）

### 1.1 架构
- Loki（OSS backend，无 InfluxDB / 无 Cassandra）
- promtail DaemonSet 收 Pod stdout/stderr
- 应用结构化 JSON 日志（pino）
- Grafana 数据源 Loki

### 1.2 日志字段约定
```json
{
  "ts": "...",
  "level": "info",
  "service": "web|worker|orchestrator|sandbox-runner",
  "tenant_id": "...",
  "user_id": "...",
  "run_id": "...",
  "node_id": "...",
  "trace_id": "...",
  "msg": "..."
}
```

### 1.3 保留 / 索引
- 保留 30 天（Loki S3 retention 自动 GC）
- Loki labels：service / tenant_id（其他靠 LogQL 全文）

## 2. 指标（VictoriaMetrics + prom-client）

### 2.1 架构
- VictoriaMetrics single-node
- prom-client 在 web/worker 暴露 /metrics
- vmagent 拉取
- Grafana 数据源 VictoriaMetrics

### 2.2 V1 必须指标
- HTTP req/sec, latency p50/p95/p99, error rate
- BullMQ job queue length / processing time
- Run 状态分布（pending / running / completed / failed）
- Node 失败率分类
- DB connection pool
- Sandbox Pod 数 / Pending 数 / OOM 数
- LLM 调用次数 / token 使用 / 平均延迟

## 3. Tracing
- V1.0 仅在日志带 `trace_id`，不接 Tempo
- V1.1 加 OpenTelemetry SDK + Tempo（见 TD-007）

## 4. Grafana 面板（V1.0 内嵌 3 张）

| 面板 | 内容 |
|---|---|
| QPS | HTTP 请求 / SSE 连接数 |
| 延迟 | p50/p95/p99 |
| 错误率 | 5xx + 4xx by route |

Grafana 嵌入 Next.js 通过 iframe（同域，admin 才可见）

## 5. 成本计量

### 5.1 数据模型
- `pricing_book` — 单价表（micro-USD）
- `cost_events` — 每次消费事件（详见 03-data-model §2.5）
- `run_cost_summary` — 物化视图（按 Run + tenant 汇总），每 5 分钟 REFRESH

### 5.2 micro-USD 设计
- bigint，单位 1e-6 USD
- 避免浮点累加误差
- 显示时除以 1e6 + 格式化（如 $0.0234）

### 5.3 成本事件来源

| Kind | provider | 计量时机 |
|---|---|---|
| llm_tokens | anthropic | sandbox-runner 收到 LLM response（带 usage） |
| github_api | github | github 包每次调用计数 |
| sandbox_compute | aliyun | worker 节点结束时按 (cpu·s + mem·GB·s) 计 |
| storage_write | aliyun | OSS PUT 计 |
| storage_stored | aliyun | 日 cron 扫存储计 |
| egress_bytes | aliyun | promtail 网络指标聚合（粗估） |

### 5.4 写时快照单价
- 写 cost_events 时把 pricing_book 当时的 unit_cost_micro_usd 拷过来
- 后续 pricing_book 变更不影响历史成本

### 5.5 预算
- 租户级月度预算（在 tenants 表 + 配置）
- 超额硬停：触发 80% / 100% 阈值
  - 80% → 顶部 banner 警告
  - 100% → 拒绝新 Run（弹窗提示）
- V1.0 不发邮件告警

### 5.6 成本面板（V1.0）
- Run 详情页顶部：本 Run 已花成本
- /t/<slug>/billing：
  - 本月已花 / 预算 / 剩余
  - 按 Run 列表（top 10 高耗）
  - 按 kind 饼图

### 5.7 不含（V1.0）
- 按 user 拆分
- 异常检测
- 预算告警邮件
- 历史趋势图

## 6. 失败也计入成本
- Run 失败 / 取消时已经消耗的 token 必须计入
- cost_events 不区分成功/失败
- run_cost_summary 显示总额

## 7. 数据保留

| 数据 | 保留 |
|---|---|
| Loki 日志 | 30 天 |
| VM 指标 | 90 天 |
| cost_events | 永久 |
| audit_log | 永久 |
| run_cost_summary | 与 runs 表同生命周期 |

## 8. 资源开销估算

| 组件 | RAM |
|---|---|
| Loki | ~300MB |
| VictoriaMetrics | ~300MB |
| Grafana | ~200MB |
| promtail (DaemonSet) | ~100MB |
| vmagent | ~100MB |
| **合计** | **~1GB** |

## 9. 告警
- V1.0 不配置告警规则
- 只在 Grafana 看板看
- V1.1 加 Alertmanager + 钉钉 webhook（见 TD-008）

## 10. trace_id 传播
- Server Action 创建 trace_id（uuid v7）
- 通过 SSE event metadata 透传
- worker 接 job 时继承
- sandbox-runner 收到后写入每条 JSONL event

## 11. Grafana 面板配置

### 11.1 仪表板 JSON（QPS）
```json
{
  "title": "HoneyAI QPS",
  "panels": [
    {
      "type": "timeseries",
      "title": "HTTP Req/s by route",
      "targets": [{
        "expr": "sum(rate(http_requests_total{service=\"web\"}[1m])) by (route)",
        "legendFormat": "{{route}}"
      }]
    },
    {
      "type": "timeseries",
      "title": "SSE 活跃连接数",
      "targets": [{ "expr": "sum(sse_active_connections)" }]
    }
  ]
}
```

### 11.2 延迟面板
```json
{
  "title": "Latency",
  "panels": [
    {
      "type": "timeseries",
      "title": "p50 / p95 / p99",
      "targets": [
        { "expr": "histogram_quantile(0.50, sum(rate(http_request_duration_seconds_bucket[1m])) by (le))", "legendFormat": "p50" },
        { "expr": "histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[1m])) by (le))", "legendFormat": "p95" },
        { "expr": "histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket[1m])) by (le))", "legendFormat": "p99" }
      ]
    }
  ]
}
```

### 11.3 错误率面板
```json
{
  "title": "Error Rate",
  "panels": [{
    "type": "timeseries",
    "title": "5xx + 4xx by route",
    "targets": [
      { "expr": "sum(rate(http_requests_total{status=~\"5..\"}[1m])) by (route)", "legendFormat": "5xx {{route}}" },
      { "expr": "sum(rate(http_requests_total{status=~\"4..\"}[1m])) by (route)", "legendFormat": "4xx {{route}}" }
    ]
  }]
}
```

## 12. prom-client 指标暴露

```ts
// packages/web/src/lib/metrics.ts
import { Counter, Histogram, Gauge, register } from 'prom-client'

export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'HTTP requests',
  labelNames: ['method', 'route', 'status'],
})

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request latency',
  labelNames: ['method', 'route'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
})

export const sseActiveConnections = new Gauge({
  name: 'sse_active_connections',
  help: 'Active SSE connections',
})

export const runStatusGauge = new Gauge({
  name: 'runs_by_status',
  help: 'Runs grouped by status',
  labelNames: ['status'],
})

export const nodeFailureCounter = new Counter({
  name: 'node_failures_total',
  help: 'Node failures by class',
  labelNames: ['failure_class'],
})

export const llmTokenCounter = new Counter({
  name: 'llm_tokens_total',
  help: 'LLM tokens used',
  labelNames: ['provider', 'model', 'kind'], // kind=input/output/cache_read
})

// app/api/metrics/route.ts
export async function GET() {
  return new Response(await register.metrics(), {
    headers: { 'content-type': register.contentType },
  })
}
```

## 13. 成本计算实例（黄金路径 A）

### 13.1 单 Run 成本构成
| 节点 | LLM 调用 | 输入 token | 输出 token | LLM 成本 (μUSD) | Sandbox 时长 | Sandbox 成本 (μUSD) |
|---|---|---|---|---|---|---|
| stage1.enrich | 1 | 4,200 | 800 | 14,400 | 30s | 67 |
| stage1.gate | 0 | — | — | 0 | (人在编辑，不计 sandbox 跑) | 0 |
| stage2.design | 1 | 6,000 | 1,400 | 22,200 | 45s | 100 |
| stage2.merge | 1 | 2,000 | 400 | 7,200 | 10s | 22 |
| stage2.gate | 0 | — | — | 0 | 0 | 0 |
| stage3.implement | 4 (T1-T4) | 18,000 | 3,200 | 66,000 | 180s | 400 |
| stage3.quality | 1 | 3,000 | 200 | 9,600 | 60s | 133 |
| stage3.pr | 1 | 500 | 100 | 1,800 | 15s | 33 |
| **合计** | **9** | **33,700** | **6,100** | **121,200** | **5.7 分钟** | **755** |

总成本 ≈ **121,955 μUSD ≈ $0.12**（接近黄金路径 A 预期 $0.15）

### 13.2 单价假设（pricing_book seed）
- claude-sonnet-4-6 input: 3 μUSD / 1K token → 3000 / 1M
- claude-sonnet-4-6 output: 15 μUSD / 1K token → 15000 / 1M
- sandbox: 2.22 μUSD / CPU·秒 + 1.11 μUSD / GB·秒 ≈ 4.44 μUSD/秒 (2C+2Gi)

### 13.3 cost_events 写入示例
```sql
-- 由 sandbox-runner 在收到 usage 事件后调用 worker → INSERT
INSERT INTO cost_events (id, tenant_id, run_id, node_id, kind, provider, sku,
                         quantity, unit_cost_micro_usd, total_micro_usd, occurred_at)
VALUES
  ('01HX...', :tenant, :run, :node, 'llm_tokens', 'anthropic',
   'claude-sonnet-4-6-input', 4200, 3, 12600, now()),
  ('01HX...', :tenant, :run, :node, 'llm_tokens', 'anthropic',
   'claude-sonnet-4-6-output', 800, 15, 12000, now());
```

### 13.4 预算执行（hard stop）
```ts
// packages/orchestrator/src/budget.ts
export async function checkBudget(tx: Tx, tenantId: string): Promise<BudgetStatus> {
  const tenant = await tx.query.tenants.findFirst({ where: eq(schema.tenants.id, tenantId) })
  if (!tenant?.budgetMicroUsdMonthly) return { status: 'ok' }

  const monthStart = startOfMonth(new Date())
  const [{ total }] = await tx.select({
    total: sql<bigint>`COALESCE(SUM(${schema.costEvents.totalMicroUsd}), 0)`,
  }).from(schema.costEvents)
    .where(and(
      eq(schema.costEvents.tenantId, tenantId),
      gte(schema.costEvents.occurredAt, monthStart),
    ))

  const ratio = Number(total) / Number(tenant.budgetMicroUsdMonthly)
  if (ratio >= 1.0) return { status: 'blocked', total, budget: tenant.budgetMicroUsdMonthly }
  if (ratio >= 0.8) return { status: 'warning', total, budget: tenant.budgetMicroUsdMonthly }
  return { status: 'ok', total, budget: tenant.budgetMicroUsdMonthly }
}

// createRun() 必须先调 checkBudget
// status='blocked' → throw BudgetExceededError → UI 弹窗
```

## 14. 物化视图刷新
```sql
-- 由 worker BullMQ 定时 job 每 5 分钟跑
REFRESH MATERIALIZED VIEW CONCURRENTLY run_cost_summary;
```

> ⚠️ CONCURRENTLY 要求物化视图有唯一索引：`CREATE UNIQUE INDEX ON run_cost_summary (tenant_id, run_id);`

## 15. 验收清单（V1.0 种子）

> 见 [00-README.md §验收清单约定](./00-README.md#验收清单约定acceptance-criteria)。

- [ ] **AC-09-01** `[Idempotency]` `[Cross-module]`：worker 对同一 `(run_id, node_id, attempt, event_kind)` 二次写 cost_event → 第二次 ON CONFLICT DO NOTHING，租户月度 total 不重复累加
- [ ] **AC-09-02** `[Boundary]` `[Failure]`：tenant 月度 cost 达 100% budget → `createRun()` 抛 `BudgetExceededError`，UI 弹窗 + 拒绝创建；降到 99% 后立即恢复
- [ ] **AC-09-03** `[Happy]` `[Boundary]`：tenant 月度 cost 跨过 80% 阈值 → 后续页面顶部 banner "本月已用 80% 预算"，仍允许创建 Run
