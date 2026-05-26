import { cn } from '@/lib/utils'

type State = 'idle' | 'running' | 'done'

const STEPS = [
  { n: 1, label: 'Anthropic API Key' },
  { n: 2, label: 'GitHub App' },
  { n: 3, label: '仓库' },
  { n: 4, label: 'Skills' },
]

export function ProgressCards({
  currentStep,
  completed,
}: {
  currentStep: number
  completed: number[]
}) {
  return (
    <ol className="space-y-3" role="list">
      {STEPS.map((s) => {
        const state: State = completed.includes(s.n)
          ? 'done'
          : s.n === currentStep
            ? 'running'
            : 'idle'
        // Border/background driven by design tokens (styles/tokens.css):
        //   data-state=done    → --status-done   (green)
        //   data-state=running → --status-run    (amber, pulse-run animation)
        //   data-state=idle    → --status-idle-soft
        // Keeps state colors in one source of truth instead of hardcoded Tailwind.
        const tokenStyle: React.CSSProperties =
          state === 'done'
            ? {
                borderColor: 'var(--status-done)',
                background: 'color-mix(in oklch, var(--status-done) 12%, var(--bg-card))',
              }
            : state === 'running'
              ? {
                  borderColor: 'var(--status-run)',
                  background: 'color-mix(in oklch, var(--status-run) 12%, var(--bg-card))',
                }
              : {
                  borderColor: 'var(--status-idle-soft)',
                  background: 'var(--bg-card)',
                  opacity: 0.6,
                }
        return (
          <li
            key={s.n}
            data-state={state}
            role="listitem"
            aria-current={state === 'running' ? 'step' : undefined}
            style={tokenStyle}
            className={cn('rounded-md border p-3 transition-all duration-300')}
          >
            <div className="text-sm font-medium">{s.label}</div>
            <div className="text-xs text-muted-foreground">
              {state === 'done' ? '已完成' : state === 'running' ? '进行中' : '待开始'}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
