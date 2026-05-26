'use client'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

export default function WelcomeError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col gap-4 max-w-sm w-full mx-auto mt-12">
      <Alert variant="destructive">
        <AlertTitle>引导出错</AlertTitle>
        <AlertDescription>引导步骤遇到错误，请稍后重试</AlertDescription>
      </Alert>
      <Button onClick={reset} variant="outline">
        重试
      </Button>
    </div>
  )
}
