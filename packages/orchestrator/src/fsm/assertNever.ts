/**
 * Exhaustive check helper for switch-reducer default branches.
 * TypeScript 保证：若所有 union members 已处理，default 分支参数类型为 never，编译通过。
 * 若未处理，编译报错。运行时兜底：若意外到达 default 分支，抛 Error。
 * (ADR-027)
 */
export function assertNever(x: never): never {
  throw new Error(`Unexpected value in assertNever: ${JSON.stringify(x)}`)
}
