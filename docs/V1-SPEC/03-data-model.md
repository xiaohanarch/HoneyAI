# 03 — Data Model

## 1. 表分组（11 组 30 表）

### 1.1 Identity & Tenancy（4 表）
- `users` — GitHub 登录用户
- `accounts` — OAuth account（Auth.js）
- `sessions` — DB session（Auth.js）
- `tenants` — 租户主体
- `tenant_members` — 用户 ↔ 租户成员关系（角色 owner/member）

### 1.2 GitHub Integration（3 表）
- `github_installations` — GitHub App 安装记录
- `repositories` — 已绑定的 repo
- `github_tokens` — 加密存储的用户 OAuth token（commit 归属用）

### 1.3 Assets（3 表）
- `assets` — skill/rule/command/script/hook/hint/template/context 8 类
- `asset_versions` — 版本历史（每次保存生成新版本）
- `asset_sources` — GitHub 导入源（mirror / import-once）

### 1.4 Runs & Nodes（5 表）
- `runs` — 一次完整流水线执行
- `nodes` — Run 内的节点（Stage1.enrich / Stage1.gate / ...）
- `gates` — Gate 状态（passed_at / passed_by / version_pinned）
- `events` — 节点级 JSONL 事件流（append-only, BRIN 索引）
- `node_retries` — 重试历史

### 1.5 Artifacts (CAS)（2 表）
- `artifacts` — 元数据 + frontmatter mirror（JSONB）
- `artifact_blobs` — CAS 文件索引（sha256 → OSS key）

### 1.6 IR Schemas（隐含在 artifacts.metadata 中，无独立表）

### 1.7 Sandbox（2 表）
- `sandboxes` — 每 Run 一个 pod 的元数据
- `sandbox_credentials` — 临时凭据（GitHub token / Anthropic key 注入记录）

### 1.8 Cost & Pricing（3 表）
- `pricing_book` — 模型/服务的单价表（micro-USD）
- `cost_events` — 每次消费事件
- `run_cost_summary` — 物化视图，按 Run 汇总

### 1.9 Audit & Activity（2 表）
- `audit_log` — 关键操作审计（Gate 通过 / Asset 修改 / Tenant 变更）
- `activity_feed` — 用户可见的活动流

### 1.10 Encryption（1 表）
- `data_encryption_keys` — 信封加密 DEK 存储（KEK 在 k8s Secret）

### 1.11 Background Jobs（3 表）
- `jobs` — BullMQ 作业元数据镜像
- `job_locks` — 行级锁（同节点防并发重试）
- `asset_sync_queue` — Asset GitHub mirror 同步队列

## 2. 关键 schema 细节（V1 必须）

### 2.1 多租户字段约束
所有租户作用域的表必须含：
- `tenant_id uuid not null references tenants(id)`
- 复合索引 `(tenant_id, ...其他常查字段)`
- middleware 强制 WHERE tenant_id = ?（V1.0）+ RLS（V1.5）

例外：`users`, `accounts`, `sessions`, `tenants`, `github_installations`, `pricing_book`, `data_encryption_keys`（无 tenant_id）

### 2.2 assets 表（关键）
- `kind` enum: skill / rule / command / script / hook / hint / template / context
- `tenant_id` nullable —— null 表示全局官方默认（platform_admin 维护）
- `source_id` nullable —— 关联 asset_sources，区分手写 / mirror / import-once
- 唯一约束 `(tenant_id, kind, name)` (tenant_id 用 IS NOT DISTINCT FROM 处理 null)

### 2.3 events 表（高频写）
- 主键 `id uuid v7`（时间排序友好）
- `run_id`, `node_id`, `seq bigserial`, `kind`, `payload jsonb`
- 分区策略：V1 单表 + BRIN(occurred_at) 索引；V1.1 按 run_id hash 分区
- 保留 30 天

### 2.4 artifacts 表
- `id uuid v7`
- `tenant_id`, `run_id`, `node_id`, `kind` (requirement_ir / design_ir / impl_ir / pr_meta / log_chunk)
- `version int` —— 每次保存递增
- `status` enum: ok / failed
- `blob_sha256` → 关联 artifact_blobs
- `metadata jsonb` —— frontmatter mirror，用于不读 blob 即可索引

