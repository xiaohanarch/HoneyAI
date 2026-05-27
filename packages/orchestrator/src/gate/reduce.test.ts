import { describe, it, expect, vi } from 'vitest'
import { reduceGate } from './reduce.js'
import type { GateState } from './types.js'
import { makeGateOpened } from '../test/fixtures.js'

// ─── fixtures ────────────────────────────────────────────────────────────────

const NODE_ID = 'node-gate-1'
const ARTIFACT_ID = 'artifact-1'
const USER_ID = 'user-1'

const openedAt = new Date('2024-01-01T10:00:00Z')
const viewedAt = new Date('2024-01-01T10:01:00Z')
const passedAt = new Date('2024-01-01T10:02:00Z')

const openedState: GateState = makeGateOpened({ nodeId: NODE_ID, openedAt })

const openedWithViewed: GateState = makeGateOpened({ nodeId: NODE_ID, openedAt, viewedAt })

const passedState: GateState = {
  nodeId: NODE_ID,
  status: 'passed',
  openedAt,
  viewedAt,
  passedAt,
  passedByUserId: USER_ID,
  pinnedArtifactId: ARTIFACT_ID,
}

// ─── 1. null + GATE_OPENED → opened ──────────────────────────────────────────

describe('reduceGate — GATE_OPENED (spec §10.3)', () => {
  it('null + GATE_OPENED → opened with openedAt', () => {
    const next = reduceGate(null, { type: 'GATE_OPENED', nodeId: NODE_ID, openedAt })
    expect(next?.status).toBe('opened')
    expect(next?.nodeId).toBe(NODE_ID)
    expect(next?.openedAt).toBe(openedAt)
    expect(next?.viewedAt).toBeUndefined()
    expect(next?.passedAt).toBeUndefined()
  })

  it('opened + GATE_OPENED → stays opened, emits warn', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const next = reduceGate(openedState, { type: 'GATE_OPENED', nodeId: NODE_ID, openedAt })
    expect(next).toBe(openedState) // same object reference, no mutation
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })
})

// ─── 2. opened + USER_VIEWED_EDITOR → opened with viewedAt ──────────────────

describe('reduceGate — USER_VIEWED_EDITOR (spec §10.3)', () => {
  it('opened + USER_VIEWED_EDITOR → opened with viewedAt', () => {
    const next = reduceGate(openedState, { type: 'USER_VIEWED_EDITOR', viewedAt })
    expect(next?.status).toBe('opened')
    expect(next?.viewedAt).toBe(viewedAt)
    // other fields unchanged
    expect(next?.nodeId).toBe(NODE_ID)
    expect(next?.openedAt).toBe(openedAt)
  })
})

// ─── 3. opened + PASS_GATE_OK → passed ───────────────────────────────────────

describe('reduceGate — PASS_GATE_OK (spec §10.3)', () => {
  it('opened + PASS_GATE_OK → passed with all fields set', () => {
    const next = reduceGate(openedWithViewed, {
      type: 'PASS_GATE_OK',
      passedAt,
      passedByUserId: USER_ID,
      pinnedArtifactId: ARTIFACT_ID,
    })
    expect(next?.status).toBe('passed')
    expect(next?.passedAt).toBe(passedAt)
    expect(next?.passedByUserId).toBe(USER_ID)
    expect(next?.pinnedArtifactId).toBe(ARTIFACT_ID)
    // earlier fields preserved
    expect(next?.openedAt).toBe(openedAt)
    expect(next?.viewedAt).toBe(viewedAt)
  })
})

// ─── 4. opened + PASS_GATE_NOT_VIEWED → stays opened (warn) ──────────────────

describe('reduceGate — PASS_GATE_NOT_VIEWED rejection (spec §10.3)', () => {
  it('opened + PASS_GATE_NOT_VIEWED → stays opened, emits warn', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const next = reduceGate(openedState, { type: 'PASS_GATE_NOT_VIEWED' })
    expect(next?.status).toBe('opened')
    expect(next).toBe(openedState) // same object reference (no mutation, no new obj)
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })
})

// ─── 5. opened + PASS_GATE_VERSION_MISMATCH → stays opened (warn) ────────────

describe('reduceGate — PASS_GATE_VERSION_MISMATCH rejection (spec §10.3)', () => {
  it('opened + PASS_GATE_VERSION_MISMATCH → stays opened, emits warn', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const next = reduceGate(openedState, { type: 'PASS_GATE_VERSION_MISMATCH' })
    expect(next?.status).toBe('opened')
    expect(next).toBe(openedState) // same object reference
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })
})

// ─── 6. passed + PASS_GATE_OK → stays passed (terminal state protection) ─────

describe('reduceGate — terminal state protection (spec §10.3)', () => {
  it('passed + PASS_GATE_OK → stays passed unchanged (terminal state)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const next = reduceGate(passedState, {
      type: 'PASS_GATE_OK',
      passedAt: new Date(),
      passedByUserId: 'other-user',
      pinnedArtifactId: 'other-artifact',
    })
    expect(next?.status).toBe('passed')
    expect(next).toBe(passedState) // unchanged
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })
})

// ─── 7. null-state guard tests ────────────────────────────────────────────────

describe('reduceGate — null state guard (spec §10.3)', () => {
  it('null + USER_VIEWED_EDITOR → returns null (with warn)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const next = reduceGate(null, { type: 'USER_VIEWED_EDITOR', viewedAt })
    expect(next).toBeNull()
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('null + PASS_GATE_OK → returns null (with warn)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const next = reduceGate(null, {
      type: 'PASS_GATE_OK',
      passedAt,
      passedByUserId: USER_ID,
      pinnedArtifactId: ARTIFACT_ID,
    })
    expect(next).toBeNull()
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('null + PASS_GATE_NOT_VIEWED → returns null (with warn)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const next = reduceGate(null, { type: 'PASS_GATE_NOT_VIEWED' })
    expect(next).toBeNull()
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('null + PASS_GATE_VERSION_MISMATCH → returns null (with warn)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const next = reduceGate(null, { type: 'PASS_GATE_VERSION_MISMATCH' })
    expect(next).toBeNull()
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })
})
