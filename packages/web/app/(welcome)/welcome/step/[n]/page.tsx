import { notFound } from 'next/navigation'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getTenantBootstrap } from '@/lib/bootstrap/read'
import { ProgressCards } from '@/components/welcome/ProgressCards'
import { Step1AnthropicKeyForm } from './Step1AnthropicKeyForm'
import { Step2GithubAppForm } from './Step2GithubAppForm'
import { Step3GithubRepoForm } from './Step3GithubRepoForm'
import { Step4SkillsForm } from './Step4SkillsForm'

const FORMS = {
  1: Step1AnthropicKeyForm,
  2: Step2GithubAppForm,
  3: Step3GithubRepoForm,
  4: Step4SkillsForm,
} as const

export default async function WelcomeStepPage({ params }: { params: Promise<{ n: string }> }) {
  const { n } = await params
  const step = Number(n)
  if (!Number.isInteger(step) || step < 1 || step > 4) notFound()

  const session = await auth()
  if (!session?.user?.tenantId) redirect('/login')

  const r = await getTenantBootstrap(session.user.tenantId)
  const completed: number[] = []
  if (r?.bootstrap?.anthropicKeyCiphertext) completed.push(1)
  if (r?.bootstrap?.githubAppInstalled) completed.push(2)
  if (r?.bootstrap?.pendingRepoOwnerName) completed.push(3)

  const Form = FORMS[step as 1 | 2 | 3 | 4]
  return (
    <div className="grid grid-cols-[1fr_320px] gap-8">
      <Form />
      <aside>
        <ProgressCards currentStep={step} completed={completed} />
      </aside>
    </div>
  )
}
