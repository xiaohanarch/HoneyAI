#!/usr/bin/env bash
# infra/bootstrap/01-host.sh
# 在新 ECS（Ubuntu 22.04）上幂等地安装 k3s + CloudNativePG + GitHub Actions runner
# 用法: GITHUB_RUNNER_TOKEN=xxxx bash 01-host.sh
set -euo pipefail

K3S_VERSION="v1.30.5+k3s1"
CNPG_VERSION="1.24.1"
RUNNER_VERSION="2.321.0"
GITHUB_REPO="https://github.com/xiaohanarch/honeyai"

log() { echo -e "\033[1;36m[bootstrap]\033[0m $*"; }

# ── 1. apt ────────────────────────────────────────────────────────────────────
log "更新 apt 并安装基础工具"
sudo apt-get update -y
sudo apt-get install -y curl git jq wget htop iotop

# ── 2. k3s（使用内置 flannel，无 Cilium）───────────────────────────────────
if ! command -v k3s &>/dev/null; then
  log "安装 k3s ${K3S_VERSION}"
  curl -sfL https://get.k3s.io | INSTALL_K3S_VERSION="${K3S_VERSION}" sh -s - \
    --write-kubeconfig-mode=644
else
  log "k3s 已安装，跳过"
fi

export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
kubectl wait --for=condition=Ready nodes --all --timeout=300s
log "k3s 节点就绪"

# ── 3. helm ───────────────────────────────────────────────────────────────────
if ! command -v helm &>/dev/null; then
  log "安装 helm"
  curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
else
  log "helm 已安装，跳过"
fi

# ── 4. CloudNativePG operator ─────────────────────────────────────────────────
if ! kubectl get ns cnpg-system &>/dev/null; then
  log "安装 CloudNativePG operator ${CNPG_VERSION}"
  kubectl apply --server-side \
    -f "https://raw.githubusercontent.com/cloudnative-pg/cloudnative-pg/release-1.24/releases/cnpg-${CNPG_VERSION}.yaml"
  kubectl -n cnpg-system wait --for=condition=Available deploy --all --timeout=300s
  log "CNPG operator 就绪"
else
  log "CNPG 已安装，跳过"
fi

# ── 5. GitHub Actions self-hosted runner（直接安装在宿主机）──────────────────
RUNNER_DIR="/home/ubuntu/actions-runner"
if [ ! -f "${RUNNER_DIR}/.runner" ]; then
  log "安装 GitHub Actions runner ${RUNNER_VERSION}"
  mkdir -p "${RUNNER_DIR}"
  cd "${RUNNER_DIR}"
  curl -fL "https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz" \
    | tar xz

  ./config.sh \
    --url "${GITHUB_REPO}" \
    --token "${GITHUB_RUNNER_TOKEN:?需要设置 GITHUB_RUNNER_TOKEN}" \
    --unattended \
    --replace \
    --labels "self-hosted,linux,x64,ecs"

  sudo ./svc.sh install ubuntu
  sudo ./svc.sh start
  log "GitHub Actions runner 已注册并启动"
else
  log "runner 已配置，跳过"
fi

# ── 6. 给 runner 设置 kubectl 访问 ───────────────────────────────────────────
mkdir -p /home/ubuntu/.kube
cp /etc/rancher/k3s/k3s.yaml /home/ubuntu/.kube/config
chown ubuntu:ubuntu /home/ubuntu/.kube/config
log "kubeconfig 已复制到 ubuntu 用户"

# ── 7. 安装 kubectl（如果不存在）──────────────────────────────────────────────
if ! command -v kubectl &>/dev/null || ! kubectl version --client &>/dev/null; then
  log "安装 kubectl"
  KUBECTL_VERSION=$(curl -L -s https://dl.k8s.io/release/stable.txt)
  curl -fLO "https://dl.k8s.io/release/${KUBECTL_VERSION}/bin/linux/amd64/kubectl"
  sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl
fi

log "✅ Host bootstrap 完成"
log "下一步: 确保 ghcr.io 镜像已推送，然后运行 02-services.sh"
