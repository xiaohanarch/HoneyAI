import { redirect } from 'next/navigation'

export default async function TenantIndexPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  redirect(`/t/${slug}/runs`)
}
