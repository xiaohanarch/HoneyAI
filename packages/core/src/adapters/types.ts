// Adapter types — RuntimeAdapter interface used by orchestrator to execute nodes.
// Implementations: ClaudeCodeAdapter (adapter-claude), future kubectl-exec adapter.

/** Stage execution kind — maps to the 3 agent node types in spec 05 §4 */
export type ExecutionKind = 'enrich' | 'design' | 'implement'

/** Parameters passed to RuntimeAdapter.executeNode() */
export interface ExecuteNodeParams {
  tenantId: string
  runId: string
  nodeId: string
  kind: ExecutionKind
  /** Decrypted Anthropic API key — caller is responsible for decryption */
  anthropicKey: string
  /** IR markdown string from previous stage output */
  irInput: string
  /** Claude session ID for --resume (used after Gate to continue conversation) */
  sessionId?: string
}

/**
 * Streaming event emitted by RuntimeAdapter.executeNode().
 * Matches spec 06-sandbox.md §3.2 JSONL event format.
 */
export interface StreamingNodeEvent {
  ts: string
  kind: 'thinking' | 'tool_call' | 'tool_result' | 'text' | 'finish' | 'error'
  content?: string
  tool?: string
  args?: Record<string, unknown>
  outputLen?: number
  reason?: string
  inputTokens?: number
  outputTokens?: number
}

/**
 * RuntimeAdapter — interface all LLM execution adapters must implement.
 * Designed for substitutability: ClaudeCodeAdapter (local exec MVP) and
 * KubectlExecAdapter (k8s sandbox) are both valid implementations.
 */
export interface RuntimeAdapter {
  executeNode(params: ExecuteNodeParams): AsyncGenerator<StreamingNodeEvent>
}
