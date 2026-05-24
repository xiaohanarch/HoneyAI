# ADRs — Architecture Decision Records

> 每条 ADR 记录 V1 一个关键架构决策的 **Context / Decision / Consequences / Alternatives**。

## 索引

| ID | 标题 | 状态 |
|---|---|---|
| [ADR-001](./ADR-001-drizzle-orm.md) | 选 Drizzle ORM 不选 Prisma | Accepted |
| [ADR-002](./ADR-002-sse-not-ws.md) | 实时通信用 SSE+POST 不用 WebSocket | Accepted |
| [ADR-003](./ADR-003-unified-nextjs.md) | Unified Next.js 不拆 API/Web | Accepted |
| [ADR-004](./ADR-004-kubectl-exec-sandbox.md) | Sandbox 用 kubectl exec 长跑 pod（V1 妥协） | Accepted with Tech Debt |
| [ADR-005](./ADR-005-ghcr-only.md) | 镜像 registry 只用 ghcr，不用 ACR | Accepted |
| [ADR-006](./ADR-006-bootstrap-ux.md) | Bootstrap Welcome 4 步必填 | Accepted |
| [ADR-007](./ADR-007-run-binary-state.md) | Run 状态二元，不支持部分失败 | Accepted |

## 写作模板

```markdown
# ADR-XXX: <一句话标题>

- 状态: Proposed | Accepted | Deprecated | Superseded by ADR-YYY
- 日期: YYYY-MM-DD

## Context
<为什么要做这个决定，背景约束>

## Decision
<决定是什么>

## Consequences
- 正面: ...
- 负面: ...
- 后续影响: ...

## Alternatives Considered
- Option A: <为什么没选>
- Option B: <为什么没选>

## Related
- 相关 ADR / Tech Debt / Spec 章节
```

## 添加新 ADR
1. 复制模板新建 `ADR-XXX-<slug>.md`
2. 在本文件索引表新增一行
3. 在相关 spec 章节加链接