### 2.5 cost_events 表
```ts
// Drizzle 形态
cost_events {
  id: uuid v7,
  tenant_id: uuid,
  run_id: uuid (nullable),
  node_id: uuid (nullable),
  agent_version_id: uuid (nullable),
  kind: enum('llm_tokens'|'github_api'|'sandbox_compute'|'storage_write'|'storage_stored'|'egress_bytes'),
  provider: text,           // anthropic / github / aliyun
  sku: text,                // 如 claude-sonnet-4-6-input
  quantity: numeric(20,4),  // tokens / requests / GB-hour
  unit_cost_micro_usd: bigint,  // 写时快照单价
  total_micro_usd: bigint,      // computed
  occurred_at: timestamptz,
  metadata: jsonb
}
```

物化视图 `run_cost_summary`：按 (tenant_id, run_id) GROUP BY，每 5 分钟 REFRESH。

## 3. 索引策略
- 所有 `tenant_id` 字段建索引
- 高频查询：`(tenant_id, created_at desc)` 用 btree
- 时序大表（events / audit_log）用 BRIN(occurred_at)
- 软删除字段 `deleted_at IS NULL` 用部分索引

## 4. 迁移策略
- Drizzle Kit generate（schema → SQL）
- 业务表用 generate；系统元数据（pricing_book / 官方 assets seed）走业务 seed 脚本
- CI 部署阶段 kubectl run drizzle-migrate（K8s Job）
- forward-only，不写 down

## 5. 加密
- 信封加密：KEK 存 k8s Secret，DEK 存 `data_encryption_keys` 表
- 加密字段：`github_tokens.encrypted_token`, `sandbox_credentials.encrypted_value`
- pgcrypto 不足以满足；用 app 层 AES-256-GCM + DEK

## 6. 30 表完整 Drizzle Schema

> 所有 schema 位于 `packages/db/src/schema/*.ts`。按 §1 分组组织文件。
> 通用约定：`id` 用 uuid v7（`createdAtId()`），`tenantId` 必填字段必加 index。

### 6.1 通用工具
```ts
// packages/db/src/schema/_helpers.ts
import { pgTable, uuid, timestamp, text, jsonb, integer, bigint, boolean, numeric, pgEnum, primaryKey, index, uniqueIndex } from 'drizzle-orm/pg-core'

export const tsCols = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}
export const softDelete = {
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}
```

### 6.2 Identity & Tenancy
```ts
// packages/db/src/schema/identity.ts
export const users = pgTable('users', {
  id: uuid('id').primaryKey(),
  githubId: bigint('github_id', { mode: 'number' }).notNull().unique(),
  githubLogin: text('github_login').notNull(),
  email: text('email'),
  name: text('name'),
  avatarUrl: text('avatar_url'),
  isPlatformAdmin: boolean('is_platform_admin').notNull().default(false),
  ...tsCols,
})

// Auth.js v5 DrizzleAdapter
export const accounts = pgTable('accounts', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  provider: text('provider').notNull(),
  providerAccountId: text('provider_account_id').notNull(),
  refreshToken: text('refresh_token'),
  accessToken: text('access_token'),
  expiresAt: integer('expires_at'),
  tokenType: text('token_type'),
  scope: text('scope'),
  idToken: text('id_token'),
  sessionState: text('session_state'),
}, (t) => ({ pk: primaryKey({ columns: [t.provider, t.providerAccountId] }) }))

export const sessions = pgTable('sessions', {
  sessionToken: text('session_token').primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { withTimezone: true }).notNull(),
})

export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  kind: text('kind', { enum: ['personal', 'team'] }).notNull().default('personal'),
  defaultRepoId: uuid('default_repo_id'),
  budgetMicroUsdMonthly: bigint('budget_micro_usd_monthly', { mode: 'bigint' }),
  settings: jsonb('settings').notNull().default({}),
  ...tsCols,
  ...softDelete,
})

export const tenantRoleEnum = pgEnum('tenant_role', ['owner', 'member'])

export const tenantMembers = pgTable('tenant_members', {
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: tenantRoleEnum('role').notNull().default('member'),
  invitedBy: uuid('invited_by').references(() => users.id),
  joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  pk: primaryKey({ columns: [t.tenantId, t.userId] }),
  byUser: index('tenant_members_by_user').on(t.userId),
}))
```

