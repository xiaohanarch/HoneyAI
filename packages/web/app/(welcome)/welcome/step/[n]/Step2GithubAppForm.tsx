'use client'

// TODO: NEXT_PUBLIC_GITHUB_APP_INSTALL_URL is intentionally NOT wired through
// @honeyai/core env loader — Next.js inlines NEXT_PUBLIC_* at build time without
// needing the server-side env reader. If server-side validation of this var
// is ever required, wire it in packages/core/src/env/index.ts.

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { zhWelcome, zhErrorsWelcome } from '@/lib/strings/zh'
import { submitStep2 } from './actions'
import type { WelcomeActionResult } from '@/lib/errors/welcome-errors'

const INITIAL_STATE: WelcomeActionResult = { ok: true } as WelcomeActionResult

export function Step2GithubAppForm() {
  const [state, formAction, isPending] = useActionState(submitStep2, INITIAL_STATE)

  // TS strict: bracket notation to satisfy noUncheckedIndexedAccess on process.env.
  // Read lazily inside the component so tests can set the env var before render.
  const installUrl = process.env['NEXT_PUBLIC_GITHUB_APP_INSTALL_URL'] ?? '#'

  const bannerError = !state.ok ? (state.message ?? zhErrorsWelcome[state.code]) : null

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold">{zhWelcome.step2.title}</h2>

      {bannerError != null && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{bannerError}</AlertDescription>
        </Alert>
      )}

      <a href={installUrl} target="_blank" rel="noopener noreferrer" className="inline-flex">
        <Button type="button" variant="outline">
          {zhWelcome.step2.install}
        </Button>
      </a>

      <input type="hidden" name="confirm" value="on" />

      <Button type="submit" disabled={isPending}>
        {isPending ? zhWelcome.step1.submitting : zhWelcome.step2.confirm}
      </Button>
    </form>
  )
}
