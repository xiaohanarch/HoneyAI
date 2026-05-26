# ADR-049: GitHub App + OAuth 环境变量 (Phase 2.5)

- 状态: Accepted
- 日期: 2026-05-26

## Context

Phase 2.5 (切片 3) 接入 `@honeyai/github` 包和 `packages/web` GitHub OAuth provider 需要 5 个新环境变量。
ADR-016 要求每批新 env vars 需同步扩 `.env.example` + `packages/core/src/env/index.ts` schema。

Phase 2.5 task scope 为"只改 packages/github/ 和 packages/web/auth/"，因此 packages/core/src/env/index.ts 的更新留至下一个 PR（follow-up tech debt）。

## Decision

本 PR 扩 `.env.example`；`packages/core/src/env/index.ts` 更新留 follow-up。

在此过渡期间，`packages/github` 和 `packages/web` 直接通过 `process.env` 读取这些变量（不经过 core 的 zod env schema）。

变量清单：

| 变量 | 用途 | 使用包 |
|---|---|---|
| `GITHUB_APP_ID` | GitHub App 数字 ID | packages/github |
| `GITHUB_APP_PRIVATE_KEY` | PEM 私钥（换行用 `\n`） | packages/github |
| `GITHUB_WEBHOOK_SECRET` | Webhook 签名校验密钥 | packages/github |
| `GITHUB_CLIENT_ID` | OAuth App client ID | packages/web |
| `GITHUB_CLIENT_SECRET` | OAuth App client secret | packages/web |

## Consequences

- **正面**: Phase 2.5 可立即使用 GitHub App + OAuth，无需等待 core env schema 更新。
- **负面**: 过渡期间这 5 个变量不受 `@t3-oss/env-core` fail-fast 保护（直接 `process.env` 可能在运行时才发现缺失）。
- **后续**: 下一个 PR 将 5 个变量加入 `packages/core/src/env/index.ts` schema，届时改为通过 typed env 使用。

## Related

- ADR-016 — Phase 1 极简 env 约定（说明 Phase 2 起扩 env 的规则）
- ADR-029 — NextAuth Credentials dev provider（GitHub OAuth 追加方式）
- Phase 2.5 实施 PR
