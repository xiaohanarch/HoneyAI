# 08 — Infra & Deploy

## 1. 生产拓扑

- Aliyun ECS 单节点 4C/16G/200GB SSD，Ubuntu 22.04 LTS
- k3s server（单节点，traefik 内置）
- Cilium（替换 flannel，用于 FQDN 白名单）
- CloudNativePG operator
- cert-manager + Let's Encrypt（HTTP-01 challenge）
- Aliyun OSS（私有 bucket，CAS + Loki backend + CNPG backup）
- GitHub Actions self-hosted runner 运行在 ECS k3s 内

## 2. Bootstrap 4 阶段

### 阶段 0 — 阿里云控制台手动（一次性 ~30 min）
1. 购 ECS（Ubuntu 22.04，4C/16G/200GB），开放 22/80/443
2. 购 OSS bucket（私有）+ RAM 子账号 AK/SK
3. 备案域名 + DNS A 记录指向 ECS
4. （可选）SLB —— V1 不用

### 阶段 1 — ECS 初始化 `infra/bootstrap/01-host.sh`（~10 min，幂等）
- apt 升级 + 安装 curl/git/jq
- 安装 k3s（`--flannel-backend=none` 留给 cilium）
- 安装 cilium（helm）
- 安装 cert-manager
- 安装 CloudNativePG operator
- 注册 GitHub Actions self-hosted runner 到目标 repo

### 阶段 2 — 核心服务 `infra/bootstrap/02-services.sh`（~10 min）
- `kubectl apply -k infra/k8s/base`
  - namespace: honeyai
  - Secret: GitHub App 私钥 / Anthropic API key / KEK（首次手动 echo）
  - PostgreSQL Cluster (CNPG)
  - Loki + VictoriaMetrics + Grafana
  - Ingress + TLS（cert-manager 自动签）
- 等 CNPG ready → `kubectl run drizzle-migrate`

### 阶段 3 — 应用部署
- 首次：手动 `kubectl apply -k infra/k8s/overlays/prod`
- 后续：GitHub Actions self-hosted runner 触发
- 健康检查通过 → 访问 https://honeyai.example.com

### 阶段 4 — 首个 admin 引导
- 第一个登录的 GitHub 用户自动 platform_admin（DB 判 user 表为空）
- 该用户看到 /admin 入口

## 3. Secret 管理

### 3.1 V1.0 方案
- `kubectl create secret` 手动 echo
- 同时写到 ECS `~/.honeyai/secrets.env`（chmod 600）作为 DR
- 列表：
  - GITHUB_APP_PRIVATE_KEY
  - GITHUB_APP_ID
  - GITHUB_APP_WEBHOOK_SECRET
  - ANTHROPIC_API_KEY
  - KEK（信封加密主密钥）
  - DATABASE_URL（CNPG 自动注入）
  - OSS_ACCESS_KEY / OSS_SECRET_KEY

### 3.2 V1.1 改 Vault / Aliyun KMS
（见 TD-006）

## 4. CI/CD

### 4.1 GitHub Actions self-hosted runner
- 跑在 ECS k3s 内的 Pod
- 通过 GITHUB_TOKEN 拉代码 / 推 ghcr
- kubeconfig 通过 ServiceAccount 自动注入
- **零外部 Aliyun 凭据**

### 4.2 工作流
```
push to main
  → buildx build & push ghcr (web, worker, sandbox)
    - 多阶段 Dockerfile + distroless
    - tag: main-<sha> + vSemVer（如 v1.0.0）
    - trivy scan, HIGH 阻断
  → kubectl set image deployment/web ...
  → kubectl rollout status
  → 失败回滚: kubectl rollout undo
```

### 4.3 manifest 引用 digest
- image 引用 `ghcr.io/<org>/honeyai-web@sha256:...`（不是 tag）
- 防止 tag 漂移

### 4.4 PR preview
- V1.0 不做
- V1.1 加 namespace-per-PR

## 5. 数据库（CNPG）

### 5.1 配置
- 单实例（V1.0 无 HA）
- pg 16
- 资源 1C/2Gi
- storage 50Gi（block storage）

### 5.2 备份
- `Cluster.spec.backup.barmanObjectStore` → Aliyun OSS（S3 兼容 endpoint）
- 每日 02:00 全量
- WAL 持续归档
- 保留 30 天

### 5.3 恢复 drill
- V1.0 文档化季度手动 drill
- V1.1 自动

## 6. 备份策略汇总

