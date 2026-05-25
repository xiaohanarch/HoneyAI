<!-- PR 描述：保留下面三段。删除任意段视为不合规。-->

## Summary

<!-- 1-3 行说清 what + why。不要复述 commit message。 -->

## Acceptance

<!--
按 docs/V1-SPEC/00-README.md §「验收清单约定」要求填写。
两类 AC 都要列：
  - 自动 AC：在测试中以 `AC-XX-YY: ...` 作为 test title，由 `pnpm ac:coverage` 自动识别
  - 手动 AC：勾选下方 checkbox + 附证据（截图/日志/链接）
-->

- 本 PR 覆盖的 AC: <!-- 例 AC-03-01, AC-03-02, AC-03-03 -->
- 不涉及 AC: <!-- 若 PR 不动行为（纯文档/纯重构）填 N/A -->

### Manual AC 验证

- [ ] 所有 `[Manual]` AC 已人工执行
- [ ] 已贴上证据（截图 / 日志 / 链接）

<!-- 证据贴在下面：
- AC-XX-YY: <截图/日志/链接>
-->

## Test plan

<!--
- [ ] unit test (pnpm test --filter <pkg>)
- [ ] migration check (pnpm db:check)
- [ ] full CI (lint + typecheck + test + ac:coverage)
- [ ] 本地 docker-compose 烟雾 (若改动到 db / infra)
-->

## Spec / ADR 影响

<!--
- 若改动 docs/V1-SPEC/ 章节：列章节号 + 新 ADR 编号
- 若引入新决策：链接到 docs/V1-SPEC/ADRs/ADR-0XX.md
- 都不涉及：填 N/A
-->
