'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { zhWelcome, zhErrorsWelcome } from '@/lib/strings/zh'
import { submitStep4 } from './actions'
import type { WelcomeActionResult } from '@/lib/errors/welcome-errors'

const INITIAL_STATE: WelcomeActionResult = { ok: true } as WelcomeActionResult

export function Step4SkillsForm() {
  const [state, formAction, isPending] = useActionState(submitStep4, INITIAL_STATE)
  const bannerError = !state.ok ? (state.message ?? zhErrorsWelcome[state.code]) : null
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold">{zhWelcome.step4.title}</h2>
      {bannerError != null && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{bannerError}</AlertDescription>
        </Alert>
      )}
      <div className="flex gap-3">
        <Button type="submit" name="action" value="import" disabled={isPending}>
          {zhWelcome.step4.import}
        </Button>
        <Button type="submit" name="action" value="skip" variant="outline" disabled={isPending}>
          {zhWelcome.step4.skip}
        </Button>
      </div>
    </form>
  )
}