### 6.3 GitHub Integration
```ts
// packages/db/src/schema/github.ts
export const githubInstallations = pgTable('github_installations', {
  id: uuid('id').primaryKey(),
  installationId: bigint('installation_id', { mode: 'number' }).notNull().unique(),
  accountLogin: text('account_login').notNull(),
  accountType: text('account_type', { enum: ['User', 'Organization'] }).notNull(),
  installedByUserId: uuid('installed_by_user_id').references(() => users.id),
  suspendedAt: timestamp('suspended_at', { withTimezone: true }),
  ...tsCols,
})

export const repositories = pgTable('repositories', {
  id: uuid('id').primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  installationId: uuid('installation_id').notNull().references(() => githubInstallations.id),
  githubRepoId: bigint('github_repo_id', { mode: 'number' }).notNull(),
  owner: text('owner').notNull(),
  name: text('name').notNull(),
  defaultBranch: text('default_branch').notNull().default('main'),
  isEnabled: boolean('is_enabled').notNull().default(true),
  ...tsCols,
}, (t) => ({
  byTenant: index('repos_by_tenant').on(t.tenantId),
  uniqGithub: uniqueIndex('repos_uniq_github').on(t.tenantId, t.githubRepoId),
}))

export const githubTokens = pgTable('github_tokens', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }).primaryKey(),
  encryptedToken: text('encrypted_token').notNull(),
  dekId: uuid('dek_id').notNull(),
  scope: text('scope').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  ...tsCols,
})
```

### 6.4 Assets
```ts
// packages/db/src/schema/assets.ts
export const assetKindEnum = pgEnum('asset_kind', [
  'skill', 'rule', 'command', 'script', 'hook', 'hint', 'template', 'context'
])
export const assetSyncModeEnum = pgEnum('asset_sync_mode', ['manual', 'mirror', 'import-once'])

export const assetSources = pgTable('asset_sources', {
  id: uuid('id').primaryKey(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }), // null = 全局
  kind: text('kind', { enum: ['github_repo'] }).notNull(),
  repoUrl: text('repo_url').notNull(),
  subPath: text('sub_path').notNull().default(''),
  syncMode: assetSyncModeEnum('sync_mode').notNull(),
  branch: text('branch').notNull().default('main'),
  lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
  lastSyncSha: text('last_sync_sha'),
  ...tsCols,
}, (t) => ({ byTenant: index('asset_sources_by_tenant').on(t.tenantId) }))

export const assets = pgTable('assets', {
  id: uuid('id').primaryKey(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }), // null = 全局官方
  sourceId: uuid('source_id').references(() => assetSources.id, { onDelete: 'set null' }),
  sourcePath: text('source_path'),
  name: text('name').notNull(),
  kind: assetKindEnum('kind').notNull(),
  description: text('description'),
  currentVersionId: uuid('current_version_id'),
  isEnabled: boolean('is_enabled').notNull().default(true),
  metadata: jsonb('metadata').notNull().default({}),
  ...tsCols,
  ...softDelete,
}, (t) => ({
  byTenantKind: index('assets_by_tenant_kind').on(t.tenantId, t.kind),
  // 唯一约束 (tenant_id, kind, name)，tenant_id null 视为相等处理
  uniqName: uniqueIndex('assets_uniq_name').on(t.tenantId, t.kind, t.name),
}))

export const assetVersions = pgTable('asset_versions', {
  id: uuid('id').primaryKey(),
  assetId: uuid('asset_id').notNull().references(() => assets.id, { onDelete: 'cascade' }),
  version: integer('version').notNull(),
  content: text('content').notNull(),
  frontmatter: jsonb('frontmatter').notNull().default({}),
  authorUserId: uuid('author_user_id').references(() => users.id),
  authorKind: text('author_kind', { enum: ['user', 'mirror_sync', 'system_seed'] }).notNull(),
  ...tsCols,
}, (t) => ({
  byAsset: index('asset_versions_by_asset').on(t.assetId, t.version),
  uniqVersion: uniqueIndex('asset_versions_uniq').on(t.assetId, t.version),
}))
```

