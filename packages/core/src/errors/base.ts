export type HoneyAIErrorInput = {
  code: string
  message: string
  userMessage: string
  httpStatus: number
  cause?: unknown
}

export class HoneyAIError extends Error {
  public readonly code: string
  public readonly userMessage: string
  public readonly httpStatus: number

  constructor(input: HoneyAIErrorInput) {
    super(input.message, { cause: input.cause })
    this.code = input.code
    this.userMessage = input.userMessage
    this.httpStatus = input.httpStatus
    this.name = new.target.name
  }
}
