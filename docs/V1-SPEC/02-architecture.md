# 02 — Architecture

## 1. 总架构图（V1）

```
                ┌───────────────────────────────────────────┐
                │              用户浏览器                    │
                └────────┬──────────────────────┬───────────┘
                         │ HTTPS                │ SSE
                ┌────────▼──────────────────────▼───────────┐
                │   Next.js 15 App Router (packages/web)    │
                │   - RSC + Server Actions                  │
                │   - SSE 端点 /api/runs/<id>/stream        │
                │   - Tiptap 编辑器 / shadcn 组件           │
                └────────┬──────────────────────┬───────────┘
                         │                      │
              ┌──────────▼──────────┐   ┌───────▼──────────┐
              │  PostgreSQL (CNPG)  │   │  Worker (BullMQ) │
              │  - Drizzle ORM      │   │  packages/worker │
              │  - LISTEN/NOTIFY    │   │  - Run reconcile │
              │  - JSONB / BRIN     │   │  - Cost rollup   │
              └──────────┬──────────┘   └────────┬─────────┘
                         │                       │
                         │            ┌──────────▼────────────┐
                         │            │  Orchestrator         │
                         │            │  packages/orchestrator│
                         │            │  - Run/Node FSM       │
                         │            │  - Gate / Retry       │
                         │            └──────────┬────────────┘
                         │                       │ kubectl exec
                         │            ┌──────────▼────────────┐
                         │            │  Sandbox Pod (per Run)│
                         │            │  - sleep infinity     │
                         │            │  - sandbox-runner CLI │
                         │            │  - Claude Code CLI    │
                         │            └─────┬─────────┬───────┘
                         │                  │         │
                         │           ┌──────▼──┐  ┌───▼──────┐
                         │           │ GitHub  │  │Anthropic │
                         │           │ API     │  │API       │
                         │           └─────────┘  └──────────┘
                         │
              ┌──────────▼──────────────────┐
              │ Object Storage (Aliyun OSS) │
              │  - CAS artifact files       │
              │  - Loki backend             │
              │  - CNPG backup              │
              └─────────────────────────────┘

观测：Loki (日志) + VictoriaMetrics (指标) + Grafana (面板)
入口：cert-manager + Let's Encrypt + Traefik (k3s 内置)
网络：Cilium L7 FQDN 白名单（sandbox 出网限制）
```

## 2. Monorepo 结构

```
D:\code\ai-devops\
├── legacy/                  ← 原 HTML 原型（视觉参考，不进生产构建）
├── packages/
│   ├── core/                ← 共享类型、常量、zod schema、错误类
│   ├── db/                  ← Drizzle schema + 迁移 + repository
│   ├── orchestrator/        ← Run/Node FSM、Gate、重试、reconcile
│   ├── adapter-claude/      ← Claude Code CLI 适配器（V1 默认）
│   ├── adapter-opencode/    ← opencode CLI 适配器（代码存在但 build-time 不上线）
│   ├── github/              ← GitHub App + OAuth + API 客户端
│   ├── web/                 ← Next.js 15 主应用
│   ├── worker/              ← BullMQ worker 进程（reconcile/cost rollup）
│   └── sandbox-runner/      ← Sandbox 内 Node CLI（stream-json → 标准 JSONL）
├── infra/
│   ├── k8s/                 ← Kustomize manifests (base + overlays)
│   ├── docker/              ← Dockerfile.web / Dockerfile.worker / Dockerfile.sandbox
│   ├── bootstrap/           ← 01-host.sh / 02-services.sh
│   └── migrations/          ← Drizzle generated SQL
├── docs/V1-SPEC/            ← 本文档
├── package.json             ← pnpm workspace root
├── pnpm-workspace.yaml
└── turbo.json               ← Turborepo
```

## 3. 包职责矩阵

