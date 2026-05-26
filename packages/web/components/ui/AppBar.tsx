'use client'
import * as React from 'react'
import { User as UserIcon } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './dropdown-menu'
import { Avatar, AvatarFallback } from './avatar'
import { Button } from './button'
import { zh } from '@/lib/strings/zh'

export type Tenant = {
  id: string
  slug: string
  name: string
}

export type AppBarUser = {
  name: string
}

export type AppBarProps = {
  tenants: Tenant[]
  currentTenant: Tenant
  user: AppBarUser
  onTenantChange: (slug: string) => void
  onSignOut: () => void
}

export function AppBar({ tenants, currentTenant, user, onTenantChange, onSignOut }: AppBarProps) {
  const userInitial = user.name.charAt(0).toUpperCase()
  const showTenantDropdown = tenants.length > 1

  return (
    <header
      className="flex h-14 items-center justify-between border-b px-4"
      style={{
        backgroundColor: 'var(--bg-elev)',
        borderColor: 'var(--bg-deep)',
      }}
    >
      <div className="flex items-center gap-4">
        <span
          className="text-lg font-semibold"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--text-strong)' }}
        >
          {zh.common.appName}
        </span>
        {showTenantDropdown ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" aria-label={zh.appBar.switchTenant}>
                {currentTenant.name}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>{zh.appBar.switchTenant}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {tenants.map((t) => (
                <DropdownMenuItem key={t.id} onSelect={() => onTenantChange(t.slug)}>
                  {t.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <span className="text-sm" style={{ color: 'var(--text-body)' }}>
            {currentTenant.name}
          </span>
        )}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={zh.appBar.userMenu}>
            <Avatar className="h-8 w-8">
              <AvatarFallback>{userInitial || <UserIcon className="h-4 w-4" />}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>{user.name}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onSignOut}>{zh.appBar.signOut}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
