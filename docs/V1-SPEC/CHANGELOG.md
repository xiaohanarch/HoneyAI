# V1-SPEC Changelog

> 本文档记录 spec 自身的变更。代码层变更走 git 提交，不在此记录。

## 2026-05-23

### v0.1.0 — 完整版（10 章 + 7 ADR）
- 批 A（00/01/02）：术语表 + 3 黄金路径 + 4 wireframe + 4 时序图 + 9 package public API + 文件结构
- 批 B（03/04）：30 张 Drizzle 表完整 schema + 3 份 IR markdown 示例 + Tiptap SchemaForm
- 批 C（05/06）：FSM 完整转移表 + 8 类 SSE 事件示例 + retry POLICY + Dockerfile.sandbox + Cilium NetworkPolicy + Pod template
- 批 D（07/08/09）：tokens.css 完整 OKLCH 设计系统 + 02-services.sh + deploy-prod.yml + CNPG/Ingress/Deployment manifest + Grafana 面板 JSON + prom-client + 黄金路径 A 实算成本 121,955 μUSD ≈ $0.12
- 批 E（10 + ADRs）：15 条 Tech Debt（含 V2 触发信号）+ 7 个完整 ADR（drizzle / sse / unified-next / kubectl-exec / ghcr-only / bootstrap-ux / run-binary-state）

### v0.1.0-skeleton — 初版骨架
- 从 grill-me 会话 Q1-Q17 生成 10 个章节骨架 + 7 个 ADR 索引
- 决策：Tier B 范围 / Bootstrap UX 4 步 / 失败 UX 二元状态 / 原型 B 策略（legacy 参考）/ ECS 单节点 / Tech debt 15 条
