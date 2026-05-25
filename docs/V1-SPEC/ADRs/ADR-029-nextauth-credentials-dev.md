# ADR-029: Dev 模式用 NextAuth v5 Credentials provider 替代 GitHub OAuth

- 状态: Accepted
- 日期: 2026-05-26

## Context

切片 4 `@honeyai/web` 骨架阶段需要登录态,但 GitHub App / OAuth 接入是切片 3 范围(GitHub credentials 未到位)。切片 4 / 5 联调与 dev 环境也不应每次依赖真实 GitHub 回调。

候选:

- A — NextAuth v5 Credentials provider(仅 dev,fixture 用户列表)
- B — 手写 dev login route(不走 NextAuth,prod 切换时大改 session / cookie / middleware)
- C — 完整 GitHub OAuth 直接接入(阻塞切片 4,且本地开发需 ngrok)

## Decision

选 **A — NextAuth v5 Credentials provider(仅 dev)**。

- `packages/web/lib/auth/dev-credentials.ts` — 4-6 个 fixture 用户(`alice` / `bob` / `carol` / `dave`)
- 启动守卫:`process.env.NODE_ENV === 'development'` 才注册;prod / preview 启动时 fail-fast 校验 provider 列表不含 Credentials
- session strategy = JWT(与切片 3 GitHub OAuth 模式一致,无需 db session 表)
- 切片 3 接入 GitHub provider 时仅追加 `providers: [GitHub({...})]`,Credentials provider 在 dev build 条件下保留

## Consequences

**正面**:
- 切片 4 独立可跑,不阻塞切片 3
- NextAuth session / cookie / middleware / `auth()` helper API 在 dev / prod 完全一致,切换 provider 代码改动 < 10 行
- fixture 用户与切片 4.4 `packages/db/src/seed/fixtures.ts` 假数据租户对接,端到端测试可控

**负面**:
- Credentials provider 默认不强制 prod ban,必须靠人工 + 启动校验守住红线
- fixture 密码若硬编码进仓库无敏感性(都是 dev 用户),但需 README 醒目说明

**后续影响**:
- 切片 4.1 PR 落 Credentials provider + 守卫
- 切片 3 PR 仅追加 GitHub provider,Credentials 保留供 dev 用
- prod 环境变量 `NODE_ENV=production` + `DEV_AUTH_ENABLED` 双重校验(后者也必须 false)

## Alternatives Considered

- **B — 手写 dev login route**:session / cookie 管理重做,与 prod NextAuth 模式不一致,切换风险高
- **C — 直接 GitHub OAuth**:阻塞切片 4,本地需 ngrok 暴露,且 PR review 时引入额外 secret 管理负担

## Related

- 触发决策:`decisions/phase-2-4-open-questions.md §Q2`
- 关联 spec:01-product.md §welcome
- 关联 ADR:ADR-003(unified Next.js),ADR-006(Welcome 4 步必填)
