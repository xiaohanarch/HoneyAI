import { HoneyAIError } from './base.js'

export class CrossTenantAccessError extends HoneyAIError {
  public readonly attemptedTenantId: string
  public readonly actualTenantId: string

  constructor(input: { attemptedTenantId: string; actualTenantId: string; cause?: unknown }) {
    super({
      code: 'CROSS_TENANT_ACCESS',
      message: `Cross-tenant access: actor=${input.actualTenantId} target=${input.attemptedTenantId}`,
      userMessage: 'Access denied: this resource belongs to a different tenant',
      httpStatus: 403,
      cause: input.cause,
    })
    this.attemptedTenantId = input.attemptedTenantId
    this.actualTenantId = input.actualTenantId
  }
}
