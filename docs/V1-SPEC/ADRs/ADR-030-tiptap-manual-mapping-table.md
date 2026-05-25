# ADR-030: Tiptap generator 用手工 mapping table 而非 zod 内部 `_def` 递归

- 状态: Accepted
- 日期: 2026-05-26

## Context

切片 4(可选 4.6)/ 切片 5 IR 编辑器需要把 `@honeyai/core` zod schema(RequirementIR / DesignIR / ImplementationIR)自动转换为 Tiptap node spec,渲染为表单。

候选:

- A — 手工 mapping table + zod type guards:`lib/forms/schema-to-tiptap.ts` 用 switch / `instanceof z.ZodString` 显式枚举类型 → Tiptap node 输出
- B — 通用递归遍历 zod 的内部 `_def` 字段(脆弱,zod 内部结构升级即破)
- C — 引入 `zod-to-json-schema` + JSONSchema → Tiptap 中转(链路长 + 类型信息损失)

## Decision

选 **A — 手工 mapping table + zod type guards**。

- 实现位置:`packages/web/lib/forms/schema-to-tiptap.ts`
- 入口函数 `schemaToTiptap<S extends z.ZodTypeAny>(schema: S): TiptapNodeSpec`
- 内部用 `instanceof z.ZodString` / `z.ZodNumber` / `z.ZodEnum` / `z.ZodArray` / `z.ZodObject` / `z.ZodOptional` / `z.ZodDefault` 显式枚举
- 不支持的 zod 类型显式 `throw new UnsupportedZodTypeError(...)` 而非 silent fallback
- 单元测试逐类型覆盖 happy + 失败路径

## Consequences

**正面**:
- V1 IR schema 字段类型有限(< 10 种 zod 类型),手工 mapping 一次到位
- 每种类型的 Tiptap node 输出 100% 可控,UX 微调成本最低
- zod v3/v4 升级时仅 type guard 部分受影响,生产代码隔离

**负面**:
- 未来 IR schema 增字段类型(如 ZodBigInt / ZodDate)需更新 mapping —— 接受,有单测兜底
- 与生态库(`@hookform/resolvers/zod`)不共用算法 —— 接受,两者用途不同

**后续影响**:
- 切片 4.6 落入 mapping 基础版(仅 RequirementIR 类型范围)
- 切片 5 IR 编辑器使用 mapping 产出 Tiptap 编辑 UI
- 若 V1 后期出现严重维护负担,可重新评估迁移到 `zod-to-json-schema`

## Alternatives Considered

- **B — 递归 `_def`**:zod 不保证 `_def` API 稳定;v3 → v4 间 internal 重构案例多;类型不安全
- **C — JSONSchema 中转**:V1 IR schema 用 `.extend()` / `.refine()` 业务规则,JSONSchema 输出会丢失这些;再恢复到 Tiptap 增加二次转换

## Related

- 触发决策:`decisions/phase-2-4-open-questions.md §Q6`
- 关联 spec:04-ir.md §9 Tiptap SchemaForm
- 关联 ADR:ADR-026(Tiptap generator 不进 `@honeyai/core`,落 web 端)