### 6.5 Runs & Nodes
```ts
// packages/db/src/schema/runs.ts
export const runStatusEnum = pgEnum('run_status', [
  'created', 'scheduling', 'running', 'paused_at_gate', 'completed', 'failed', 'cancelled'
])
export const nodeStatusEnum = pgEnum('node_status', ['pending', 'running', 'success', 'failed', 'skipped'])
export const nodeKindEnum = pgEnum('node_kind', ['agent', 'gate', 'merge', 'deploy'])
export const failureClassEnum = pgEnum('failure_class', [
  'llm_rate_limited', 'llm_quality_failed', 'sandbox_timeout', 'sandbox_oom',
  'sandbox_died', 'sandbox_disk_full', 'external_failed', 'user_cancelled'
])

export const runs = pgTable('runs', {
  id: uuid('id').primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  repositoryId: uuid('repository_id').notNull().references(() => repositories.id),
  createdByUserId: uuid('created_by_user_id').notNull().references(() => users.id),
  title: text('title').notNull(),
  oneLiner: text('one_liner').notNull(),
  targetBranch: text('target_branch').notNull().default('main'),
  status: runStatusEnum('status').notNull().default('created'),
  failureClass: failureClassEnum('failure_class'),
  failureMessage: text('failure_message'),
  runtime: text('runtime', { enum: ['claude_code', 'opencode'] }).notNull().default('claude_code'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  totalCostMicroUsd: bigint('total_cost_micro_usd', { mode: 'bigint' }).notNull().default(0n),
  ...tsCols,
}, (t) => ({
  byTenantCreated: index('runs_by_tenant_created').on(t.tenantId, t.createdAt.desc()),
  byStatus: index('runs_by_status').on(t.tenantId, t.status),
}))

export const nodes = pgTable('nodes', {
  id: uuid('id').primaryKey(),
  runId: uuid('run_id').notNull().references(() => runs.id, { onDelete: 'cascade' }),
  parentNodeId: uuid('parent_node_id').references(() => nodes.id),
  stage: integer('stage').notNull(), // 1 / 2 / 3
  ordinal: integer('ordinal').notNull(),
  name: text('name').notNull(), // e.g. 'stage2.design'
  kind: nodeKindEnum('kind').notNull(),
  status: nodeStatusEnum('status').notNull().default('pending'),
  retryCount: integer('retry_count').notNull().default(0),
  startedAt: timestamp('started_at', { withTimezone: true }),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  config: jsonb('config').notNull().default({}),
  ...tsCols,
}, (t) => ({
  byRun: index('nodes_by_run').on(t.runId, t.ordinal),
}))

export const gates = pgTable('gates', {
  nodeId: uuid('node_id').notNull().references(() => nodes.id, { onDelete: 'cascade' }).primaryKey(),
  openedAt: timestamp('opened_at', { withTimezone: true }),
  passedAt: timestamp('passed_at', { withTimezone: true }),
  passedByUserId: uuid('passed_by_user_id').references(() => users.id),
  pinnedArtifactId: uuid('pinned_artifact_id'),
  viewedAt: timestamp('viewed_at', { withTimezone: true }),
})

export const events = pgTable('events', {
  id: uuid('id').primaryKey(),
  runId: uuid('run_id').notNull().references(() => runs.id, { onDelete: 'cascade' }),
  nodeId: uuid('node_id').references(() => nodes.id, { onDelete: 'cascade' }),
  seq: bigint('seq', { mode: 'bigint' }).notNull(),
  kind: text('kind').notNull(),
  payload: jsonb('payload').notNull(),
  traceId: text('trace_id'),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  byRunSeq: index('events_by_run_seq').on(t.runId, t.seq),
  byOccurredBrin: index('events_occurred_brin').using('brin', t.occurredAt),
}))

export const nodeRetries = pgTable('node_retries', {
  id: uuid('id').primaryKey(),
  nodeId: uuid('node_id').notNull().references(() => nodes.id, { onDelete: 'cascade' }),
  attempt: integer('attempt').notNull(),
  trigger: text('trigger', { enum: ['auto', 'manual'] }).notNull(),
  triggeredByUserId: uuid('triggered_by_user_id').references(() => users.id),
  failureClass: failureClassEnum('failure_class'),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  configOverride: jsonb('config_override').notNull().default({}), // e.g. {memory: '4Gi'}
})
```