| 数据 | 后端 | 频率 | 保留 |
|---|---|---|---|
| PostgreSQL | OSS via CNPG | 日全量 + WAL | 30 天 |
| Artifact (CAS) | OSS | 持久（CAS 不需重复备份） | 90 天 + pin 永久 |
| Loki 日志 | OSS | 持久 | 30 天 |
| Grafana 配置 | ConfigMap (git) | git 推送即生效 | 永久 |

## 7. TLS 证书
- cert-manager
- Let's Encrypt HTTP-01 challenge
- 自动续期
- 不用 DNS-01（避免管 DNS API key）

## 8. 单节点风险与缓解

| 风险 | V1 缓解 | V1.1 修复 |
|---|---|---|
| ECS 宕机 | 备份可恢复，RTO ~30 min | 加备用节点 |
| 磁盘满 | Prometheus 告警 80% | 自动扩容 |
| Pod 资源争抢 | requests/limits 严格设 | 加节点 |

## 9. Bootstrap 脚本测试方式
- 本地 multipass / Vagrant 起 Ubuntu 22.04 VM 跑全套
- 验证幂等
- CI 不跑（开销大）

## 10. 自部署 vs Hosted
- V1.0 只提供自部署 + bootstrap 脚本
- Hosted SaaS 不在 V1 范围

## 11. infra/ 目录结构（占位）
```
infra/
├── bootstrap/
│   ├── 01-host.sh
│   └── 02-services.sh
├── docker/
│   ├── Dockerfile.web
│   ├── Dockerfile.worker
│   └── Dockerfile.sandbox
└── k8s/
    ├── base/
    │   ├── kustomization.yaml
    │   ├── namespace.yaml
    │   ├── postgres-cluster.yaml
    │   ├── loki.yaml
    │   ├── victoriametrics.yaml
    │   ├── grafana.yaml
    │   ├── web-deployment.yaml
    │   ├── worker-deployment.yaml
    │   ├── ingress.yaml
    │   ├── network-policy.yaml
    │   └── secrets.example.yaml
    └── overlays/
        └── prod/
            ├── kustomization.yaml
            └── patches/
```

## 12. Bootstrap 脚本

### 12.1 01-host.sh
```bash
#!/usr/bin/env bash
# infra/bootstrap/01-host.sh
# 在新 ECS 上幂等地安装 k3s + cilium + cert-manager + CNPG + github runner
set -euo pipefail

K3S_VERSION="v1.30.5+k3s1"
CILIUM_VERSION="1.16.3"
CERT_MANAGER_VERSION="v1.16.1"
CNPG_VERSION="0.22.1"

log() { echo -e "\033[1;36m[bootstrap]\033[0m $*"; }

# 1. apt
log "更新 apt 并装基础工具"
sudo apt-get update -y
sudo apt-get install -y curl git jq wget htop iotop

# 2. k3s（无 flannel，给 cilium 用）
if ! command -v k3s &>/dev/null; then
  log "安装 k3s ${K3S_VERSION}"
  curl -sfL https://get.k3s.io | INSTALL_K3S_VERSION="${K3S_VERSION}" sh -s - \
    --flannel-backend=none \
    --disable-network-policy \
    --disable=traefik=false \
    --write-kubeconfig-mode=644
fi

export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
kubectl wait --for=condition=Ready nodes --all --timeout=300s

# 3. helm
if ! command -v helm &>/dev/null; then
  log "安装 helm"
  curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
fi

# 4. cilium
if ! kubectl -n kube-system get ds cilium &>/dev/null; then
  log "安装 cilium ${CILIUM_VERSION}"
  helm repo add cilium https://helm.cilium.io/ && helm repo update
  helm install cilium cilium/cilium --version "${CILIUM_VERSION}" \
    --namespace kube-system \
    --set kubeProxyReplacement=true \
    --set hubble.relay.enabled=false \
    --set hubble.ui.enabled=false
fi

# 5. cert-manager
if ! kubectl get ns cert-manager &>/dev/null; then
  log "安装 cert-manager ${CERT_MANAGER_VERSION}"
  kubectl apply -f "https://github.com/cert-manager/cert-manager/releases/download/${CERT_MANAGER_VERSION}/cert-manager.yaml"
  kubectl -n cert-manager wait --for=condition=Available deploy --all --timeout=300s
fi

# 6. CloudNativePG
if ! kubectl get ns cnpg-system &>/dev/null; then
  log "安装 CloudNativePG operator ${CNPG_VERSION}"
  kubectl apply --server-side -f "https://raw.githubusercontent.com/cloudnative-pg/cloudnative-pg/release-1.24/releases/cnpg-1.24.1.yaml"
  kubectl -n cnpg-system wait --for=condition=Available deploy --all --timeout=300s
fi

# 7. GitHub Actions self-hosted runner（k8s ARC）
if ! kubectl get ns actions-runner-system &>/dev/null; then
  log "安装 Actions Runner Controller"
  helm repo add actions-runner-controller https://actions-runner-controller.github.io/actions-runner-controller
  helm install arc actions-runner-controller/actions-runner-controller \
    --namespace actions-runner-system --create-namespace \
    --set authSecret.create=true \
    --set authSecret.github_token="${GITHUB_RUNNER_TOKEN:?需要设置 GITHUB_RUNNER_TOKEN}"
  # RunnerDeployment manifest 单独 apply（在 02-services.sh）
fi

log "✅ Host bootstrap 完成"
```

