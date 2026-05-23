# HoneyAI V1 Spec

> 本文档生成自 grill-me 会话 Q1-Q17（2026-05-23）。
> 后续 spec 自身的变更请记录在 [CHANGELOG.md](./CHANGELOG.md)。

HoneyAI 是一个多智能体 AI 数字研发产线（DevPipeline），用 3 阶段（需求富化 → 设计与拆解 → 编码+UT）把一句话需求自动转成一个含代码 + 单测的 GitHub Pull Request，过程中保留人在回路的 Gate 节点。

V1 目标：让一个 5-10 人的小团队能自部署后试用 1-2 周并产出可信反馈。

## 阅读顺序

1. **[01-product.md](./01-product.md)** — V1 范围（Tier B）、目标用户、Bootstrap UX、失败 UX
2. **[02-architecture.md](./02-architecture.md)** — 总架构、8 个 package 职责、数据流、运行时拓扑
3. **[03-data-model.md](./03-data-model.md)** — 30 表 schema、关键索引、多租户隔离
4. **[04-ir-schemas.md](./04-ir-schemas.md)** — RequirementIR / DesignIR / ImplementationIR
5. **[05-orchestrator.md](./05-orchestrator.md)** — Run/Node 生命周期、Gate、6 类失败、并发
6. **[06-sandbox.md](./06-sandbox.md)** — 镜像、kubectl exec 模型、网络白名单、资源限额
7. **[07-frontend.md](./07-frontend.md)** — 路由、SSE+POST、Tiptap、shadcn、设计 tokens
8. **[08-infra-deploy.md](./08-infra-deploy.md)** — ECS bootstrap 4 阶段、k3s/CNPG/Cilium、CI/CD
9. **[09-observability-cost.md](./09-observability-cost.md)** — Loki/VM/Grafana、cost_events
10. **[10-tech-debt.md](./10-tech-debt.md)** — TD-001 起的 V1→V2 债务清单
11. **[ADRs/](./ADRs/)** — 关键架构决策记录

## Quick Start

```bash
# 0. 阅读 01-product.md 理解你要做什么
# 1. 阅读 02-architecture.md 理解整体形态
# 2. 按 08-infra-deploy.md 在 ECS 上拉起基础设施
# 3. 按 02-architecture.md 的 monorepo 结构开始写代码
# 4. 遇到任何"为什么这样设计"的疑问 → 去 ADRs/ 查
# 5. 任何 V1 没做的事 → 去 10-tech-debt.md 查 V2 计划
```

## 核心约束

- **V1 = Tier B**（详见 01-product.md）。砍掉一切运营/治理类功能（市场、replay、SSO、告警、英文/深色）
- **MVP 简单优先**。所有"反常规但能跑"的方案都先用，标 tech debt，V2 再回来修
- **单租户单仓库可用，多租户多仓库可用**。但 V1 默认 GitHub App 安装一个 repo 作为试用入口
- **zh-CN only / 浅色 only / Claude Code only**（Runtime build-time 锁定）

## 文档约定

- 所有 schema 用 TypeScript / Drizzle / Zod 描述，不用 SQL DDL
- 所有架构决策放 ADR 文件，正文只写"是什么"，"为什么"放 ADR
- 所有 V1 不做的事必须显式写在 10-tech-debt.md 里，不要让读者猜

## 词汇表（Glossary）

| 术语 | 含义 |
|---|---|
| **Tenant** | 租户主体，对应一个团队 / 一个 personal 账号；URL 路径 `/t/<slug>/...` |
| **Run** | 一次完整流水线执行，从一句话需求到一个 PR |
| **Node** | Run 内的执行单元，类型为 agent / gate / merge / deploy |
| **Stage** | Node 的分组：Stage1（需求富化）/ Stage2（设计与拆解）/ Stage3（编码+UT） |
| **Gate** | 强制人在回路节点，由人查看 IR 并决定是否通过 |
| **IR** | Intermediate Representation，3 阶段之间传递的结构化数据（Markdown + YAML frontmatter） |
| **Artifact** | 节点产出的不可变文件，CAS 存储（sha256 → OSS） |
| **Asset** | 用户/平台维护的复用资源，8 类：skill / rule / command / script / hook / hint / template / context |
| **Sandbox** | 每 Run 独立的 k8s Pod，跑 Claude Code CLI 和用户代码 |
| **Adapter** | Runtime 适配层，封装 Claude Code CLI / opencode CLI |
| **CAS** | Content-Addressable Storage，按内容 sha256 寻址 |
| **micro-USD** | 成本计量单位，1 USD = 10^6 micro-USD（bigint 防浮点累加误差） |
| **TD-XXX** | Tech Debt 编号，见 10-tech-debt.md |
| **ADR-XXX** | Architecture Decision Record 编号，见 ADRs/ |
| **mirror / import-once** | Asset 从 GitHub 导入的两种 sync 模式 |
| **platform_admin** | 平台超管，首位登录的 GitHub 用户自动获得 |

## 文档约定

### 标记约定
- ✅ V1.0 必须含
- ❌ V1.0 显式不含（去 10-tech-debt.md 查 V2 计划）
- ⭐ 推荐 / 默认选择
- ⚠️ 注意 / 风险点
- TODO: 填充阶段补充
- (V1.1) / (V2) — 何时启用

### 代码示例
- TypeScript：用于 schema / 类型 / 接口
- Drizzle：用于 ORM 表定义
- zod：用于 runtime 校验
- YAML：用于 k8s manifests
- bash：用于运维脚本
- 不使用裸 SQL DDL（一律走 Drizzle）

### 决策来源
所有决策都可追溯到 grill-me 会话 Q1-Q17。
关键决策的"为什么"在 ADRs/。
"是什么"在本目录其他文件。

### 章节链接
跨章节引用统一格式：`详见 [05-orchestrator.md §4](./05-orchestrator.md#4-重试机制)`
