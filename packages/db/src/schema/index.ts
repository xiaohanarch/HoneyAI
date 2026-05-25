import { relations } from 'drizzle-orm'

export * from './_helpers'
export * from './identity'
export * from './github'
export * from './assets'
export * from './runs'
export * from './artifacts'
export * from './ir-documents'
export * from './sandbox'
export * from './cost'
export * from './audit'
export * from './encryption'
export * from './jobs'

import { users, tenants, tenantMembers, accounts, sessions } from './identity'
import { githubInstallations, repositories, githubTokens } from './github'
import { assetSources, assets, assetVersions } from './assets'
import { runs, nodes, gates, events, nodeRetries } from './runs'
import { artifactBlobs, artifacts } from './artifacts'
import { irDocuments } from './ir-documents'
import { sandboxes, sandboxCredentials } from './sandbox'
import { pricingBook, costEvents } from './cost'
import { auditLog, activityFeed } from './audit'
import { assetSyncQueue } from './jobs'

// ============================================================================
// Relations
// ============================================================================

export const usersRelations = relations(users, ({ many, one }) => ({
  memberships: many(tenantMembers),
  accounts: many(accounts),
  sessions: many(sessions),
  githubToken: one(githubTokens),
}))

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}))

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}))

export const tenantsRelations = relations(tenants, ({ many, one }) => ({
  members: many(tenantMembers),
  repositories: many(repositories),
  runs: many(runs),
  assets: many(assets),
  costEvents: many(costEvents),
  defaultRepo: one(repositories, {
    fields: [tenants.defaultRepoId],
    references: [repositories.id],
  }),
}))

export const tenantMembersRelations = relations(tenantMembers, ({ one }) => ({
  tenant: one(tenants, { fields: [tenantMembers.tenantId], references: [tenants.id] }),
  user: one(users, { fields: [tenantMembers.userId], references: [users.id] }),
}))

export const githubInstallationsRelations = relations(githubInstallations, ({ many, one }) => ({
  repositories: many(repositories),
  installedBy: one(users, {
    fields: [githubInstallations.installedByUserId],
    references: [users.id],
  }),
}))

export const repositoriesRelations = relations(repositories, ({ one, many }) => ({
  tenant: one(tenants, { fields: [repositories.tenantId], references: [tenants.id] }),
  installation: one(githubInstallations, {
    fields: [repositories.installationId],
    references: [githubInstallations.id],
  }),
  runs: many(runs),
}))

export const githubTokensRelations = relations(githubTokens, ({ one }) => ({
  user: one(users, { fields: [githubTokens.userId], references: [users.id] }),
}))

export const assetSourcesRelations = relations(assetSources, ({ one, many }) => ({
  tenant: one(tenants, { fields: [assetSources.tenantId], references: [tenants.id] }),
  assets: many(assets),
  syncQueue: many(assetSyncQueue),
}))

export const assetsRelations = relations(assets, ({ one, many }) => ({
  tenant: one(tenants, { fields: [assets.tenantId], references: [tenants.id] }),
  source: one(assetSources, { fields: [assets.sourceId], references: [assetSources.id] }),
  versions: many(assetVersions),
}))

export const assetVersionsRelations = relations(assetVersions, ({ one }) => ({
  asset: one(assets, { fields: [assetVersions.assetId], references: [assets.id] }),
}))

export const runsRelations = relations(runs, ({ many, one }) => ({
  tenant: one(tenants, { fields: [runs.tenantId], references: [tenants.id] }),
  repository: one(repositories, { fields: [runs.repositoryId], references: [repositories.id] }),
  createdBy: one(users, { fields: [runs.createdByUserId], references: [users.id] }),
  nodes: many(nodes),
  events: many(events),
  artifacts: many(artifacts),
  costEvents: many(costEvents),
  irDocuments: many(irDocuments),
  sandbox: one(sandboxes),
}))

export const nodesRelations = relations(nodes, ({ one, many }) => ({
  run: one(runs, { fields: [nodes.runId], references: [runs.id] }),
  parent: one(nodes, { fields: [nodes.parentNodeId], references: [nodes.id] }),
  events: many(events),
  retries: many(nodeRetries),
  gates: many(gates),
}))

export const gatesRelations = relations(gates, ({ one }) => ({
  node: one(nodes, { fields: [gates.nodeId], references: [nodes.id] }),
  passedBy: one(users, { fields: [gates.passedByUserId], references: [users.id] }),
}))

export const eventsRelations = relations(events, ({ one }) => ({
  run: one(runs, { fields: [events.runId], references: [runs.id] }),
  node: one(nodes, { fields: [events.nodeId], references: [nodes.id] }),
}))

export const nodeRetriesRelations = relations(nodeRetries, ({ one }) => ({
  node: one(nodes, { fields: [nodeRetries.nodeId], references: [nodes.id] }),
  triggeredBy: one(users, {
    fields: [nodeRetries.triggeredByUserId],
    references: [users.id],
  }),
}))

export const artifactsRelations = relations(artifacts, ({ one }) => ({
  tenant: one(tenants, { fields: [artifacts.tenantId], references: [tenants.id] }),
  run: one(runs, { fields: [artifacts.runId], references: [runs.id] }),
  node: one(nodes, { fields: [artifacts.nodeId], references: [nodes.id] }),
  blob: one(artifactBlobs, {
    fields: [artifacts.blobSha256],
    references: [artifactBlobs.sha256],
  }),
}))

export const irDocumentsRelations = relations(irDocuments, ({ one }) => ({
  run: one(runs, { fields: [irDocuments.runId], references: [runs.id] }),
  tenant: one(tenants, { fields: [irDocuments.tenantId], references: [tenants.id] }),
}))

export const sandboxesRelations = relations(sandboxes, ({ one, many }) => ({
  run: one(runs, { fields: [sandboxes.runId], references: [runs.id] }),
  credentials: many(sandboxCredentials),
}))

export const sandboxCredentialsRelations = relations(sandboxCredentials, ({ one }) => ({
  sandbox: one(sandboxes, {
    fields: [sandboxCredentials.sandboxId],
    references: [sandboxes.id],
  }),
}))

export const costEventsRelations = relations(costEvents, ({ one }) => ({
  tenant: one(tenants, { fields: [costEvents.tenantId], references: [tenants.id] }),
  run: one(runs, { fields: [costEvents.runId], references: [runs.id] }),
  node: one(nodes, { fields: [costEvents.nodeId], references: [nodes.id] }),
}))

export const auditLogRelations = relations(auditLog, ({ one }) => ({
  tenant: one(tenants, { fields: [auditLog.tenantId], references: [tenants.id] }),
  actor: one(users, { fields: [auditLog.actorUserId], references: [users.id] }),
}))

export const activityFeedRelations = relations(activityFeed, ({ one }) => ({
  tenant: one(tenants, { fields: [activityFeed.tenantId], references: [tenants.id] }),
  actor: one(users, { fields: [activityFeed.actorUserId], references: [users.id] }),
}))

export const assetSyncQueueRelations = relations(assetSyncQueue, ({ one }) => ({
  source: one(assetSources, {
    fields: [assetSyncQueue.sourceId],
    references: [assetSources.id],
  }),
}))

// pricingBook has no FKs → no relations
