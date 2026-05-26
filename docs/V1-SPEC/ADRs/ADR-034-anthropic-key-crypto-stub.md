# ADR-034: Anthropic API key 加密用 V1 base64 stub

- 状态: Accepted
- 日期: 2026-05-26

## Context

切片 4.3 的 Step 1 必须将 Anthropic API key 落库(`tenants.settings.bootstrap.anthropicKeyCiphertext`),但 spec 02 §security 定义的 AEAD 加密能力(`packages/secrets`)属于切片 2 范围,尚未实施。直接明文存储违反 spec,等待切片 2 又会阻塞切片 4.3。需要一个接口稳定、实现可替换的过渡方案。

## Decision

在 `packages/core/src/crypto/anthropic-key.ts` 暴露以下接口:

```ts
export function encryptAnthropicKey(plain: string): string
export function decryptAnthropicKey(cipher: string): string
```

**V1 实现**:使用 `v1:` 前缀 + base64 envelope(`v1:${Buffer.from(plain).toString('base64')}`),字段名 `_ciphertext` 预留语义。

**切片 2 替换路径**:Phase 2.2(切片 2)引入 AES-GCM + KMS 时,只需替换 `core/crypto/anthropic-key.ts` 内部实现,所有调用方(切片 4.3 Step 1 action、sandbox runner 等)零感知。替换后必须新建 ADR + migration 对历史 `v1:` 前缀数据重新加密。

在 dev 模式 README 及 `zh.ts` error namespace 中明确标注"当前存储为 base64 占位,非生产加密"。

## Consequences

**正面**:
- 接口契约前置,切片 4.3 可立即实施,无需等待切片 2。
- `v1:` 前缀版本化设计让迁移脚本可按前缀区分处理策略。
- 调用方与加密实现完全解耦。

**负面**:
- base64 占位期间(切片 4.3 → 切片 2)数据实际未加密,仅 base64 编码。
- 需要在文档和错误提示中明确标注,避免误认为已加密。

**后续影响**:
- 切片 2 替换后,历史 `v1:base64` 记录需迁移脚本重新加密为 `v2:aead` 格式。
- sandbox runner 解密调用同接口,切片 2 后自动升级。

## Alternatives Considered

- **X1 — 明文存储**:违反 spec 02 §security,不可选。
- **X2 — 直接接入 KMS**:切片 2 才有,切片 4.3 无法使用。
- **X3 — bcrypt**:单向哈希,无法解密供 sandbox runner 使用。
- **X4 — 纯 base64 无前缀**:无版本标记,迁移时无法区分历史数据格式。

## Related

- 触发决策: `decisions/phase-2-4-3-open-questions.md §Q3`
- 关联 spec: 02-architecture.md §security, packages/secrets(切片 2)
- 关联 ADR: ADR-032(Step 1 字段落库), ADR-035(Server Action 调用加密)
