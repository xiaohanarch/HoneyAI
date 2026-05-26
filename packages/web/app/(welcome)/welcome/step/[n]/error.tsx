'use client'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

export default function StepError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col gap-4 max-w-sm w-full">
      <Alert variant="destructive">
        <AlertTitle>本步出错</AlertTitle>
        <AlertDescription>请重试当前步骤</AlertDescription>
      </Alert>
      <Button onClick={reset} variant="outline">
        重试
      </Button>
    </div>
  )
}
