'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createRun } from '@/lib/runs/actions'
import { zhRuns } from '@/lib/strings/zh'
import { cn } from '@/lib/utils'

type FormState = { ok: false; code?: string } | { ok: true; runId: string } | null

type Props = { tenantSlug: string }

export function NewRunForm({ tenantSlug }: Props) {
  const router = useRouter()

  const [state, action, isPending] = useActionState<FormState, FormData>(
    async (_prev, fd) =>
      createRun({ title: fd.get('title') as string, oneLiner: fd.get('oneLiner') as string }),
    null,
  )

  useEffect(() => {
    if (state?.ok) router.push(`/t/${tenantSlug}/runs/${state.runId}`)
  }, [state, tenantSlug, router])

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="title" className="text-sm font-medium text-[var(--text-body)]">
          {zhRuns.new.titleLabel}
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          placeholder={zhRuns.new.titlePlaceholder}
          className="rounded-[var(--r-md)] border border-[var(--text-faint)] px-3 py-2 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="oneLiner" className="text-sm font-medium text-[var(--text-body)]">
          {zhRuns.new.oneLinerLabel}
        </label>
        <textarea
          id="oneLiner"
          name="oneLiner"
          required
          rows={4}
          placeholder={zhRuns.new.oneLinerPlaceholder}
          className="rounded-[var(--r-md)] border border-[var(--text-faint)] px-3 py-2 text-sm"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <p className="w-full text-xs text-[var(--text-muted)]">示例：</p>
        {zhRuns.new.examples.map((ex) => (
          <button
            key={ex}
            type="button"
            className="rounded-full border border-[var(--text-faint)] px-3 py-1 text-xs text-[var(--text-muted)]"
            onClick={() => {
              const ta = document.querySelector<HTMLTextAreaElement>('#oneLiner')
              if (ta) ta.value = ex
            }}
          >
            {ex}
          </button>
        ))}
      </div>

      {state && !state.ok && (
        <p className="text-sm text-[var(--status-halt)]">创建失败，请稍后重试</p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className={cn(
          'rounded-[var(--r-md)] bg-[var(--status-run)] px-6 py-2 font-medium text-white',
          isPending && 'opacity-50 cursor-not-allowed',
        )}
      >
        {isPending ? zhRuns.new.submitting : zhRuns.new.submit}
      </button>
    </form>
  )
}
