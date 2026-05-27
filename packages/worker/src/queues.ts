// BullMQ job type definitions + queue name constants

export type ScheduleRunJob = { runId: string; tenantId: string }
export type AdvanceRunJob = { runId: string; tenantId: string; completedNodeId?: string }

export const SCHEDULE_RUN_QUEUE = 'schedule-run'
export const ADVANCE_RUN_QUEUE = 'advance-run'
