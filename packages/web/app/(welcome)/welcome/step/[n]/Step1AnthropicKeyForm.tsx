'use client'

import { useActionState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { FormMessage } from '@/components/ui/form-message'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { zhWelcome, zhErrorsWelcome } from '@/lib/strings/zh'
import { submitStep1 } from './actions'
import type { WelcomeActionResult } from '@/lib/errors/welcome-errors'

const INITIAL_STATE: WelcomeActionResult = { ok: true } as WelcomeActionResult

export function Step1AnthropicKeyForm() {
  const [state, formAction, isPending] = useActionState(submitStep1, INITIAL_STATE)

  // Determine if the error is a field-level error on the key field
  const fieldError =
    !state.ok && state.code === 'INVALID_KEY_FORMAT' && state.field === 'key'
      ? zhErrorsWelcome[state.code]
      : null

  // Determine if there is a banner-level error (non-field error)
  const bannerError = !state.ok && state.field !== 'key' ? zhErrorsWelcome[state.code] : null

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold">{zhWelcome.step1.title}</h2>

      {bannerError != null && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{bannerError}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="anthropic-key">{zhWelcome.step1.keyLabel}</Label>
        <Input
          id="anthropic-key"
          name="key"
          type="password"
          autoComplete="off"
          placeholder={zhWelcome.step1.keyHint}
          aria-invalid={fieldError != null ? true : undefined}
          disabled={isPending}
        />
        {fieldError != null && <FormMessage>{fieldError}</FormMessage>}
      </div>

      <Button type="submit" disabled={isPending}>
        {isPending ? zhWelcome.step1.submitting : zhWelcome.step1.submit}
      </Button>
    </form>
  )
}