| Package | 职责 | 依赖 |
|---|---|---|
| core | zod schemas, error classes, constants | (无) |
| db | Drizzle schemas, migrations, repos, transaction helper | core |
| orchestrator | Run/Node FSM, Gate, retry, reconcile loop | core, db, github, adapter-claude |
| adapter-claude | exec Claude Code CLI, parse stream-json | core |
| adapter-opencode | exec opencode CLI（V1 不上线） | core |
| github | App auth, OAuth, REST/GraphQL client, webhook verify | core |
| web | Next.js UI + Server Actions + SSE endpoints | core, db, orchestrator, github |
| worker | BullMQ jobs: reconcile / cost rollup / asset sync | core, db, orchestrator, github |
| sandbox-runner | 沙箱内 Node CLI, 译 stream-json → JSONL events | core |

## 4. 数据流

### 4.1 创建 Run
```
浏览器 [新建 Run]
  → Server Action createRun()
  → INSERT runs / artifacts (input)
  → enqueue worker job: scheduleRun
  → SSE 推送 run_created
worker [scheduleRun]
  → kubectl create Job (sandbox pod)
  → 等 pod Ready
  → INSERT nodes (stage1.enrich)
  → kubectl exec sandbox-runner → run claude-code
  → 收集 JSONL events → INSERT events / artifacts
  → 节点结束 → 推进 Gate / 下一节点
```

### 4.2 Gate 通过
```
用户编辑 IR (Tiptap)
  → Server Action saveArtifact() 校验 zod schema → INSERT artifacts (new version)
用户点 [通过 Gate]
  → Server Action passGate()
  → UPDATE gates SET passed_at, passed_by
  → enqueue worker: advanceRun
worker [advanceRun]
  → kubectl exec sandbox-runner → 下一节点
```

### 4.3 实时推送
```
worker / orchestrator
  → pg_notify('run:<id>', json)
Next.js SSE endpoint /api/runs/<id>/stream
  → pg LISTEN 'run:<id>'
  → SSE event 推浏览器
浏览器 EventSource
  → 更新 Zustand store → UI 实时刷新
```

## 5. 运行时拓扑（生产）

```
┌─────────── Aliyun ECS 4C/16G ─────────────┐
│ k3s server (single node)                  │
│ ┌─────────────────────────────────────┐   │
│ │ namespace: honeyai                  │   │
│ │  - web (×2, distroless ~130MB)      │   │
│ │  - worker (×1)                      │   │
│ │  - postgres (CNPG cluster, ×1)      │   │
│ │  - loki + victoriametrics + grafana │   │
│ │  - sandbox pods (per Run, on-demand)│   │
│ │  - github-runner (self-hosted)      │   │
│ └─────────────────────────────────────┘   │
│ cilium (CNI + L7 NetworkPolicy)           │
│ cert-manager + Let's Encrypt              │
│ traefik (k3s 内置 ingress)                 │
└───────────────────┬───────────────────────┘
                    │
            ┌───────▼───────┐
            │ Aliyun OSS    │
            │ (private)     │
            └───────────────┘
```

资源预算：
- web/worker/postgres/observability ≈ 8GB RAM
- 单 sandbox Run 默认 2C/2Gi（最大 4 个并发 → 8Gi）
- 余量 ≈ 0.5-1GB

## 6. 关键 ADR 索引
- ADR-001 选 Drizzle 不选 Prisma
- ADR-002 SSE+POST 不选 WebSocket
- ADR-003 Unified Next.js 不选 split API
- ADR-004 kubectl exec 长跑 pod（V1 妥协，V2 改 Argo Workflows）
- ADR-005 ghcr.io only 不选 ACR
- ADR-006 Bootstrap UX 4 步必填
- ADR-007 Run 状态二元

## 7. 关键时序图

