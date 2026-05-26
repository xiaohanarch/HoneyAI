import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RunStatusBadge } from './RunStatusBadge'

describe('RunStatusBadge', () => {
  it('renders "运行中" for running status', () => {
    render(<RunStatusBadge status="running" />)
    expect(screen.getByText('运行中')).toBeTruthy()
  })

  it('renders "等待审批" for paused_at_gate status', () => {
    render(<RunStatusBadge status="paused_at_gate" />)
    expect(screen.getByText('等待审批')).toBeTruthy()
  })

  it('renders "已完成" for completed status', () => {
    render(<RunStatusBadge status="completed" />)
    expect(screen.getByText('已完成')).toBeTruthy()
  })

  it('renders "失败" for failed status', () => {
    render(<RunStatusBadge status="failed" />)
    expect(screen.getByText('失败')).toBeTruthy()
  })

  it('renders "已创建" for created status', () => {
    render(<RunStatusBadge status="created" />)
    expect(screen.getByText('已创建')).toBeTruthy()
  })
})
