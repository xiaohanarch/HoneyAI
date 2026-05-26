import type { Metadata } from 'next'
import LoginForm from './LoginForm.js'
import { zh } from '@/lib/strings/zh.js'

export const metadata: Metadata = {
  title: `${zh.login.title} — HoneyAI`,
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-atmosphere grain flex items-center justify-center p-[var(--space-6)]">
      <div
        className="w-full max-w-sm bg-[var(--bg-card)] rounded-[var(--r-xl)] p-[var(--space-8)] flex flex-col gap-[var(--space-6)]"
        style={{ boxShadow: 'var(--shadow-elev)' }}
      >
        <div className="text-center">
          <h1 className="text-[var(--text-xl)] font-semibold text-[var(--text-strong)]">
            {zh.login.title}
          </h1>
        </div>
        <LoginForm />
      </div>
    </div>
  )
}
