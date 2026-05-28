import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { loadWorkerConfig } from '../worker-config.js'

vi.mock('node:fs', () => ({ readFileSync: vi.fn() }))
const mockReadFile = vi.mocked(readFileSync)

const ENOENT = Object.assign(new Error('file not found'), { code: 'ENOENT' })

afterEach(() => {
  vi.restoreAllMocks()
  delete process.env['LLM_ENGINE']
  delete process.env['LLM_MODEL']
})

describe('loadWorkerConfig', () => {
  it('defaults to claude engine when config file is absent', () => {
    mockReadFile.mockImplementation(() => {
      throw ENOENT
    })
    const cfg = loadWorkerConfig('/nonexistent/honeyai.config.json')
    expect(cfg.engine).toBe('claude')
    expect(cfg.model).toBeUndefined()
  })

  it('reads engine from config file', () => {
    mockReadFile.mockReturnValue(JSON.stringify({ llm: { engine: 'opencode' } }))
    const cfg = loadWorkerConfig('/some/honeyai.config.json')
    expect(cfg.engine).toBe('opencode')
  })

  it('reads model from config file', () => {
    mockReadFile.mockReturnValue(
      JSON.stringify({ llm: { engine: 'opencode', model: 'anthropic/claude-opus-4-6' } }),
    )
    const cfg = loadWorkerConfig('/some/honeyai.config.json')
    expect(cfg.model).toBe('anthropic/claude-opus-4-6')
  })

  it('LLM_ENGINE env var overrides config file engine', () => {
    mockReadFile.mockReturnValue(JSON.stringify({ llm: { engine: 'opencode' } }))
    process.env['LLM_ENGINE'] = 'claude'
    const cfg = loadWorkerConfig('/some/honeyai.config.json')
    expect(cfg.engine).toBe('claude')
  })

  it('LLM_MODEL env var overrides config file model', () => {
    mockReadFile.mockReturnValue(
      JSON.stringify({ llm: { engine: 'claude', model: 'original-model' } }),
    )
    process.env['LLM_MODEL'] = 'override-model'
    const cfg = loadWorkerConfig('/some/honeyai.config.json')
    expect(cfg.model).toBe('override-model')
  })

  it('throws on invalid engine value in config file', () => {
    mockReadFile.mockReturnValue(JSON.stringify({ llm: { engine: 'gpt4' } }))
    expect(() => loadWorkerConfig('/some/honeyai.config.json')).toThrow()
  })

  it('throws on invalid LLM_ENGINE env var', () => {
    mockReadFile.mockImplementation(() => {
      throw ENOENT
    })
    process.env['LLM_ENGINE'] = 'invalid-engine'
    expect(() => loadWorkerConfig('/some/honeyai.config.json')).toThrow()
  })

  it('throws on malformed JSON in config file', () => {
    mockReadFile.mockReturnValue('{ bad json }')
    expect(() => loadWorkerConfig('/some/honeyai.config.json')).toThrow()
  })

  it('config file missing llm key → defaults to claude', () => {
    mockReadFile.mockReturnValue(JSON.stringify({}))
    const cfg = loadWorkerConfig('/some/honeyai.config.json')
    expect(cfg.engine).toBe('claude')
  })
})