### 12.2 02-services.sh
```bash
#!/usr/bin/env bash
# infra/bootstrap/02-services.sh
set -euo pipefail
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml

log() { echo -e "\033[1;36m[services]\033[0m $*"; }

DOMAIN="${HONEYAI_DOMAIN:?需要设置 HONEYAI_DOMAIN}"
LE_EMAIL="${LE_EMAIL:?需要设置 LE_EMAIL}"

# 1. namespace + secrets
log "创建 namespace + secrets"
kubectl create ns honeyai --dry-run=client -o yaml | kubectl apply -f -

cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Secret
metadata: { name: honeyai-secrets, namespace: honeyai }
type: Opaque
stringData:
  anthropic_api_key: "${ANTHROPIC_API_KEY:?}"
  github_app_id: "${GITHUB_APP_ID:?}"
  github_app_private_key: |
$(echo "${GITHUB_APP_PRIVATE_KEY:?}" | sed 's/^/    /')
  github_app_webhook_secret: "${GITHUB_APP_WEBHOOK_SECRET:?}"
  kek_base64: "${KEK_BASE64:?}"
  oss_access_key: "${OSS_ACCESS_KEY:?}"
  oss_secret_key: "${OSS_SECRET_KEY:?}"
  oss_endpoint: "${OSS_ENDPOINT:?}"
  oss_bucket: "${OSS_BUCKET:?}"
EOF

# 2. cert-manager ClusterIssuer
cat <<EOF | kubectl apply -f -
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata: { name: letsencrypt-prod }
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: ${LE_EMAIL}
    privateKeySecretRef: { name: letsencrypt-prod }
    solvers:
      - http01: { ingress: { class: traefik } }
EOF

# 3. 全套 base manifest
log "kubectl apply 全套 base"
kubectl apply -k infra/k8s/base

# 4. 等 CNPG ready
log "等 PostgreSQL Ready"
kubectl -n honeyai wait --for=condition=Ready cluster/honeyai-pg --timeout=600s

# 5. 跑首次 migration
log "运行 drizzle migrate"
kubectl -n honeyai apply -f infra/k8s/base/jobs/migrate.yaml
kubectl -n honeyai wait --for=condition=Complete job/drizzle-migrate --timeout=300s

# 6. seed 官方 assets / pricing_book
log "seed system data"
kubectl -n honeyai apply -f infra/k8s/base/jobs/seed.yaml

log "✅ Services bootstrap 完成 — 访问 https://${DOMAIN}"
```