### 6.6 Artifacts
```ts
// packages/db/src/schema/artifacts.ts
export const artifactKindEnum = pgEnum('artifact_kind', [
  'requirement_ir', 'design_ir', 'design_sub_ir', 'impl_ir', 'pr_meta', 'log_chunk', 'raw_input'
])
export const artifactStatusEnum = pgEnum('artifact_status', ['ok', 'failed'])

// artifact_blobs: CAS 物理层（sha256 去重），不可变
// oss_key 规范：<tenant_id>/blobs/<sha256[0:2]>/<sha256[2:]> （单 bucket + 租户前缀，见 TD-016）
export const artifactBlobs = pgTable('artifact_blobs', {
  sha256: text('sha256').primaryKey(),
  byteSize: bigint('byte_size', { mode: 'bigint' }).notNull(),
  ossKey: text('oss_key').notNull().unique(), // UNIQUE：幂等 INSERT 防 BullMQ 重试导致重复
  contentType: text('content_type').notNull().default('text/markdown'),
  ...tsCols,
})

// artifacts: 逻辑层（每次 attempt 一行），不可变；通过 blob_sha256 引用物理 blob
// 同一 (run, node, attempt, kind) 唯一；retry 触发新行，旧行保留（见 06 §16）
export const artifacts = pgTable('artifacts', {
  id: uuid('id').primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  runId: uuid('run_id').notNull().references(() => runs.id, { onDelete: 'cascade' }),
  nodeId: uuid('node_id').references(() => nodes.id, { onDelete: 'set null' }),
  attempt: integer('attempt').notNull().default(1), // 节点重试编号（与 nodes.attempt 对应）
  kind: artifactKindEnum('kind').notNull(),
  status: artifactStatusEnum('status').notNull().default('ok'),
  blobSha256: text('blob_sha256').notNull().references(() => artifactBlobs.sha256),
  metadata: jsonb('metadata').notNull().default({}), // frontmatter mirror
  authorKind: text('author_kind', { enum: ['agent', 'user', 'system'] }).notNull(),
  authorUserId: uuid('author_user_id').references(() => users.id),
  pinned: boolean('pinned').notNull().default(false),
  ...tsCols,
}, (t) => ({
  byRunKind: index('artifacts_by_run_kind').on(t.runId, t.kind, t.attempt.desc()),
  byTenantCreated: index('artifacts_by_tenant_created').on(t.tenantId, t.createdAt.desc()),
  // UNIQUE：禁止同一 (run,node,attempt,kind) 重复 — 配合 INSERT ON CONFLICT DO NOTHING 实现幂等
  uniqByNodeAttempt: uniqueIndex('artifacts_uniq_node_attempt_kind').on(t.runId, t.nodeId, t.attempt, t.kind),
}))
```

### 6.6b IR Documents（人工可编辑层，A2 append-only）
```ts
// packages/db/src/schema/ir-documents.ts
// IR markdown 不落 OSS，TEXT 列直存；每次 save 写新版本行（append-only INSERT）
// 见 04 §11 完整规则
export const irStageEnum = pgEnum('ir_stage', ['requirement', 'design', 'implementation'])

export const irDocuments = pgTable('ir_documents', {
  // PK = (run_id, stage, version) — 复合主键
  runId: uuid('run_id').notNull().references(() => runs.id, { onDelete: 'cascade' }),
  stage: irStageEnum('stage').notNull(),
  version: integer('version').notNull(),                // monotonic int，server 在事务内 +1
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  body: text('body').notNull(),                         // 完整 markdown + frontmatter
  frontmatterJson: jsonb('frontmatter_json').notNull(), // 解析后的 frontmatter（zod 校验过）
  createdByUserId: uuid('created_by_user_id').references(() => users.id), // null = agent 写入
  createdByKind: text('created_by_kind', { enum: ['agent', 'user'] }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  pk: primaryKey({ columns: [t.runId, t.stage, t.version] }),
  // 索引：取当前版本 → ORDER BY version DESC LIMIT 1
  byCurrent: index('ir_documents_by_current').on(t.runId, t.stage, t.version.desc()),
  byTenant: index('ir_documents_by_tenant_created').on(t.tenantId, t.createdAt.desc()),
}))
```

