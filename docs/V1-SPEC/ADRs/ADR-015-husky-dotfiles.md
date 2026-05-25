# ADR-015: husky / lint-staged / commitlint 全独立 dotfile

- 状态: Accepted
- 日期: 2026-05-25

## Context

git hook 工具链的配置文件形式候选：

- A — 全独立 dotfile
- B — lint-staged / commitlint inline 进 `package.json`
- C — 部分独立部分 inline

详见 `decisions/phase-1-open-questions.md §9`。

## Decision

**采纳 A —— 全独立 dotfile**：

- `.husky/pre-commit`（husky v9 强制）
- `.husky/commit-msg`
- `.lintstagedrc.json`
- `commitlint.config.cjs`
- `package.json` 不含 `husky` / `lint-staged` / `commitlint` 字段

## Consequences

- 正面: 每个工具配置可独立查看与编辑；commit 历史只动一个文件，diff 干净；工具升级时配置形态变化对其他文件零侵入。
- 负面: 仓库根目录 dotfile 略多——已通过 README 与 CLAUDE.md §8 显式说明。
- 后续影响: 任何 hook 行为变更只改对应 dotfile；不在 `package.json` 增加这三类字段。

## Related

- `decisions/phase-1-open-questions.md §9`
- `.husky/`
- `.lintstagedrc.json`
- `commitlint.config.cjs`
