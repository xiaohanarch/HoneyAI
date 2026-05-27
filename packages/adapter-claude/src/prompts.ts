import type { ExecutionKind } from '@honeyai/core'

/**
 * Builds the system prompt for claude CLI based on execution kind.
 * MVP: simplified prompts — interface correctness is primary goal.
 */
export function buildSystemPrompt(kind: ExecutionKind, irInput: string): string {
  switch (kind) {
    case 'enrich':
      return enrichPrompt(irInput)
    case 'design':
      return designPrompt(irInput)
    case 'implement':
      return implementPrompt(irInput)
  }
}

function enrichPrompt(irInput: string): string {
  return `You are an AI requirements analyst. Your task is to enrich the following user requirement into a structured RequirementIR document.

The RequirementIR must be a valid YAML frontmatter Markdown document with these required fields:
- title, one_liner, priority (P0-P3), estimated_complexity (XS/S/M/L/XL)
- in_scope (array, min 1), out_of_scope (array), success_criteria (array, min 1)
- constraints, risks, impact_surface, related (arrays, can be empty)

Required Markdown sections: ## 背景, ## 用户故事, ## 验收标准明细, ## 开放问题

Input requirement:
${irInput}

Output ONLY the complete Markdown document with frontmatter. No commentary.`
}

function designPrompt(irInput: string): string {
  return `You are an AI software architect. Your task is to transform the following RequirementIR into a structured DesignIR document.

The DesignIR must be a valid YAML frontmatter Markdown document with these required fields:
- approach_summary (min 20 chars), affected_components (array, min 1)
- architecture_decisions, data_model_changes, api_changes (arrays, can be empty)
- task_graph: { nodes: [...], edges: [...] } — machine-executable DAG
- test_strategy: { unit, integration, e2e }, security_review, rollout

The task_graph is the contract for Stage 3. Nodes must have unique IDs. Edges must form a DAG (no cycles).

Input RequirementIR:
${irInput}

Output ONLY the complete Markdown document with frontmatter. No commentary.`
}

function implementPrompt(irInput: string): string {
  return `You are an AI software engineer. Your task is to implement the design from the following DesignIR and produce an ImplementationIR document.

The ImplementationIR must be a valid YAML frontmatter Markdown document with these required fields:
- pr: { title, body, branch, base, draft }
- commits (array), files_changed (array)
- tests: { added, modified, coverage_pct? }
- quality_gates: { lint, typecheck, build, security_scan, findings }
- ai_self_review: { confidence, known_limitations, suggested_human_review }
- task_completion (array referencing DesignIR task_graph node IDs)
- links: { pr_url?, commit_urls }

Follow the task_graph from the DesignIR. Implement each node in topological order.

Input DesignIR:
${irInput}

Output ONLY the complete Markdown document with frontmatter. No commentary.`
}
