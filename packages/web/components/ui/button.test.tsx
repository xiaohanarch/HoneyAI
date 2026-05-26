import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Button } from './button'

describe('Button (shadcn primitive smoke)', () => {
  it('renders default variant with children', () => {
    render(<Button>点击</Button>)
    expect(screen.getByRole('button', { name: '点击' })).toBeInTheDocument()
  })

  it('renders destructive variant without crashing', () => {
    render(<Button variant="destructive">删除</Button>)
    expect(screen.getByRole('button', { name: '删除' })).toBeInTheDocument()
  })

  it('renders disabled button', () => {
    render(<Button disabled>禁用</Button>)
    expect(screen.getByRole('button', { name: '禁用' })).toBeDisabled()
  })
})
