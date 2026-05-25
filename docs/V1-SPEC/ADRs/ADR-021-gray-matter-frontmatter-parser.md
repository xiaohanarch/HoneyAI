# ADR-021: Markdown frontmatter 解析库选 `gray-matter`

- 状态: Accepted
- 日期: 2026-05-26

## Context

`@honeyai/core` 的 IR 文档是 Markdown + YAML frontmatter。Phase 2.0 需要 parse + zod validate,不需要修改 markdown AST。

候选:

- `gray-matter` — 1.5 KB gzipped,无 DOM 依赖,YAML/TOML/JSON 三种 frontmatter,npm 周下载 1.7M
- `remark` + `remark-frontmatter` — 完整 AST,体量大,适合需要修改 markdown 的场景
- 手写正则 — 规避依赖,但要测试边缘 case

## Decision

选 **`gray-matter` 4.0.3**。固定 patch version,与现有 zod 3.24.1 锁版本风格一致。

## Consequences

**正面**:体积小、server/sandbox/web 三端可跑、单 import 完成 parse + stringify、ecosystem 成熟。

**负面**:不支持 markdown AST 修改 —— Phase 2.0 不需要,符合范围;切片 4 (Tiptap) 编辑器自己持有 AST,不依赖 gray-matter。

**后续影响**:`@honeyai/core/src/ir/shared.ts` 暴露内部 `parseFrontmatter` / `stringifyFrontmatter` helper,IR 业务侧透传调用。

## Alternatives Considered

- `remark`:overkill,体积约 30 KB,引入 unified ecosystem 阻塞 sandbox 启动时间
- 手写正则:节省 1 个依赖但增加单测面;`gray-matter` 已包含成熟边缘 case 覆盖

## Related

- 触发决策: `decisions/phase-2-open-questions.md §Q1`
- 关联 ADR: ADR-022 (IR 模块文件布局),ADR-024 (parse/stringify 内化到 core)
