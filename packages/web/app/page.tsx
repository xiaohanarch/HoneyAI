// packages/web/app/page.tsx
import Link from 'next/link'
import { zh } from '@/lib/strings/zh'

export default function HomePage() {
  return (
    <main className="bg-atmosphere grain min-h-screen flex flex-col items-center justify-center gap-[var(--space-8)]">
      <div className="text-center space-y-[var(--space-4)]">
        <h1
          className="font-display text-[var(--text-3xl)] text-[var(--text-strong)]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {zh.welcome.heading}
        </h1>
        <p className="text-[var(--text-body)] text-[var(--text-lg)]">{zh.welcome.subheading}</p>
      </div>
      <Link
        href="/login"
        className="px-[var(--space-6)] py-[var(--space-3)] rounded-[var(--r-md)] bg-[var(--text-strong)] text-[var(--bg-elev)] text-[var(--text-sm)] font-medium transition-opacity duration-[var(--dur-fast)] hover:opacity-80"
      >
        {zh.welcome.loginLink}
      </Link>
    </main>
  )
}
