// packages/web/app/(welcome)/welcome/step/[n]/page.test.tsx
// TDD: write tests before implementation (RED → GREEN → IMPROVE).

import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as React from 'react'

// Mock next/navigation — redirect and notFound throw so we can assert them
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`)
  }),
  notFound: vi.fn(() => {
    throw new Error('NOT_FOUND')
  }),
}))

// Auth mock
const mockGetSession = vi.fn()
vi.mock('@/lib/auth', () => ({
  auth: () => mockGetSession(),
}))

// Bootstrap mock
const mockGetBootstrap = vi.fn()
vi.mock('@/lib/bootstrap/read', () => ({
  getTenantBootstrap: (...args: unknown[]) => mockGetBootstrap(...args),
}))

// Mock form components (they use 'use client' which doesn't work in jsdom RSC tests)
vi.mock('./Step1AnthropicKeyForm', () => ({
  Step1AnthropicKeyForm: () => React.createElement('div', null, 'Step1Form'),
}))
vi.mock('./Step2GithubAppForm', () => ({
  Step2GithubAppForm: () => React.createElement('div', null, 'Step2Form'),
}))
vi.mock('./Step3GithubRepoForm', () => ({
  Step3GithubRepoForm: () => React.createElement('div', null, 'Step3Form'),
}))
vi.mock('./Step4SkillsForm', () => ({
  Step4SkillsForm: () => React.createElement('div', null, 'Step4Form'),
}))

// Mock ProgressCards
vi.mock('@/components/welcome/ProgressCards', () => ({
  ProgressCards: ({ currentStep, completed }: { currentStep: number; completed: number[] }) =>
    React.createElement(
      'div',
      {
        'data-testid': 'progress-cards',
        'data-step': currentStep,
        'data-completed': completed.join(','),
      },
      'ProgressCards',
    ),
}))

import WelcomeStepPage from './page'

const SESSION = (tenantId = 'tenant-1') => ({
  user: { id: 'user-1', tenantId },
  expires: '2099-01-01',
})

describe('WelcomeStepPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('notFound for out-of-range steps', () => {
    it('calls notFound for step "0"', async () => {
      await expect(WelcomeStepPage({ params: Promise.resolve({ n: '0' }) })).rejects.toThrow(
        'NOT_FOUND',
      )
    })

    it('calls notFound for step "5"', async () => {
      await expect(WelcomeStepPage({ params: Promise.resolve({ n: '5' }) })).rejects.toThrow(
        'NOT_FOUND',
      )
    })

    it('calls notFound for step "abc"', async () => {
      await expect(WelcomeStepPage({ params: Promise.resolve({ n: 'abc' }) })).rejects.toThrow(
        'NOT_FOUND',
      )
    })

    it('calls notFound for step "-1"', async () => {
      await expect(WelcomeStepPage({ params: Promise.resolve({ n: '-1' }) })).rejects.toThrow(
        'NOT_FOUND',
      )
    })
  })

  describe('authentication guard', () => {
    it('redirects to /login when session is missing for step 1', async () => {
      mockGetSession.mockResolvedValue(null)
      await expect(WelcomeStepPage({ params: Promise.resolve({ n: '1' }) })).rejects.toThrow(
        'REDIRECT:/login',
      )
    })

    it('redirects to /login when session has no tenantId for step 2', async () => {
      mockGetSession.mockResolvedValue({ user: { id: 'user-1' }, expires: '2099-01-01' })
      await expect(WelcomeStepPage({ params: Promise.resolve({ n: '2' }) })).rejects.toThrow(
        'REDIRECT:/login',
      )
    })
  })

  describe('renders JSX for valid steps with session', () => {
    // Helper: walk a React element tree and find elements matching a predicate
    function findInTree(
      element: unknown,
      predicate: (el: React.ReactElement) => boolean,
    ): React.ReactElement | null {
      if (!React.isValidElement(element)) return null
      if (predicate(element)) return element
      const { children } = element.props as { children?: unknown }
      if (!children) return null
      if (Array.isArray(children)) {
        for (const child of children) {
          const found = findInTree(child, predicate)
          if (found) return found
        }
      } else {
        return findInTree(children, predicate)
      }
      return null
    }

    it('step 2: renders a two-child grid (Form + aside)', async () => {
      mockGetSession.mockResolvedValue(SESSION())
      mockGetBootstrap.mockResolvedValue({
        slug: 'alice',
        bootstrap: { anthropicKeyCiphertext: 'v1:abc' },
      })

      const result = await WelcomeStepPage({ params: Promise.resolve({ n: '2' }) })

      expect(result).toBeTruthy()
      expect(React.isValidElement(result)).toBe(true)

      // Top-level element is a div with two children
      const el = result as React.ReactElement
      const { children } = el.props as { children: React.ReactElement[] }
      expect(Array.isArray(children)).toBe(true)
      expect(children).toHaveLength(2)

      // Second child is the aside containing ProgressCards
      const aside = children[1]
      expect(React.isValidElement(aside)).toBe(true)
      expect((aside as React.ReactElement).type).toBe('aside')
    })

    it('step 1: result is a valid React element', async () => {
      mockGetSession.mockResolvedValue(SESSION())
      mockGetBootstrap.mockResolvedValue({ slug: 'alice', bootstrap: null })

      const result = await WelcomeStepPage({ params: Promise.resolve({ n: '1' }) })
      expect(React.isValidElement(result)).toBe(true)
    })

    it('step 3: result is a valid React element', async () => {
      mockGetSession.mockResolvedValue(SESSION())
      mockGetBootstrap.mockResolvedValue({
        slug: 'alice',
        bootstrap: {
          anthropicKeyCiphertext: 'v1:abc',
          githubAppInstalled: true,
        },
      })

      const result = await WelcomeStepPage({ params: Promise.resolve({ n: '3' }) })
      expect(React.isValidElement(result)).toBe(true)
    })

    it('step 4: result is a valid React element', async () => {
      mockGetSession.mockResolvedValue(SESSION())
      mockGetBootstrap.mockResolvedValue({
        slug: 'alice',
        bootstrap: {
          anthropicKeyCiphertext: 'v1:abc',
          githubAppInstalled: true,
          pendingRepoOwnerName: 'alice',
        },
      })

      const result = await WelcomeStepPage({ params: Promise.resolve({ n: '4' }) })
      expect(React.isValidElement(result)).toBe(true)
    })

    it('step 2 with key done: ProgressCards receives currentStep=2 and completed=[1]', async () => {
      mockGetSession.mockResolvedValue(SESSION())
      mockGetBootstrap.mockResolvedValue({
        slug: 'alice',
        bootstrap: { anthropicKeyCiphertext: 'v1:abc' },
      })

      const result = await WelcomeStepPage({ params: Promise.resolve({ n: '2' }) })
      // aside > ProgressCards — inspect props directly from the JSX tree
      const el = result as React.ReactElement
      const { children } = el.props as { children: React.ReactElement[] }
      const aside = children[1] as React.ReactElement
      const progressCards = (aside.props as { children: React.ReactElement }).children
      expect(React.isValidElement(progressCards)).toBe(true)
      const { currentStep, completed } = progressCards.props as {
        currentStep: number
        completed: number[]
      }
      expect(currentStep).toBe(2)
      expect(completed).toEqual([1])
    })

    it('step 3 with key + github done: ProgressCards receives completed=[1,2]', async () => {
      mockGetSession.mockResolvedValue(SESSION())
      mockGetBootstrap.mockResolvedValue({
        slug: 'alice',
        bootstrap: {
          anthropicKeyCiphertext: 'v1:abc',
          githubAppInstalled: true,
        },
      })

      const result = await WelcomeStepPage({ params: Promise.resolve({ n: '3' }) })
      const el = result as React.ReactElement
      const { children } = el.props as { children: React.ReactElement[] }
      const aside = children[1] as React.ReactElement
      const progressCards = (aside.props as { children: React.ReactElement }).children
      const { currentStep, completed } = progressCards.props as {
        currentStep: number
        completed: number[]
      }
      expect(currentStep).toBe(3)
      expect(completed).toEqual([1, 2])
    })
  })
})
