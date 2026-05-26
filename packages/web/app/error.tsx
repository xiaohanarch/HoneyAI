'use client'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

export default function RootError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="flex flex-col gap-4 max-w-sm w-full">
        <Alert variant="destructive">
          <AlertTitle>系统出错</AlertTitle>
          <AlertDescription>请稍后重试</AlertDescription>
        </Alert>
        <Button onClick={reset} variant="outline">
          重试
        </Button>
      </div>
    </main>
  )
}
