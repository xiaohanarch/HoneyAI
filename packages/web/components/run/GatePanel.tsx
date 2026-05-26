'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { approveGate, rejectGate } from '@/lib/runs/actions'
import { cn } from '@/lib/utils'
import { zhRuns } from '@/lib/strings/zh'

type Props = { runId: string; nodeId: string; tenantSlug: string }

export function GatePanel({ runId, nodeId, tenantSlug: _tenantSlug }: Props) {
  const router = useRouter()
  const [showReject, setShowReject] = useState(false)
  const [reason, setReason] = useState('')
  const [isPending, startTransition] = useTransition()

  const handleApprove = () => {
    startTransition(async () => {
      const result = await approveGate({ runId, nodeId })
      if (result.ok) router.refresh()
    })
  }

  const handleReject = () => {
    startTransition(async () => {
      const result = await rejectGate({ runId, nodeId, reason })
      if (result.ok) router.refresh()
    })
  }

  return (
    <div className="rounded-[var(--r-lg)] border border-[var(--status-review)] bg-[var(--bg-card)] p-4 shadow-[var(--shadow-soft)]">
      <p className="mb-3 text-sm font-medium text-[var(--text-body)]">需要人工审批</p>

      {!showReject ? (
        <div className="flex gap-2">
          <button
            onClick={handleApprove}
            disabled={isPending}
            className={cn(
              'rounded-[var(--r-md)] bg-[var(--status-done)] px-4 py-2 text-sm font-medium text-white transition-opacity',
              isPending && 'opacity-50 cursor-not-allowed',
            )}
          >
            {zhRuns.detail.approve}
          </button>
          <button
            onClick={() => setShowReject(true)}
            disabled={isPending}
            className="rounded-[var(--r-md)] border border-[var(--status-halt)] px-4 py-2 text-sm font-medium text-[var(--status-halt)] transition-opacity"
          >
            {zhRuns.detail.reject}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={zhRuns.detail.rejectReason}
            className="rounded-[var(--r-md)] border border-[var(--text-faint)] p-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--status-review)]"
            rows={3}
          />
          <div className="flex gap-2">
            <button
              onClick={handleReject}
              disabled={isPending || !reason.trim()}
              className={cn(
                'rounded-[var(--r-md)] bg-[var(--status-halt)] px-4 py-2 text-sm font-medium text-white',
                (isPending || !reason.trim()) && 'opacity-50 cursor-not-allowed',
              )}
            >
              {zhRuns.detail.rejectSubmit}
            </button>
            <button
              onClick={() => {
                setShowReject(false)
                setReason('')
              }}
              className="rounded-[var(--r-md)] border px-4 py-2 text-sm font-medium text-[var(--text-muted)]"
            >
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
