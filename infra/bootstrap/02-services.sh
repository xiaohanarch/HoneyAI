#!/usr/bin/env bash
# infra/bootstrap/02-services.sh
# 部署核心服务：namespace、secrets、CNPG、Redis、web、worker、ingress、migration
#
# 前置条件:
#   1. 01-host.sh 已执行
#   2. ghcr.io 镜像已由 CI/CD 推送（deploy-prod.yml 至少跑过一次）
#   3. 以下环境变量已设置
#
# 用法:
#   export ANTHROPIC_API_KEY=sk-ant-...   # optional if using opencode+dashscope
#   export DASHSCOPE_API_KEY=...           # required for opencode + dashscope/qwen3-coder-plus
#   export GITHUB_APP_ID=...
#   export GITHUB_APP_PRIVATE_KEY="$(cat private-key.pem)"
#   export GITHUB_APP_WEBHOOK_SECRET=...
#   export KEK_BASE64=$(openssl rand -base64 32)
#   export NEXTAUTH_SECRET=$(openssl rand -base64 32)
#   export OSS_ACCESS_KEY=...
#   export OSS_SECRET_KEY=...
#   export OSS_BUCKET=...
#   bash 02-services.sh
set -euo pipefail

export KUBECONFIG=/etc/rancher/k3s/k3s.yaml

log() { echo -e "\033[1;36m[services]\033[0m $*"; }

# ── 1. namespace ──────────────────────────────────────────────────────────────
log "创建 namespace"
kubectl create ns honeyai --dry-run=client -o yaml | kubectl apply -f -

# ── 2. honeyai-secrets ────────────────────────────────────────────────────────
log "创建 honeyai-secrets"
kubectl -n honeyai create secret generic honeyai-secrets \
  --from-literal=redis_url="redis://redis:6379" \
  --from-literal=nextauth_secret="${NEXTAUTH_SECRET:?}" \
  --from-literal=anthropic_api_key="${ANTHROPIC_API_KEY:-}" \
  --from-literal=dashscope_api_key="${DASHSCOPE_API_KEY:-}" \
  --from-literal=github_app_id="${GITHUB_APP_ID:?}" \
  --from-literal=github_app_private_key="${GITHUB_APP_PRIVATE_KEY:?}" \
  --from-literal=github_app_webhook_secret="${GITHUB_APP_WEBHOOK_SECRET:?}" \
  --from-literal=kek_base64="${KEK_BASE64:?}" \
  --from-literal=oss_access_key="${OSS_ACCESS_KEY:?}" \
  --from-literal=oss_secret_key="${OSS_SECRET_KEY:?}" \
  --from-literal=oss_bucket="${OSS_BUCKET:?}" \
  --save-config \
  --dry-run=client -o yaml | kubectl apply -f -

# ── 3. 应用 base manifests（Redis、CNPG Cluster、web、worker、ingress）────────
log "kubectl apply base"
kubectl apply -k "$(dirname "$0")/../k8s/base"

# ── 4. 等待 Redis 就绪 ────────────────────────────────────────────────────────
log "等待 Redis 就绪"
kubectl -n honeyai rollout status deploy/redis --timeout=120s

# ── 5. 等待 CNPG Postgres 就绪 ────────────────────────────────────────────────
log "等待 PostgreSQL 就绪（最多 10 分钟）"
kubectl -n honeyai wait --for=condition=Ready cluster/honeyai-pg --timeout=600s

# ── 6. 运行 drizzle migrate ───────────────────────────────────────────────────
log "运行 drizzle migrate"
# 删除旧 job（幂等）
kubectl -n honeyai delete job drizzle-migrate --ignore-not-found
kubectl -n honeyai apply -f "$(dirname "$0")/../k8s/base/jobs/migrate.yaml"
kubectl -n honeyai wait --for=condition=Complete job/drizzle-migrate --timeout=300s
log "Migration 完成"

# ── 7. 运行 DB seed ───────────────────────────────────────────────────────────
log "运行 DB seed"
kubectl -n honeyai delete job db-seed --ignore-not-found
kubectl -n honeyai apply -f "$(dirname "$0")/../k8s/base/jobs/seed.yaml"
kubectl -n honeyai wait --for=condition=Complete job/db-seed --timeout=300s
log "Seed 完成"

# ── 8. 等待 web + worker 就绪 ────────────────────────────────────────────────
log "等待 web 就绪"
kubectl -n honeyai rollout status deploy/web --timeout=300s
log "等待 worker 就绪"
kubectl -n honeyai rollout status deploy/worker --timeout=300s

log "✅ Services bootstrap 完成"
log "访问: http://8.130.95.169"
