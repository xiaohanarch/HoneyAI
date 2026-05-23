# ADR-007: Run 状态二元，不支持部分失败

- 状态: Accepted
- 日期: 2026-05-23

## Context
一个 Run 有 N 个节点。任一节点失败时的处理方式：
- A. **部分失败** — 失败节点标 failed，整体 Run 标 partial，已成功节点 artifact 保留并可作为下游输入
- B. **二元** — 任一节点失败 → 整 Run failed，artifact 保留但不可消费，重试从头开
- C. 节点级 retry（worker 自动重试 N 次后才升级到 Run failure）

V1 约束：MVP、debug 体验优先、避免「半成品 Run」造成认知负担。

## Decision
选 **B. 二元状态 + 节点级有限自动重试**。
- Run.status ∈ {pending, running, completed, failed, canceled}
- 节点失败 → worker 按 POLICY 自动 retry（见 05-orchestrator §retry policy）
- retry 耗尽 → 节点标 failed → Run 立即标 failed
- artifact 全保留（用户可肉眼看 / 复制文本），但「resume 失败 Run」V1 不支持
- 用户必须从头创建新 Run

## Consequences
- 正面:
  - Run 状态心智模型最简：成功 or 失败，无第三态
  - 调试时 UI 永远展示一条线性时间轴，不需要 "哪些是绿哪些是红" 的复杂渲染
  - 失败强制反思 IR 是否要修，避免在错误的中间产物上继续构建
- 负面:
  - 失败一次浪费一次 token 成本（TD-010）
  - 长 Run（如 golden path C 重构认证）失败痛感强
- 后续影响:
  - cost_events 不区分成功/失败（09-observability-cost §6）
  - failure_class 必须分类（infra/user/llm/quota/budget），让用户判断「重试值不值」
  - V2 加 fork Run（从指定节点继承 artifact 开新 Run），见 TD-010

## Alternatives Considered
- **A. 部分失败**: 状态机复杂度 × N，UI 渲染 × N，"下游节点能不能跑" 的依赖判断逻辑膨胀；V1 不值
- **C. 节点级 retry 即终态**: 已在 V1 内（POLICY），但 retry 耗尽后必须升级 Run 级失败，不让节点单独留 failed 终态

## Related
- 05-orchestrator.md §FSM
- 05-orchestrator.md §retry policy（POLICY 常量）
- 09-observability-cost.md §6（失败也计入成本）
- TD-010（V2 fork Run）
