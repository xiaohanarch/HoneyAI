// RuntimeAdapter — injectable interface for LLM execution
// adapter-claude will implement this; tests use vi.fn() mocks

export interface NodeEvent {
  ts: string
  kind: 'thinking' | 'tool_call' | 'tool_result' | 'text' | 'finish' | 'error'
  content?: string
  inputTokens?: number
  outputTokens?: number
}

export interface ExecuteNodeParams {
  tenantId: string
  runId: string
  nodeId: string
  kind: 'enrich' | 'design' | 'implement'
  anthropicKey: string
  irInput: string
  sessionId?: string
}

export interface RuntimeAdapter {
  executeNode(params: ExecuteNodeParams): AsyncGenerator<NodeEvent>
}
