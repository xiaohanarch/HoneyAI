# ADR-042: Welcome 新增 4 个 shadcn primitive

- 状态: Accepted
- 日期: 2026-05-26

## Context

切片 4.3 的 Welcome 表单需要文本输入、标签、字段级错误提示和系统 banner 四类 UI 元素。`packages/web/components/ui/` 目前仅有切片 4.1/4.2 添加的基础组件。同时 Q8 决策推迟引入 toast 库到切片 4.4,避免为孤立 Welcome 场景引入不必要的全局依赖。

## Decision

采用 **TL4 + 4 个新 shadcn primitives** 方案:

**通过 `pnpm dlx shadcn@latest add` vendor 引入以下 3 个 primitive**:
- `Alert`:用于顶部系统级错误 banner(对应 ADR-041 U4)。
- `Input`:文本输入框,用于 Step 1 Anthropic key 和 Step 3 repo 字段。
- `Label`:表单标签,与 `Input` 配套。

**`FormMessage` 手写包装**:
```tsx
// packages/web/components/ui/form-message.tsx
export function FormMessage({ children }: { children: React.ReactNode }) {
  return <p role="alert" className="text-sm text-destructive">{children}</p>
}
```
无 shadcn upstream 对应组件,手写一个语义化 `<p role="alert">` 包装即可满足需求。

**TL4 — toast 推迟到切片 4.4**:切片 4.3 不引入 sonner / shadcn toast / 自建 toast,避免为单一 Welcome 场景增加全局依赖,待切片 4.4 有更多使用场景时再统一引入。

## Consequences

**正面**:
- 3 个 shadcn vendor 组件与现有 `components/ui/` 风格一致,维护成本低。
- `FormMessage` 手写包装轻量,无额外依赖,且 `role="alert"` 满足可访问性要求。
- toast 推迟不引入不必要的全局副作用。

**负面**:
- 切片 4.3 的错误提示仅有 `FormMessage` + `Alert` 两种形式,缺少 toast 的轻量通知体验。
- `FormMessage` 不依赖 shadcn 的 Form context,需要手动绑定错误状态。

**后续影响**:
- 切片 4.4 引入 toast 时(sonner 或 shadcn toast),需评估是否迁移部分 `Alert` 用法。
- `FormMessage` 是自建组件,如 shadcn 未来发布官方对应版本,可考虑替换。

## Alternatives Considered

- **TL1 — sonner**:仅 Welcome 场景使用 toast 体验提升有限,YAGNI。
- **TL2 — shadcn toast**:同理,切片 4.3 场景不足以支撑引入全局 Toaster provider。
- **FormMessage 用 shadcn Form**:shadcn Form 绑定 react-hook-form,Welcome 使用 `useActionState` 而非 RHF,引入反而增加复杂度。

## Related

- 触发决策: `decisions/phase-2-4-3-open-questions.md §Q8`
- 关联 spec: 07-frontend.md §组件库
- 关联 ADR: ADR-041(错误边界 + 失败 UX), ADR-031(RSC + Server Action)
