import { cn } from '@/lib/utils'

export function FormMessage({
  children,
  className,
}: {
  children?: React.ReactNode
  className?: string
}) {
  if (!children) return null
  return (
    <p role="alert" className={cn('text-sm text-destructive mt-1', className)}>
      {children}
    </p>
  )
}
