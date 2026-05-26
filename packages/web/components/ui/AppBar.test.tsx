import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppBar, type Tenant } from './AppBar'

const tenantA: Tenant = {
  id: '00000000-0000-0000-0000-000000000001',
  slug: 'alice',
  name: 'Alice Personal',
}
const tenantB: Tenant = {
  id: '00000000-0000-0000-0000-000000000002',
  slug: 'team-x',
  name: 'Team X',
}

describe('AppBar', () => {
  it('renders HoneyAI text logo', () => {
    render(
      <AppBar
        tenants={[tenantA]}
        currentTenant={tenantA}
        user={{ name: 'alice' }}
        onTenantChange={() => {}}
        onSignOut={() => {}}
      />,
    )
    expect(screen.getByText('HoneyAI')).toBeInTheDocument()
  })

  it('shows current tenant name as static label when only 1 tenant', () => {
    render(
      <AppBar
        tenants={[tenantA]}
        currentTenant={tenantA}
        user={{ name: 'alice' }}
        onTenantChange={() => {}}
        onSignOut={() => {}}
      />,
    )
    expect(screen.getByText('Alice Personal')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /切换租户/ })).not.toBeInTheDocument()
  })

  it('shows tenant dropdown trigger when 2+ tenants', () => {
    render(
      <AppBar
        tenants={[tenantA, tenantB]}
        currentTenant={tenantA}
        user={{ name: 'alice' }}
        onTenantChange={() => {}}
        onSignOut={() => {}}
      />,
    )
    expect(screen.getByRole('button', { name: /切换租户/ })).toBeInTheDocument()
  })

  it('invokes onTenantChange with new slug when tenant dropdown item clicked', async () => {
    const user = userEvent.setup()
    const onTenantChange = vi.fn()
    render(
      <AppBar
        tenants={[tenantA, tenantB]}
        currentTenant={tenantA}
        user={{ name: 'alice' }}
        onTenantChange={onTenantChange}
        onSignOut={() => {}}
      />,
    )
    await user.click(screen.getByRole('button', { name: /切换租户/ }))
    await user.click(await screen.findByText('Team X'))
    expect(onTenantChange).toHaveBeenCalledTimes(1)
    expect(onTenantChange).toHaveBeenCalledWith('team-x')
  })

  it('renders user avatar fallback with first letter of user name (uppercased)', () => {
    render(
      <AppBar
        tenants={[tenantA]}
        currentTenant={tenantA}
        user={{ name: 'alice' }}
        onTenantChange={() => {}}
        onSignOut={() => {}}
      />,
    )
    expect(screen.getByText('A')).toBeInTheDocument()
  })

  it('invokes onSignOut when user menu sign-out item clicked', async () => {
    const user = userEvent.setup()
    const onSignOut = vi.fn()
    render(
      <AppBar
        tenants={[tenantA]}
        currentTenant={tenantA}
        user={{ name: 'alice' }}
        onTenantChange={() => {}}
        onSignOut={onSignOut}
      />,
    )
    await user.click(screen.getByRole('button', { name: /用户菜单/ }))
    await user.click(await screen.findByText('退出登录'))
    expect(onSignOut).toHaveBeenCalledTimes(1)
  })
})
