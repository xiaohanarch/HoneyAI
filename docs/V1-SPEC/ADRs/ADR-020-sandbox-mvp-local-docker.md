# ADR-020: Sandbox MVP 用本地 Docker(替代 spec 06 §k3s)

- 状态: Accepted
- 日期: 2026-05-26

## Context

V1-SPEC `06-sandbox.md` 定义生产 sandbox 跑在 k3s 上,通过 `kubectl exec` 进入长跑 pod 执行 Claude Code CLI(ADR-004 妥协)。该方案在 V1.0 prod 环境正确,但 Phase 2 MVP 阶段(目标:端到端 demo 3-stage DevPipeline)落地 k3s 成本过高:

- k3s 单节点部署 + Cilium NetworkPolicy 配置 + sandbox image push 到 registry
- 本机 / CI / demo 环境都要装 k3s 或 kind,Windows 体验差
- sandbox-runner 与 worker 的 image digest 强绑定(spec v0.2.0 P0-2)需要 kustomize patch 链路
- 实际 MVP 演示场景:单机本地跑 → 不需要多租户网络隔离 / pod 调度 / HPA

切片 2(`@honeyai/sandbox-runner` 实建)排期前必须决定运行时底座,否则阻塞 adapter-claude 集成。

## Decision

Sandbox MVP **使用本地 Docker**(通过 `dockerode` 或 `child_process.exec('docker exec ...')` 进入长跑容器),`kubectl exec` 路径推迟到 V1.0 prod 部署:

- `@honeyai/sandbox-runner` 内部定义 `SandboxBackend` 接口
- Phase 2 切片 2 仅交付 `LocalDockerSandbox` 实现
- `K8sSandbox` 实现作为占位 stub(`throw new Error('NotImplemented — V1.0 only')`),保留接口形状
- spec `06-sandbox.md` 起首段补充"MVP / V1.0 双模式"说明(在切片 2 实施 PR 内 patch)

## Consequences

**正面**:

- 省去 k3s / Cilium / kustomize 工具链约 50% 部署工作量,MVP 演示阶段不需要 prod 隔离
- 本机 / CI / demo 环境统一 docker-compose,Windows 用户体验一致
- 切片 2 排期收窄约 1.5 周
- `SandboxBackend` 接口在切片 2 落地,V1.0 切回 K8s 仅需补 `K8sSandbox` 实现 + 配置开关,业务侧零改动

**负面**:

- sandbox 与 worker 跑在同一 docker network,**MVP 阶段不提供** spec 06 §10 的 Cilium NetworkPolicy 出站白名单;LLM 注入恶意 git remote / npm publish 时无网络层兜底
- 多租户共享同一 docker daemon,无 cgroup / 进程命名空间硬隔离
- 与 spec 06 §k3s 字面冲突,需 spec patch(在切片 2 PR 内提交)

**后续影响**:

- V1.0 prod 切回 K8s 时,worker 配置注入 `SANDBOX_BACKEND=k8s` env,sandbox image digest 由 deploy-prod.yml kustomize patch 注入(spec v0.2.0 P0-2 链路)
- Tech Debt 新增条目:**TD-019 — Sandbox 本地 Docker 无网络层隔离**(MVP 限定;触发信号:首次发现 sandbox 进程对外 push 异常 commit / 第二个租户接入)
- 切片 2 PR 必须同时:(a) 实现 `LocalDockerSandbox`;(b) 在 `06-sandbox.md` 起首段加 MVP/V1.0 双模式说明;(c) 在 `10-tech-debt.md` 追加 TD-019

## Alternatives Considered

- **A:严格按 spec 06 跑 k3s + kubectl exec**:正确但 Phase 2 MVP 阶段成本过高,阻塞切片 2 排期约 1.5 周;Windows demo 体验差;放弃。
- **B:Firecracker microVM**:隔离粒度比 docker 强,接近 K8s 但单机;依赖 KVM,Windows 不可跑,demo 受限;放弃。
- **C:不跑 sandbox,直接在 worker 进程内 spawn Claude Code CLI**:无任何隔离,LLM 写入 `~/.ssh/known_hosts` 等场景风险过高;放弃。

## Related

- 取代:`06-sandbox.md §k3s`(MVP 阶段)
- 关联 ADR:**ADR-004**(kubectl exec 长跑 pod,V1.0 prod 仍生效)
- 关联 spec:**06-sandbox.md**(需在切片 2 实施 PR patch 起首段)
- 关联 Tech Debt:**TD-019**(待开,切片 2 PR 内追加)
- 触发决策:`decisions/phase-2-open-questions.md §M3`
