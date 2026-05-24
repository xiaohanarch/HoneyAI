# ADR-004: Sandbox 用 kubectl exec 长跑 pod 模式

- 状态: Accepted with Tech Debt（TD-001）
- 日期: 2026-05-23

## Context
一个 Run 包含 N 个节点（enrich / design / merge / implement / quality / pr / ...），需要 sandbox 隔离执行。

候选拓扑：
- A. **每节点一个 k8s Job**（短任务，事件驱动）
- B. **每 Run 一个 Pod 长跑，worker kubectl exec 串行节点**
- C. **远程 sandbox 服务（gRPC，独立部署）**

V1 约束：单节点 ECS、必须 6 周上线、节点间 artifact 共享开销低。

## Decision
选 **B. 每 Run 一个 Job，Pod `sleep infinity`，worker kubectl exec 多次进入串行节点**。
- worker 通过 k8s Go SDK `Exec` API 进入 Pod 跑 sandbox-runner CLI
- 节点间 artifact 在 Pod 本地 /workspace 共享（无需上传下载）
- Run 结束 / 超时 / 取消 → 删 Job

## Consequences
- 正面:
  - artifact 在节点间零成本共享（同 Pod 文件系统）
  - 启动一次 Pod = 复用 image 拉取、依赖装载、Git clone
  - 6 周可上线（vs Argo Workflows 需更多集成）
- 负面 / 反常规:
  - Pod 不是无状态短任务，违背 k8s Job 语义
  - Exec 流不在 k8s 事件模型内（kubectl logs 看不到 exec 输出）
  - Pod OOM / 被驱逐 → Job controller 不会重启「当前节点」状态
  - 长跑 Pod 占资源（V1 Run 级超时 = 30 分钟硬切）
- 后续影响:
  - 必须 5 分钟 reconcile loop 校正 Run / Pod 状态分歧
  - 节点边界必须显式 checkpoint artifact 到 OSS（不能只信 Pod 内存）
  - sandbox-runner 必须输出 JSONL 到 stdout 让 worker 解析（替代 k8s event）

## Alternatives Considered
- **A. 每节点一个 Job**: 事件驱动干净，但 artifact 共享需 PVC 或全 OSS 上下传（成本 × N，延迟 × N）；V1 放弃
- **C. 远程 sandbox 服务**: 又多一个有状态服务要运维；V1 不值
- **Argo Workflows**: 解决了 A 的痛点，但 V1 团队无运维经验 + 学习曲线 + 镜像 600MB+；推到 V2

## Related
- 06-sandbox.md（完整拓扑、Dockerfile、NetworkPolicy）
- TD-001（V2 改 Argo / Job-per-Node 的触发条件）
- 05-orchestrator.md §reconcile loop