### 7.1 创建 Run + Stage1 跑通
```
浏览器              web (Next.js)         worker          orchestrator        sandbox Pod
   │                    │                   │                  │                  │
   │ POST /runs/new      │                   │                  │                  │
   ├───────────────────>│                   │                  │                  │
   │                    │ INSERT runs       │                  │                  │
   │                    │ INSERT artifact   │                  │                  │
   │                    │ enqueue scheduleRun                  │                  │
   │                    │  ─────────────────>│                 │                  │
   │ 200 redirect /runs/<id>                 │                  │                  │
   │<───────────────────│                   │                  │                  │
   │ GET /api/runs/<id>/stream (SSE)        │                  │                  │
   ├───────────────────>│                   │                  │                  │
   │                    │ LISTEN run:<id>   │                  │                  │
   │                    │                   │ kubectl create Job                 │
   │                    │                   ├──────────────────┼─────────────────>│
   │                    │                   │                  │ Pod Ready        │
   │                    │                   │ pg_notify         │                  │
   │                    │<──────────────────│                  │                  │
   │ SSE: run_status:running                │                  │                  │
   │<───────────────────│                   │                  │                  │
   │                    │                   │ INSERT nodes(stage1.enrich)         │
   │                    │                   │ kubectl exec → sandbox-runner       │
   │                    │                   ├──────────────────┼─────────────────>│
   │                    │                   │                  │ claude-code      │
   │                    │                   │ stream events (stdout JSONL)        │
   │                    │                   │<─────────────────┼──────────────────│
   │                    │                   │ INSERT events    │                  │
   │                    │                   │ pg_notify        │                  │
   │ SSE: node_progress (×N)                │                  │                  │
   │<───────────────────│                   │                  │                  │
   │                    │                   │ INSERT artifact (RequirementIR)     │
   │                    │                   │ UPDATE nodes status=success         │
   │                    │                   │ INSERT nodes(stage1.gate)           │
   │                    │                   │ UPDATE runs status=paused_at_gate   │
   │ SSE: gate_opened   │                   │                  │                  │
   │<───────────────────│                   │                  │                  │
   │ (UI 打开 Tiptap)    │                   │                  │                  │
```

### 7.2 Gate 通过 + 下一节点
```
浏览器              web                worker          orchestrator     sandbox Pod
   │ 编辑 IR              │                  │                 │                │
   │ POST saveArtifact   │                  │                 │                │
   ├───────────────────>│                  │                 │                │
   │                    │ INSERT artifact(v2)                 │                │
   │ 200 {version: 2}    │                  │                 │                │
   │<───────────────────│                  │                 │                │
   │ POST passGate v2    │                  │                 │                │
   ├───────────────────>│                  │                 │                │
   │                    │ UPDATE gates set passed_at = now    │                │
   │                    │ enqueue advanceRun                  │                │
   │                    │  ─────────────────>│                │                │
   │ 200                 │                  │                 │                │
   │<───────────────────│                  │                 │                │
   │                    │                  │ INSERT nodes(stage2.design)       │
   │                    │                  │ kubectl exec    │                │
   │                    │                  ├─────────────────┼───────────────>│
   │                    │                  │ ...             │                │
```

### 7.3 失败 + 重试
```
worker / sandbox-runner   orchestrator
   │ LLM 输出 schema 校验失败       │
   ├──────────────────────────────>│
   │                              │ classify: llm_quality_failed
   │                              │ retry_count++, 立即重发（带 schema 反馈）
   │                              │ kubectl exec → sandbox-runner --retry
   │ ...                          │
   │ 3 次后仍失败                 │
   ├──────────────────────────────>│
   │                              │ UPDATE nodes status=failed
   │                              │ UPDATE runs status=failed
   │                              │ pg_notify
   │                              │ → SSE error 到浏览器
```

### 7.4 Grill Chat（Gate 期间）
```
浏览器              web                  worker            sandbox Pod
   │ POST /grill/start   │                    │                   │
   ├───────────────────>│                    │                   │
   │                    │ enqueue startGrill │                   │
   │                    ├───────────────────>│                   │
   │                    │                    │ kubectl exec     │
   │                    │                    │ claude --resume <session>
   │                    │                    ├──────────────────>│
   │ POST /grill/message {text}              │                   │
   ├───────────────────>│                    │                   │
   │                    │ kubectl exec stdin write              │
   │                    ├────────────────────┼──────────────────>│
   │ SSE: grill_chunk (×N)                   │                   │
   │<───────────────────│<───────────────────│<──────────────────│
```

## 8. Package 公开 API

每个 package 的入口和稳定 API：

