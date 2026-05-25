# ADR-023: IR 正文 H2 section 仅 warning,不进 zod 强校验

- 状态: Accepted
- 日期: 2026-05-26

## Context

Spec 04 §2.2 列举 RequirementIR markdown 正文必含 `## 背景` / `## 用户故事` / `## 验收标准明细` / `## 开放问题` 4 个 H2 section,但没指明这是 zod 强校验还是 prompt 模板范围。Design / Implementation IR 未在 spec 内枚举 H2 section。

候选:

- A — 进 zod,缺少 section 拒绝保存(强校验)
- B — 仅 frontmatter zod,正文 sections 检测出"缺失"返回 warning(非阻断)
- C — 完全不校验正文

## Decision

选 **B**。

- `parseRequirementIR` 返回 `IRParseOk<T> = { ok: true; data; body; warnings: IRParseWarning[] }`
- `warnings` 中 `{ kind: 'missing_section', section: string }` 用于 UI 提示("缺失 ## 开放问题 章节")
- DesignIR / ImplementationIR 在 Phase 2.0 不发 section warning(spec 未枚举);如未来 spec 04 §3 / §4 补 section 列表,扩 `REQUIRED_DESIGN_SECTIONS` / `REQUIRED_IMPLEMENTATION_SECTIONS` 常量即可

## Consequences

**正面**:正文是 LLM 输出 + 人工编辑混合产物,过于严苛会引发频繁 `llm_quality_failed` 重试(spec 06);warning 路径保留 UX 提示能力。

**负面**:warning 类型独立于 `z.SafeParseReturnType`,Phase 2.0 引入 `IRParseOutcome<T>` 自定义 discriminated union;代码量略增。

**后续影响**:Tiptap 编辑器(切片 4)消费 `warnings` 数组,渲染 inline hint;Server Action `saveArtifact`(切片 5)不拒绝 warning 状态的 IR。

## Alternatives Considered

- A(强校验):破坏 LLM workflow,首轮 3-stage 跑通成功率掉到 < 30%
- C(完全不校验):放弃 UX 提示,LLM 经常漏 `## 开放问题`,人工 review 负担重

## Related

- 触发决策: `decisions/phase-2-open-questions.md §Q3`
- 关联 spec: 04 §2.2
- 关联 ADR: ADR-024 (parseRequirementIR 输出形状)