### 6.7 Sandbox
```ts
// packages/db/src/schema/sandbox.ts
export const sandboxStatusEnum = pgEnum('sandbox_status', ['pending', 'running', 'terminated', 'failed'])

export const sandboxes = pgTable('sandboxes', {
  id: uuid('id').primaryKey(),
  runId: uuid('run_id').notNull().references(() => runs.id, { onDelete: 'cascade' }).unique(),
  namespace: text('namespace').notNull().default('honeyai'),
  jobName: text('job_name').notNull(),
  podName: text('pod_name'),
  imageDigest: text('image_digest').notNull(),
  resourceCpu: text('resource_cpu').notNull().default('2'),
  resourceMemory: text('resource_memory').notNull().default('2Gi'),
  resourceStorage: text('resource_storage').notNull().default('5Gi'),
  status: sandboxStatusEnum('status').notNull().default('pending'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  terminatedAt: timestamp('terminated_at', { withTimezone: true }),
  ...tsCols,
})

export const sandboxCredentials = pgTable('sandbox_credentials', {
  id: uuid('id').primaryKey(),
  sandboxId: uuid('sandbox_id').notNull().references(() => sandboxes.id, { onDelete: 'cascade' }),
  kind: text('kind', { enum: ['github_token', 'anthropic_key', 'user_secret'] }).notNull(),
  encryptedValue: text('encrypted_value').notNull(),
  dekId: uuid('dek_id').notNull(),
  injectedAt: timestamp('injected_at', { withTimezone: true }).notNull().defaultNow(),
  redactedAt: timestamp('redacted_at', { withTimezone: true }),
})
```

### 6.8 Cost & Pricing
```ts
// packages/db/src/schema/cost.ts
export const costKindEnum = pgEnum('cost_kind', [
  'llm_tokens', 'github_api', 'sandbox_compute', 'storage_write', 'storage_stored', 'egress_bytes'
])

export const pricingBook = pgTable('pricing_book', {
  id: uuid('id').primaryKey(),
  kind: costKindEnum('kind').notNull(),
  provider: text('provider').notNull(),
  sku: text('sku').notNull(),
  unitCostMicroUsd: bigint('unit_cost_micro_usd', { mode: 'bigint' }).notNull(),
  unit: text('unit').notNull(), // 'token' / 'request' / 'GB-hour'
  effectiveFrom: timestamp('effective_from', { withTimezone: true }).notNull(),
  effectiveTo: timestamp('effective_to', { withTimezone: true }),
  ...tsCols,
}, (t) => ({
  bySku: uniqueIndex('pricing_uniq_active').on(t.kind, t.provider, t.sku, t.effectiveFrom),
}))

export const costEvents = pgTable('cost_events', {
  id: uuid('id').primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  runId: uuid('run_id').references(() => runs.id, { onDelete: 'set null' }),
  nodeId: uuid('node_id').references(() => nodes.id, { onDelete: 'set null' }),
  kind: costKindEnum('kind').notNull(),
  provider: text('provider').notNull(),
  sku: text('sku').notNull(),
  quantity: numeric('quantity', { precision: 20, scale: 4 }).notNull(),
  unitCostMicroUsd: bigint('unit_cost_micro_usd', { mode: 'bigint' }).notNull(),
  totalMicroUsd: bigint('total_micro_usd', { mode: 'bigint' }).notNull(),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  metadata: jsonb('metadata').notNull().default({}),
}, (t) => ({
  byTenantOccurred: index('cost_events_by_tenant_time').on(t.tenantId, t.occurredAt.desc()),
  byRun: index('cost_events_by_run').on(t.runId),
  byOccurredBrin: index('cost_events_occurred_brin').using('brin', t.occurredAt),
}))

// 物化视图：每 5 分钟 REFRESH MATERIALIZED VIEW CONCURRENTLY run_cost_summary
// CREATE MATERIALIZED VIEW run_cost_summary AS
//   SELECT tenant_id, run_id, SUM(total_micro_usd) AS total_cost_micro_usd,
//          jsonb_object_agg(kind, kind_total) AS by_kind, MAX(occurred_at) AS last_event_at
//   FROM ... GROUP BY tenant_id, run_id;
```

### 6.9 Audit & Activity
```ts
// packages/db/src/schema/audit.ts
export const auditLog = pgTable('audit_log', {
  id: uuid('id').primaryKey(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),
  actorUserId: uuid('actor_user_id').references(() => users.id),
  action: text('action').notNull(), // 'gate.passed' / 'asset.updated' / 'tenant.member_added' ...
  targetKind: text('target_kind').notNull(),
  targetId: text('target_id').notNull(),
  payload: jsonb('payload').notNull().default({}),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  byTenantTime: index('audit_by_tenant_time').on(t.tenantId, t.occurredAt.desc()),
  byOccurredBrin: index('audit_occurred_brin').using('brin', t.occurredAt),
}))

export const activityFeed = pgTable('activity_feed', {
  id: uuid('id').primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  actorUserId: uuid('actor_user_id').references(() => users.id),
  verb: text('verb').notNull(), // 'created' / 'completed' / 'commented' ...
  objectKind: text('object_kind').notNull(),
  objectId: text('object_id').notNull(),
  summary: text('summary').notNull(),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
})
```

