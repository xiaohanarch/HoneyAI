import { HoneyAIError } from './base.js'

/**
 * Thrown when LLM output fails IR schema validation.
 * Triggers llm_quality_failed retry in orchestrator (spec 05 §4).
 */
export class LlmQualityFailedError extends HoneyAIError {
  constructor(cause?: unknown) {
    super({
      code: 'LLM_QUALITY_FAILED',
      message: 'LLM output failed IR schema validation',
      userMessage: 'AI output did not meet quality requirements',
      httpStatus: 422,
      cause,
    })
  }
}
