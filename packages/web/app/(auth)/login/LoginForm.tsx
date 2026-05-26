'use client'

import { useState, useTransition } from 'react'
import { signIn } from 'next-auth/react'
import { zh } from '@/lib/strings/zh'

export default function LoginForm() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await signIn('credentials', {
        username,
        password,
        redirect: false,
      })
      if (result?.error) {
        setError(zh.login.errorInvalid)
      } else {
        // Redirect to root on success; middleware / tenant routing handles the rest
        window.location.href = '/'
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-[var(--space-4)] w-full max-w-sm">
      <div className="flex flex-col gap-[var(--space-2)]">
        <input
          id="username"
          type="text"
          name="username"
          placeholder={zh.login.usernamePlaceholder}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          autoComplete="username"
          className="w-full px-[var(--space-4)] py-[var(--space-3)] rounded-[var(--r-md)] border border-[var(--text-faint)] bg-[var(--bg-card)] text-[var(--text-body)] text-[var(--text-sm)] outline-none focus:ring-2 focus:ring-[var(--status-review)]"
        />
      </div>
      <div className="flex flex-col gap-[var(--space-2)]">
        <input
          id="password"
          type="password"
          name="password"
          placeholder={zh.login.passwordPlaceholder}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          className="w-full px-[var(--space-4)] py-[var(--space-3)] rounded-[var(--r-md)] border border-[var(--text-faint)] bg-[var(--bg-card)] text-[var(--text-body)] text-[var(--text-sm)] outline-none focus:ring-2 focus:ring-[var(--status-review)]"
        />
      </div>
      {error != null && (
        <p className="text-[var(--status-halt)] text-[var(--text-sm)]" role="alert">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={isPending}
        className="w-full py-[var(--space-3)] rounded-[var(--r-md)] bg-[var(--text-strong)] text-[var(--bg-elev)] text-[var(--text-sm)] font-medium transition-opacity duration-[var(--dur-fast)] hover:opacity-80 disabled:opacity-40"
      >
        {isPending ? zh.common.loading : zh.login.submitLabel}
      </button>
    </form>
  )
}
