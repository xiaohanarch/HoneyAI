# ADR-038: 默认 5 条 skills seed

- 状态: Accepted
- 日期: 2026-05-26

## Context

切片 4.3 Step 4 需要写入默认 skills。spec 01 §3.2.c 要求"5-10 个官方默认",且每种 `kind`(`skill` / `rule` / `command` / `hint` / `hook`)都应有示例以展示平台能力。种子内容的来源(外部 markdown / db 表 / TS literals)和写入时机也需明确。

## Decision

采用 **C2 + A4 + W-B** 组合:

**C2 — 5 条 seeds,每 kind 各 1**,硬编码于 `packages/web/lib/seeds/default-skills.ts` 作为 TS literals:

1. `kind: 'skill'` — `code-review-assistant`:协助做代码 review 的 AI skill
2. `kind: 'rule'` — `no-pii-in-logs`:禁止在日志中输出 PII 数据的规则
3. `kind: 'command'` — `run-tests`:运行项目测试套件的快捷命令
4. `kind: 'hint'` — `prefer-server-components`:提示优先使用 Next.js Server Components
5. `kind: 'hook'` — `pre-commit-format`:提交前自动格式化的 hook

**A4 — TS literals 内联**:切片 4.3 内无外部依赖,后续可迁移至 markdown 文件(V1 不需要)。

**W-B — Step 4 action 写入**:在 `step4-import-skills.ts` Server Action 中调用 `insertDefaultSkills(tenantId)`,与"启动确认"语义绑定(见 ADR-037 S-B 每租户 copy)。

## Consequences

**正面**:
- 5 种 kind 各一条,清晰展示平台所有 asset 类型能力。
- TS literals 内联让切片 4.3 无外部文件依赖,便于测试。
- 硬编码内容稳定,CI 不依赖外部资源。

**负面**:
- 内容在代码中,更新需要 PR;markdown 文件方案更易内容团队维护(推迟到 V2)。
- 5 条远少于 spec 上限 10 条,但满足下限要求。

**后续影响**:
- V2 内容迁移至 markdown 文件时,需同步更新 seed 加载逻辑,新建 ADR。
- `metadata.is_seed = true` 标记由 ADR-037 约定,切片 2 守卫依赖此标记。

## Alternatives Considered

- **C1 — 1 个 skill**:不满足 spec §3.2.c"5-10 个"下限要求。
- **C3 — 10 个**:内容维护成本增加,YAGNI。
- **A1 — 外部 markdown**:切片 4.3 需要增加文件加载依赖,且 markdown 解析增加复杂度。
- **W-A — 用户首次登录写入**:与"启动确认"语义不符,也与 Step 4 导入/跳过选项矛盾。

## Related

- 触发决策: `decisions/phase-2-4-3-open-questions.md §Q6`
- 关联 spec: 01-product.md §3.2.c, 03-data-model.md §assets
- 关联 ADR: ADR-037(per-tenant copy 存储模型), ADR-035(Step 4 Server Action)
