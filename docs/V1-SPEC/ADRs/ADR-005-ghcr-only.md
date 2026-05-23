# ADR-005: 镜像 registry 只用 ghcr，不用 ACR

- 状态: Accepted
- 日期: 2026-05-23

## Context
HoneyAI 部署在阿里云 ECS，镜像候选：
- A. **阿里云 ACR**（同 region 拉取快、需 AK/SK 凭据）
- B. **GitHub Container Registry (ghcr.io)**（与 Actions 同源，OIDC 免密推）
- C. 两者都用

CI 跑在 GitHub Actions self-hosted runner（部署在同台 ECS）。

## Decision
选 **B. 仅 ghcr.io**。
- web / worker / sandbox 三镜像全部推 ghcr
- ECS 配置 ghcr 拉取 secret（GitHub PAT 只读 packages 权限）
- 不在阿里云控制台留任何长期 AK/SK

## Consequences
- 正面:
  - 零阿里云控制台凭据落地（除 ECS root + OSS bucket policy）
  - ghcr 推送用 GITHUB_TOKEN OIDC，无需 secret 轮换
  - image digest 与 commit SHA 强关联，CI 可直接 kustomize edit
  - 团队成员 GitHub 权限统一治理
- 负面:
  - ghcr 拉取走公网，首次拉取 600MB sandbox 镜像 ~2-5 分钟（V1 接受，部署频率低 + crictl 预拉取）
  - ghcr 故障时无法部署（历史上罕见，且镜像已在 ECS 本地缓存 → 不影响运行）
- 后续影响:
  - 必须配置 `imagePullPolicy: IfNotPresent` + 预拉取脚本（02-services.sh）
  - sandbox 镜像 tag 用 `vX.Y.Z + digest`，避免 `latest` 漂移

## Alternatives Considered
- **A. ACR only**: 拉取快但需要长期 AK/SK，且 CI 推送要在阿里云开 RAM 子账号；治理成本高
- **C. 双 registry**: 同步逻辑 + 故障切换逻辑；V1 不值

## Related
- 08-infra-deploy.md §镜像与拉取（含 imagePullSecret 配置）
- 08-infra-deploy.md §deploy-prod.yml workflow
