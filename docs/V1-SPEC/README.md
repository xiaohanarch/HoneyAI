# HoneyAI V1 Spec — Index

> **新 session / AI agent 第一份要读的文件。** 这里只有索引和状态；正文按需进各章。

## Quick Start

1. **首次入场**：读 [00-README.md](./00-README.md) 理解阅读顺序、术语表、验收清单约定
2. **找某个具体话题**：查下表，定位章节
3. **想知道为什么这样设计**：去 [ADRs/](./ADRs/)
4. **V1 没做的事**：去 [10-tech-debt.md](./10-tech-debt.md) 查 V2 计划
5. **spec 变更历史**：见 [CHANGELOG.md](./CHANGELOG.md)

## 文档索引

| 文件 | 作用 | 状态 |
|---|---|---|
| [00-README](./00-README.md) | 阅读顺序 + 术语表 + 验收清单约定 + 文档约定 | 🟡 living（约定可演进） |
| [01-product](./01-product.md) | V1 范围（Tier B）+ 3 黄金路径 + Bootstrap/失败 UX + wireframe | 🟢 frozen |
| [02-architecture](./02-architecture.md) | 总架构 + 8 package 边界 + 4 时序图 + image digest 绑定 | 🟢 frozen |
| [03-data-model](./03-data-model.md) | 30 表 Drizzle schema + ir_documents + artifacts 不可变约束 + withTenant | 🟢 frozen |
| [04-ir-schemas](./04-ir-schemas.md) | RequirementIR / DesignIR / ImplementationIR + IR 版本规则（乐观锁 + 编辑锁） | 🟢 frozen |
| [05-orchestrator](./05-orchestrator.md) | Run/Node FSM + 6 类失败 + retry POLICY + reconcile loop | 🟢 frozen |
| [06-sandbox](./06-sandbox.md) | 镜像 + kubectl exec + Cilium NetworkPolicy + OSS 写入语义 + artifact 路径 | 🟢 frozen |
| [07-frontend](./07-frontend.md) | 路由 + SSE+POST + Tiptap + shadcn + tokens.css OKLCH 设计系统 | 🟢 frozen |
| [08-infra-deploy](./08-infra-deploy.md) | ECS bootstrap 4 阶段 + k3s/CNPG/Cilium + CI/CD + deploy-prod.yml | 🟢 frozen |
| [09-observability-cost](./09-observability-cost.md) | Loki/VM/Grafana + cost_events + 黄金路径 A 实算 $0.12 | 🟢 frozen |
| [10-tech-debt](./10-tech-debt.md) | 16 条 V1→V2 债务清单 + 升级触发表 | 🟡 living（条目持续累加） |
| [CHANGELOG](./CHANGELOG.md) | spec 自身的版本变更历史 | 🟡 living |
| [ADRs/](./ADRs/) | 8 个架构决策记录（含 ADR-008 Phase 1 范围） | 🟡 living（新决策持续追加） |

## 状态说明

- 🟢 **frozen**：变更必须走 CHANGELOG + 版本号 bump（v0.x.y），通常配套新 ADR
- 🟡 **living**：日常增量更新即可（追加 TD / ADR / CHANGELOG 条目），无需 spec 版本号 bump

## 当前 spec 版本

**v0.2.0**（2026-05-24，PR #1 合入）— 详见 [CHANGELOG](./CHANGELOG.md)
