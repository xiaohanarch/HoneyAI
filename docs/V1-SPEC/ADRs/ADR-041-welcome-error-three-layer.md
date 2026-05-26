# ADR-041: Welcome 三层 error.tsx 边界

- 状态: Accepted
- 日期: 2026-05-26

## Context

`packages/web/app/` 当前 0 个 error.tsx。切片 4.3 引入 4 个 step 页面,需要明确错误渲染策略:字段级校验错误、step 级系统错误、全局未捕获错误三类场景的处理方式各不相同。同时 spec §4 的失败 UX 设计针对 Run runtime,不覆盖 bootstrap 场景,需要补充定义。

## Decision

采用 **U4 + E3 + X3 + T3** 组合:

**E3 — 三层 error.tsx 边界**:
- `app/error.tsx`:全局兜底,捕获 welcome 和主应用之外的未知异常。
- `app/(welcome)/error.tsx`:welcome 流程局部边界,显示 welcome 通用错误 UI + 重试链接。
- `app/(welcome)/welcome/step/[n]/error.tsx`:单步重试边界,允许用户在单步出错后重试当前步骤。

**U4 — 字段内联 + 顶部系统 banner 二分**:
- 字段校验错误(如 `INVALID_KEY_FORMAT`)用 `FormMessage` 内联在字段下方显示。
- 系统级错误(如 `INTERNAL_ERROR`、`TENANT_NOT_FOUND`)用 `Alert` banner 在页面顶部展示。

**X3 — 业务错误 return code,系统错误 throw**:
- Server Action 业务错误返回 `WelcomeActionResult { success: false, code: WelcomeErrorCode }`,不进入 error stack。
- 系统异常(db 连接失败等)throw,由最近 error.tsx 边界捕获渲染。

**T3 — 事务 + 幂等 gate**:Step 4 写入 skills + `completedAt` 包裹在同一 db 事务中;`BOOTSTRAP_ALREADY_COMPLETE` 错误码防止重复点击触发双写。

## Consequences

**正面**:
- 三层边界与 `(welcome)` route group 嵌套结构自然对齐,粒度合适。
- U4 二分让用户清楚知道错误来源(自己的输入 vs 系统问题)。
- X3 让业务错误不污染系统 error log,排障更清晰。

**负面**:
- 三个 error.tsx 文件有一定模板重复,但各层职责不同,合并会损失粒度。
- T3 幂等 gate 需要 server action 内检查 `completedAt` 是否已存在。

**后续影响**:
- 切片 4.4 引入 toast 库(TL4 推迟,见 ADR-042)后,部分 banner 错误可迁移至 toast。
- `zh.ts` 扩展 `errors.welcome.*` 命名空间为所有 `WelcomeErrorCode` 提供中文提示。

## Alternatives Considered

- **U3 — 全局 toast**:toast 库切片 4.3 不引入(TL4),且 toast 不适合字段级校验错误显示。
- **E1 — 单 root error.tsx**:粒度太粗,step 级重试不可达;用户无法从 welcome 内部错误中恢复。
- **X1 — 全 throw**:业务错误(key 格式错误)混入系统错误堆栈,用户看到无意义的技术错误页面。

## Related

- 触发决策: `decisions/phase-2-4-3-open-questions.md §Q8`
- 关联 spec: 07-frontend.md §错误处理
- 关联 ADR: ADR-035(WelcomeErrorCode), ADR-042(shadcn primitives + toast 推迟)
