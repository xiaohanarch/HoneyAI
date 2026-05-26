// packages/web/app/t/[slug]/layout.tsx
// Tenant route group — layout stub. Tenant auth check + withTenant lands in slice 4.5.
export default function TenantLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
