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
        return (
          <li
            key={s.n}
            data-state={state}
            role="listitem"
            className={cn(
              'rounded-md border p-3 transition-all duration-300',
              state === 'done' && 'border-emerald-300 bg-emerald-50',
              state === 'running' && 'border-amber-300 bg-amber-50',
              state === 'idle' && 'border-neutral-200 bg-neutral-50 opacity-60',
            )}
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