### packages/core
```ts
export { RequirementIRSchema, DesignIRSchema, ImplementationIRSchema }
export { HoneyAIError, ValidationError, ExternalError, ... }
export { RUN_STATES, NODE_KINDS, FAILURE_CLASSES, ASSET_KINDS }
export type { Run, Node, Gate, Artifact, Asset, Tenant, User, CostEvent }
```

### packages/db
```ts
export { db, withTenant, transaction }
export { schema }  // Drizzle schema namespace
export { runsRepo, nodesRepo, artifactsRepo, assetsRepo, ... }
export { migrate }  // for drizzle-migrate Job
```

### packages/orchestrator
```ts
export { scheduleRun, advanceRun, retryNode, cancelRun }
export { reconcileLoop }  // 长跑 5min cron
export { classifyFailure, applyRetryPolicy }
export type { OrchestratorContext, NodeExecutor }
```

### packages/adapter-claude
```ts
export class ClaudeCodeAdapter implements RuntimeAdapter {
  async startSession(opts): Promise<SessionHandle>
  async resumeSession(sessionId, input): Promise<EventStream>
  async streamNode(nodeId, prompt): AsyncIterable<NormalizedEvent>
}
```

### packages/github
```ts
export { GitHubApp, getInstallationOctokit }
export { createPR, getRepoInfo, listBranches, ... }
export { verifyWebhook, parseWebhookPayload }
export { encryptToken, decryptToken }  // 信封加密
```

### packages/web
- 无导出（Next.js 入口）
- 内部组织：app/ / components/ / lib/ / hooks/

### packages/worker
- 无导出（独立进程入口）
- 注册 BullMQ 处理器

### packages/sandbox-runner
- CLI 入口：`sandbox-runner <node-id> --kind <kind>`
- 输出：stdout JSONL（标准化事件流）

## 9. 包内文件结构

### packages/db
```
src/
├── schema/
│   ├── identity.ts       (users, accounts, sessions, tenants, tenant_members)
│   ├── github.ts         (installations, repositories, tokens)
│   ├── assets.ts         (assets, asset_versions, asset_sources)
│   ├── runs.ts           (runs, nodes, gates, events, node_retries)
│   ├── artifacts.ts      (artifacts, artifact_blobs)
│   ├── sandbox.ts        (sandboxes, sandbox_credentials)
│   ├── cost.ts           (pricing_book, cost_events, run_cost_summary)
│   ├── audit.ts          (audit_log, activity_feed)
│   ├── encryption.ts     (data_encryption_keys)
│   ├── jobs.ts           (jobs, job_locks, asset_sync_queue)
│   └── index.ts          (re-export all + relations)
├── repos/
│   ├── runs.ts
│   ├── nodes.ts
│   ├── artifacts.ts
│   ├── assets.ts
│   └── ...
├── tenant.ts             (withTenant middleware)
├── transaction.ts        (transaction helper)
├── client.ts             (drizzle instance)
└── index.ts
```

### packages/orchestrator
```
src/
├── fsm/
│   ├── run.ts            (Run FSM)
│   └── node.ts           (Node FSM)
├── executors/
│   ├── agent.ts
│   ├── gate.ts
│   ├── merge.ts
│   └── deploy.ts
├── retry/
│   ├── policy.ts
│   └── classifier.ts
├── reconcile.ts          (5 分钟 cron)
├── sandbox.ts            (kubectl wrappers)
└── index.ts
```

### packages/web
```
src/
├── app/                  (Next.js App Router 见 07-frontend)
├── components/
│   ├── ui/               (shadcn 复制过来)
│   ├── run/              (RunTimeline, NodeView, ...)
│   ├── asset/            (AssetEditor, AssetList, ...)
│   └── editor/           (TiptapIREditor)
├── lib/
│   ├── auth.ts           (Auth.js config)
│   ├── strings/zh.ts     (所有 UI 文案)
│   ├── sse.ts            (EventSource hook)
│   └── store.ts          (Zustand store)
├── server/
│   ├── actions/          (Server Actions)
│   └── middleware/       (tenant middleware)
└── styles/
    ├── tokens.css
    └── globals.css
```
