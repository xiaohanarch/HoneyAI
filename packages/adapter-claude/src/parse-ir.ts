import {
  parseRequirementIR,
  parseDesignIR,
  parseImplementationIR,
  LlmQualityFailedError,
} from '@honeyai/core'
import type {
  StreamingNodeEvent,
  ExecutionKind,
  RequirementIR,
  DesignIR,
  ImplementationIR,
} from '@honeyai/core'

/**
 * Extracts the last 'text' event from the stream and parses it as an IR document.
 * Throws LlmQualityFailedError if no text event found or IR fails zod validation.
 */
export function parseIRFromEvents(
  events: StreamingNodeEvent[],
  kind: ExecutionKind,
): RequirementIR | DesignIR | ImplementationIR {
  const textEvents = events.filter((e) => e.kind === 'text' && e.content)
  if (textEvents.length === 0) {
    throw new LlmQualityFailedError('No text events found in LLM output')
  }

  const lastText = textEvents[textEvents.length - 1]!
  const content = lastText.content!

  switch (kind) {
    case 'enrich': {
      const outcome = parseRequirementIR(content)
      if (!outcome.ok) throw new LlmQualityFailedError(outcome.error)
      return outcome.data
    }
    case 'design': {
      const outcome = parseDesignIR(content)
      if (!outcome.ok) throw new LlmQualityFailedError(outcome.error)
      return outcome.data
    }
    case 'implement': {
      const outcome = parseImplementationIR(content)
      if (!outcome.ok) throw new LlmQualityFailedError(outcome.error)
      return outcome.data
    }
  }
}
