// packages/worker/src/handlers/artifact-content.test.ts
// TDD tests for getArtifactContent — RED phase first, then implementation.

import { describe, it, expect, vi } from 'vitest'
import { getArtifactContent } from './artifact-content.js'

// ─── tests ────────────────────────────────────────────────────────────────────

describe('getArtifactContent', () => {
  it('AC-02-14: getArtifactContent concatenates text event payloads in seq order', async () => {
    // Arrange
    const blobSha256 = 'abc123'
    const nodeId = 'n1'

    const artifactRows = [{ id: 'a1', blobSha256, nodeId }]
    const eventRows = [
      { id: 'e1', nodeId, kind: 'text', seq: 0n, payload: { content: 'Hello ' } },
      { id: 'e2', nodeId, kind: 'text', seq: 1n, payload: { content: 'World' } },
    ]

    // Use a more granular mock that tracks which table is being queried
    const mockDb = {
      select: vi
        .fn()
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(artifactRows),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue(eventRows),
            }),
          }),
        }),
    } as unknown as Parameters<typeof getArtifactContent>[0]

    // Act
    const result = await getArtifactContent(mockDb, blobSha256)

    // Assert
    expect(result).toBe('Hello World')
  })

  it('AC-02-15: getArtifactContent throws when artifact not found', async () => {
    // Arrange — empty artifact rows
    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    } as unknown as Parameters<typeof getArtifactContent>[0]

    // Act + Assert
    await expect(getArtifactContent(mockDb, 'nonexistent-sha')).rejects.toThrow(
      'artifact not found',
    )
  })

  it('AC-02-14b: getArtifactContent skips events with no content field', async () => {
    // Arrange — event row with undefined content
    const blobSha256 = 'def456'
    const nodeId = 'n2'
    const artifactRows = [{ id: 'a2', blobSha256, nodeId }]
    const eventRows = [
      { id: 'e3', nodeId, kind: 'text', seq: 0n, payload: { content: 'part1' } },
      { id: 'e4', nodeId, kind: 'text', seq: 1n, payload: {} }, // no content — skip
      { id: 'e5', nodeId, kind: 'text', seq: 2n, payload: { content: 'part2' } },
    ]

    const mockDb = {
      select: vi
        .fn()
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(artifactRows),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue(eventRows),
            }),
          }),
        }),
    } as unknown as Parameters<typeof getArtifactContent>[0]

    // Act
    const result = await getArtifactContent(mockDb, blobSha256)

    // Assert — undefined content treated as empty string
    expect(result).toBe('part1part2')
  })

  it('AC-02-14c: getArtifactContent throws when artifact has no nodeId', async () => {
    // Arrange — artifact with null nodeId
    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: 'a3', blobSha256: 'xyz', nodeId: null }]),
          }),
        }),
      }),
    } as unknown as Parameters<typeof getArtifactContent>[0]

    // Act + Assert
    await expect(getArtifactContent(mockDb, 'xyz')).rejects.toThrow('artifact not found')
  })

  it('AC-02-14d: getArtifactContent throws when artifact has no text events', async () => {
    // Arrange — artifact found but no text events
    const blobSha256 = 'zzz789'
    const nodeId = 'n4'
    const artifactRows = [{ id: 'a4', blobSha256, nodeId }]

    const mockDb = {
      select: vi
        .fn()
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(artifactRows),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue([]), // empty events
            }),
          }),
        }),
    } as unknown as Parameters<typeof getArtifactContent>[0]

    // Act + Assert
    await expect(getArtifactContent(mockDb, blobSha256)).rejects.toThrow(
      'no text events found for nodeId=',
    )
  })
})
