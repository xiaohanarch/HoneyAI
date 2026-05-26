import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Card, CardHeader, CardTitle, CardContent } from './card'

describe('Card (shadcn primitive smoke)', () => {
  it('renders with header + title + content', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>标题</CardTitle>
        </CardHeader>
        <CardContent>内容</CardContent>
      </Card>,
    )
    expect(screen.getByText('标题')).toBeInTheDocument()
    expect(screen.getByText('内容')).toBeInTheDocument()
  })
})
