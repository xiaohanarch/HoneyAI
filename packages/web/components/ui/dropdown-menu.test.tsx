import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from './dropdown-menu'

describe('DropdownMenu (shadcn primitive smoke)', () => {
  it('renders closed trigger', () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>打开</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>项目 1</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    )
    expect(screen.getByRole('button', { name: '打开' })).toBeInTheDocument()
    expect(screen.queryByText('项目 1')).not.toBeInTheDocument()
  })

  it('opens menu and shows items on trigger click', async () => {
    const user = userEvent.setup()
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>打开</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>项目 1</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    )
    await user.click(screen.getByRole('button', { name: '打开' }))
    expect(await screen.findByText('项目 1')).toBeInTheDocument()
  })
})