### 12.3 GitHub Actions workflow
```yaml
# .github/workflows/deploy-prod.yml
name: Deploy Prod

on:
  push: { branches: [main] }
  workflow_dispatch:

permissions:
  contents: read
  packages: write
  id-token: write

jobs:
  build:
    runs-on: self-hosted
    outputs:
      web-digest: ${{ steps.web.outputs.digest }}
      worker-digest: ${{ steps.worker.outputs.digest }}
      sandbox-digest: ${{ steps.sandbox.outputs.digest }}
    steps:
      - uses: actions/checkout@v4

      - uses: docker/setup-buildx-action@v3

      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build & push web
        id: web
        uses: docker/build-push-action@v6
        with:
          context: .
          file: infra/docker/Dockerfile.web
          tags: |
            ghcr.io/${{ github.repository_owner }}/honeyai-web:main-${{ github.sha }}
            ghcr.io/${{ github.repository_owner }}/honeyai-web:latest
          push: true
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - name: Build & push worker
        id: worker
        uses: docker/build-push-action@v6
        with: { context: ., file: infra/docker/Dockerfile.worker, tags: "ghcr.io/${{ github.repository_owner }}/honeyai-worker:main-${{ github.sha }}", push: true, cache-from: "type=gha", cache-to: "type=gha,mode=max" }

      - name: Build & push sandbox
        id: sandbox
        uses: docker/build-push-action@v6
        with: { context: ., file: infra/docker/Dockerfile.sandbox, tags: "ghcr.io/${{ github.repository_owner }}/honeyai-sandbox:main-${{ github.sha }}", push: true, cache-from: "type=gha", cache-to: "type=gha,mode=max" }

      - name: Trivy scan (web)
        uses: aquasecurity/trivy-action@0.28.0
        with:
          image-ref: ghcr.io/${{ github.repository_owner }}/honeyai-web@${{ steps.web.outputs.digest }}
          severity: HIGH,CRITICAL
          exit-code: '1'

  deploy:
    needs: build
    runs-on: self-hosted
    steps:
      - uses: actions/checkout@v4
      - name: Patch kustomization with digests
        run: |
          cd infra/k8s/overlays/prod
          kustomize edit set image \
            ghcr.io/${{ github.repository_owner }}/honeyai-web@${{ needs.build.outputs.web-digest }} \
            ghcr.io/${{ github.repository_owner }}/honeyai-worker@${{ needs.build.outputs.worker-digest }} \
            ghcr.io/${{ github.repository_owner }}/honeyai-sandbox@${{ needs.build.outputs.sandbox-digest }}
      - name: kubectl apply
        run: |
          kubectl apply -k infra/k8s/overlays/prod
          kubectl -n honeyai rollout status deploy/web --timeout=300s
          kubectl -n honeyai rollout status deploy/worker --timeout=300s

      - name: Rollback on failure
        if: failure()
        run: |
          kubectl -n honeyai rollout undo deploy/web
          kubectl -n honeyai rollout undo deploy/worker
```

## 13. Kustomize base 关键 manifest

### 13.1 CNPG Cluster
```yaml
# infra/k8s/base/postgres-cluster.yaml
apiVersion: postgresql.cnpg.io/v1
kind: Cluster
metadata: { name: honeyai-pg, namespace: honeyai }
spec:
  instances: 1
  imageName: ghcr.io/cloudnative-pg/postgresql:16.4
  storage: { size: 50Gi, storageClass: local-path }
  resources:
    requests: { cpu: "1", memory: 2Gi }
    limits:   { cpu: "1", memory: 2Gi }
  backup:
    barmanObjectStore:
      destinationPath: s3://${OSS_BUCKET}/pg-backup
      endpointURL: ${OSS_ENDPOINT}
      s3Credentials:
        accessKeyId:     { name: honeyai-secrets, key: oss_access_key }
        secretAccessKey: { name: honeyai-secrets, key: oss_secret_key }
      wal: { compression: gzip, maxParallel: 4 }
    retentionPolicy: "30d"
```

### 13.2 Ingress + TLS
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: honeyai
  namespace: honeyai
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  ingressClassName: traefik
  rules:
    - host: ${HONEYAI_DOMAIN}
      http:
        paths:
          - path: /
            pathType: Prefix
            backend: { service: { name: web, port: { number: 3000 } } }
  tls:
    - hosts: [ ${HONEYAI_DOMAIN} ]
      secretName: honeyai-tls
```

### 13.3 web Deployment
```yaml
apiVersion: apps/v1
kind: Deployment
metadata: { name: web, namespace: honeyai }
spec:
  replicas: 2
  selector: { matchLabels: { app: web } }
  template:
    metadata: { labels: { app: web } }
    spec:
      containers:
        - name: web
          image: ghcr.io/<org>/honeyai-web:placeholder  # 由 kustomize 覆盖为 digest
          ports: [ { containerPort: 3000 } ]
          envFrom: [ { secretRef: { name: honeyai-secrets } } ]
          env:
            - name: DATABASE_URL
              valueFrom: { secretKeyRef: { name: honeyai-pg-app, key: uri } }
          resources:
            requests: { cpu: "500m", memory: 512Mi }
            limits:   { cpu: "1",    memory: 1Gi }
          readinessProbe: { httpGet: { path: /api/health, port: 3000 }, initialDelaySeconds: 10 }
          livenessProbe:  { httpGet: { path: /api/health, port: 3000 }, initialDelaySeconds: 30 }
```
