# ADR-047: Welcome 字段 regex 校验

- 状态: Accepted
- 日期: 2026-05-26

## Context

切片 4.3 的 Step 1(Anthropic API key)和 Step 3(GitHub repo `owner/name`)需要前置格式校验。Q11 明确了不打外部 API 的约束(Step 1 不去 Anthropic 验证 key 有效性,Step 3 不去 GitHub API 验证 repo 存在性),需要确定纯格式 regex 方案。

## Decision

采用 **K3 + RP1** 组合:

**K3 — Anthropic API key regex**:`^sk-ant-[A-Za-z0-9_-]{32,}$`

- 匹配 Anthropic 官方 key 格式:`sk-ant-` 前缀 + 32 位以上 alphanumeric/underscore/hyphen。
- 在 Step 1 Server Action 的本地 zod schema 中定义:`z.string().regex(/^sk-ant-[A-Za-z0-9_-]{32,}$/, 'INVALID_KEY_FORMAT')`。
- 校验失败返回 `WelcomeErrorCode.INVALID_KEY_FORMAT`,不写库(AC-01-10)。

**RP1 — GitHub repo 单字段 regex**:`^[\w.-]+/[\w.-]+$`

- 匹配 `owner/name` 格式,支持字母、数字、`.`、`-`、`_`。
- 在 Step 3 Server Action 的本地 zod schema 中定义:`z.string().regex(/^[\w.-]+\/[\w.-]+$/, 'INVALID_REPO_FORMAT')`。
- 校验失败返回 `WelcomeErrorCode.INVALID_REPO_FORMAT`。

**纯前置格式校验**:两个 regex 均不打外部 API。Anthropic key 有效性在 sandbox 首次使用时自然暴露;GitHub repo 存在性在 slice 3 GitHub App 接入后验证。

## Consequences

**正面**:
- 纯 regex 校验无网络依赖,速度快且不增加外部 API 调用风险。
- 拦截明显格式错误(如用户误填密码或邮箱到 key 字段),减少无效写库。
- zod schema 内联到 action 文件(ADR-035 A 方案),无跨文件依赖。

**负面**:
- regex 无法验证 key 真实有效性,用户仍可能填写格式正确但已失效的 key。
- `[\w.-]` 中的 `\w` 在部分边缘情况(非 ASCII GitHub 用户名)可能不匹配(V1 可接受)。

**后续影响**:
- slice 3 GitHub App 接入后,可在 Step 3 action 中追加 GitHub API probe 验证 repo 存在性。
- Anthropic key 有效性验证如需前置,可在 slice 2 crypto 模块中加 key probe(需新建 ADR)。

## Alternatives Considered

- **K1 — 后端去打 Anthropic API**:增加外部依赖,网络超时影响 UX;且 V1 不需要 key 合法性即时反馈。
- **K2 — 仅长度校验**:无法拦截格式完全错误的输入(如粘贴了错误内容)。
- **RP2 — 两字段拆分 owner + name**:UI 增加一个字段,用户心智负担高;`owner/name` 是 GitHub 通用引用格式。
- **RP3 — 下拉(API 拉取)**:slice 3 前无 GitHub App installationId,无法拉取用户 repo 列表。

## Related

- 触发决策: `decisions/phase-2-4-3-open-questions.md §Q11`
- 关联 spec: 07-frontend.md §表单校验
- 关联 ADR: ADR-035(Server Action zod schema), ADR-046(TenantBootstrapState fields), ADR-036(AC-01-10)