### 6.10 Encryption
```ts
// packages/db/src/schema/encryption.ts
export const dataEncryptionKeys = pgTable('data_encryption_keys', {
  id: uuid('id').primaryKey(),
  kekVersion: integer('kek_version').notNull(),
  encryptedDek: text('encrypted_dek').notNull(), // AES-256-GCM(KEK, DEK)
  algorithm: text('algorithm').notNull().default('AES-256-GCM'),
  ...tsCols,
  rotatedAt: timestamp('rotated_at', { withTimezone: true }),
})
```

### 6.11 Background Jobs
```ts
// packages/db/src/schema/jobs.ts
export const jobs = pgTable('jobs', {
  id: uuid('id').primaryKey(),
  queueName: text('queue_name').notNull(),
  bullJobId: text('bull_job_id').notNull(),
  payload: jsonb('payload').notNull(),
  status: text('status', { enum: ['queued', 'active', 'completed', 'failed'] }).notNull(),
  attempts: integer('attempts').notNull().default(0),
  lastError: text('last_error'),
  enqueuedAt: timestamp('enqueued_at', { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
})

export const jobLocks = pgTable('job_locks', {
  lockKey: text('lock_key').primaryKey(), // 'node:<uuid>:retry'
  ownerJobId: uuid('owner_job_id'),
  acquiredAt: timestamp('acquired_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
})

export const assetSyncQueue = pgTable('asset_sync_queue', {
  id: uuid('id').primaryKey(),
  sourceId: uuid('source_id').notNull().references(() => assetSources.id, { onDelete: 'cascade' }),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
  status: text('status', { enum: ['queued', 'running', 'done', 'failed'] }).notNull().default('queued'),
  lastResult: jsonb('last_result'),
  ...tsCols,
})
```

## 7. Relations 索引（drizzle relations）
```ts
// packages/db/src/schema/index.ts
import { relations } from 'drizzle-orm'

export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(tenantMembers),
  githubToken: one(githubTokens),
}))

export const tenantsRelations = relations(tenants, ({ many, one }) => ({
  members: many(tenantMembers),
  repositories: many(repositories),
  runs: many(runs),
  assets: many(assets),
  costEvents: many(costEvents),
  defaultRepo: one(repositories, { fields: [tenants.defaultRepoId], references: [repositories.id] }),
}))

export const runsRelations = relations(runs, ({ many, one }) => ({
  nodes: many(nodes),
  artifacts: many(artifacts),
  costEvents: many(costEvents),
  sandbox: one(sandboxes),
  repository: one(repositories, { fields: [runs.repositoryId], references: [repositories.id] }),
}))

// ... 其余 relations
```

## 8. withTenant Middleware（关键安全防线 — TD-002）
```ts
// packages/db/src/tenant.ts
export function withTenant(tenantId: string, db: typeof rawDb) {
  return new Proxy(db, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver)
      // 仅对租户作用域表的 query builder 注入 WHERE tenant_id = ?
      // 通过运行时检查 schema.tenantId 字段是否存在
      // 详细实现见 packages/db/src/tenant.ts
      return value
    }
  })
}

// 用法
import { withTenant } from '@/db'
const db = withTenant(session.tenantId, rawDb)
const runs = await db.select().from(schema.runs).limit(20)
// 自动 → WHERE tenant_id = session.tenantId
```

## 9. 验收清单（V1.0 种子）

> 见 [00-README.md §验收清单约定](./00-README.md#验收清单约定acceptance-criteria)。

- [ ] **AC-03-01** `[Happy]` `[Cross-module]`：`withTenant(t1, db).select().from(runs)` 生成的 SQL 自动含 `WHERE tenant_id = 't1'`（通过 query log assertion 验证）
- [ ] **AC-03-02** `[Failure]` `[Boundary]`：tenant A 用户用 `withTenant(B, db)` 查询 → 返回 0 行（fixture：A、B 各有 1 条 run），且 audit_log 记录跨租户访问尝试
- [ ] **AC-03-03** `[Idempotency]`：artifacts INSERT 同 `(run_id, node_id, attempt, kind)` 二次 → 第二次 ON CONFLICT DO NOTHING，结果集仍为 1 行；artifact_blobs INSERT 同 `oss_key` 二次 → 同样幂等
