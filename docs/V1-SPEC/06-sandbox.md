# 06 — Sandbox

## 1. 镜像设计

### 1.1 单个综合镜像（V1.0）
- 基础：`debian:12-slim`
- 体积目标：~600MB
- 镜像 tag：`ghcr.io/<org>/honeyai-sandbox:v1.0.0`
- manifest 引用 digest

### 1.2 镜像内容
```
- git, openssh-client, gh CLI, jq, ripgrep, fd-find, fzf, tree, make, gcc
- Node.js 22 + pnpm
- Python 3.12 + uv
- Claude Code CLI (latest pinned at build time)
- /usr/local/lib/sandbox-runner (本仓库 packages/sandbox-runner build 产物)
- user 1000 (non-root)
- WORKDIR /workspace
- ENTRYPOINT ["/bin/bash"]
- CMD ["-c", "sleep infinity"]
```

### 1.3 Dockerfile.sandbox（占位）
> TODO: 填充阶段补全完整 Dockerfile

## 2. 拓扑模型（V1 反常规妥协 — 见 TD-001）

### 2.1 一个 Run 一个 Job
- Run 创建时 kubectl create Job → Pod
- Pod ENTRYPOINT `sleep infinity` → 长跑
- 节点串行执行：worker 每节点 kubectl exec 进 Pod → 跑 sandbox-runner CLI
- Run 结束 → kubectl delete Job → Pod 销毁

### 2.2 为什么不是 Job-per-Node
- 节点间需要共享 `/workspace`（已 clone 的 repo + 已生成的 IR 文件）
- Job-per-Node 需要 PVC 跨 Pod 共享，k3s local-path-provisioner 不支持 ReadWriteMany
- V2 改 Argo Workflows + S3 Artifact 解决（见 TD-001）

### 2.3 反常规带来的风险
- pod OOM/被驱逐 → Job controller 不重启节点级状态
- kubectl exec 流不在 k8s 事件模型内
- 节点边界状态丢失风险

### 2.4 V1 缓解措施
- 5 分钟 reconcile loop（见 05-orchestrator.md §6）
- Run 级超时 + 节点边界显式 checkpoint 到 PVC
- 节点完成立即把 artifact 写 OSS（不依赖 Pod 内 fs）

## 3. sandbox-runner CLI

### 3.1 职责
- 接受 worker 通过 kubectl exec 传入的参数（node_id, kind, IR paths）
- 在 Pod 内 spawn Claude Code CLI（带 --output-format stream-json）
- 解析 stream-json → 标准化 JSONL events
- 写入 `/workspace/.runs/<node-id>/events.jsonl`
- 节点结束把 events.jsonl + 产出 IR 推到 OSS

### 3.2 事件标准化
```jsonl
{"ts":"2026-05-23T10:00:00Z","kind":"thinking","content":"..."}
{"ts":"...","kind":"tool_call","tool":"Read","args":{...}}
{"ts":"...","kind":"tool_result","tool":"Read","output_len":1234}
{"ts":"...","kind":"text","content":"..."}
{"ts":"...","kind":"finish","reason":"end_turn"}
```

### 3.3 Grill 聊天
- 在 Gate 节点期间，用户可以触发 grill chat
- 命令：`claude --resume <session_id>` 接续前一节点的会话
- 用户输入通过 SSE+POST 投递到 worker → worker kubectl exec 写入 stdin
- LLM 输出通过 sandbox-runner → JSONL → SSE 推浏览器

## 4. 网络白名单（Cilium L7）

### 4.1 默认 deny all egress
sandbox Pod 默认不允许任何出网。

### 4.2 显式白名单 FQDN
- `api.anthropic.com` — LLM 调用
- `*.github.com` / `api.github.com` / `codeload.github.com` — git/PR
- `registry.npmjs.org` — npm 安装
- `pypi.org` / `*.pythonhosted.org` — pip/uv 安装
- `objects.githubusercontent.com` — gh CLI release

### 4.3 不在白名单的禁用
- 任意第三方 API
- 用户 repo 内可能配置的 outbound webhook 等

### 4.4 V1.1 计划
租户级自定义白名单扩展（admin 审批）

## 5. 凭据注入（3 层）

### 5.1 运行时 mount
- `ANTHROPIC_API_KEY` — k8s Secret → Pod env
- 仅在 Pod 生命周期内有效

### 5.2 GitHub token env
- 每节点开始前 worker 通过 kubectl exec 写入 env
- token 来自 `github_tokens` 表（解密）
- 节点结束清理

### 5.3 用户 secrets tmpfs
- 用户在 tenant 设置中存的 secrets（如自定义 API key）
- 挂到 `/run/secrets/` tmpfs
- Pod 销毁即蒸发

## 6. 资源限额

### 6.1 默认配额
- requests/limits CPU: 2C
- requests/limits memory: 2Gi
- ephemeral storage: 5Gi (/workspace)

### 6.2 用户可选档位（手动重试时）
- 2Gi / 4Gi / 8Gi 三档

### 6.3 超限处理
- OOM → Pod kill → reconcile 标 sandbox_oom
- ephemeral storage 满 → Pod evict → 标 sandbox_disk_full

## 7. 4 级超时

| 级别 | 超时 | 触发 |
|---|---|---|
| Run 级 | 4 小时 | 整 Run 终止 |
| Stage 级 | 1.5 小时 | 当前 Stage 终止 |
| Node 级 | 30 分钟 | 当前节点重试 |
| LLM 调用级 | 5 分钟 | 该次 LLM 调用失败，触发 llm_rate_limited 重试 |

## 8. 6 类失败处理（与 05-orchestrator §4 对应）
（详见 05-orchestrator.md §4）

## 9. 镜像分发
- k3s 节点启动时 `crictl pull` 预拉
- Pod `imagePullPolicy: IfNotPresent`
- 镜像升级流程：
  1. CI 构建新版本 → 推 ghcr
  2. 节点 cron 每日 `crictl pull` 最新
  3. 平台 admin 改全局 config → 新 Run 用新镜像
  4. 已存在的 Run 不受影响

## 10. 镜像漏洞扫描
- CI 阶段跑 trivy
- HIGH 以上阻断发布

## 11. 完整 Dockerfile.sandbox

```dockerfile
# infra/docker/Dockerfile.sandbox
FROM debian:12-slim AS base

ENV DEBIAN_FRONTEND=noninteractive \
    LANG=C.UTF-8 \
    LC_ALL=C.UTF-8 \
    NODE_VERSION=22.11.0 \
    PYTHON_VERSION=3.12 \
    PNPM_VERSION=9.12.3

# 1. 基础工具
RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates curl wget gnupg lsb-release \
        git openssh-client \
        jq ripgrep fd-find fzf tree \
        make gcc g++ pkg-config \
        sudo locales tini \
    && sed -i 's/# en_US.UTF-8/en_US.UTF-8/' /etc/locale.gen && locale-gen \
    && rm -rf /var/lib/apt/lists/*

# 2. GitHub CLI
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | \
        dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
    && chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
        | tee /etc/apt/sources.list.d/github-cli.list \
    && apt-get update && apt-get install -y gh \
    && rm -rf /var/lib/apt/lists/*

# 3. Node.js 22 + pnpm
RUN curl -fsSL https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz \
        | tar -xJ -C /usr/local --strip-components=1 \
    && npm install -g pnpm@${PNPM_VERSION} \
    && npm cache clean --force

# 4. Python 3.12 + uv
RUN apt-get update && apt-get install -y python3.12 python3.12-venv python3-pip \
    && rm -rf /var/lib/apt/lists/* \
    && curl -LsSf https://astral.sh/uv/install.sh | sh \
    && mv /root/.local/bin/uv /usr/local/bin/uv

# 5. Claude Code CLI
RUN npm install -g @anthropic-ai/claude-code

# 6. sandbox-runner（本仓库构建产物，通过 build context 拷入）
COPY ./packages/sandbox-runner/dist /usr/local/lib/sandbox-runner
RUN ln -s /usr/local/lib/sandbox-runner/bin/cli.js /usr/local/bin/sandbox-runner \
    && chmod +x /usr/local/bin/sandbox-runner

# 7. 非 root user
RUN groupadd -g 1000 sandbox && useradd -m -u 1000 -g 1000 -s /bin/bash sandbox \
    && echo "sandbox ALL=(ALL) NOPASSWD: /usr/bin/apt-get" >> /etc/sudoers.d/sandbox

USER 1000
WORKDIR /workspace
ENV PATH="/home/sandbox/.local/bin:${PATH}"

# 8. 入口
ENTRYPOINT ["/usr/bin/tini", "--", "/bin/bash"]
CMD ["-c", "sleep infinity"]
```

体积预估：debian-slim (~75MB) + Node (~150MB) + Python (~80MB) + Claude CLI (~50MB) + tools (~150MB) + sandbox-runner (~10MB) + buffer ≈ **600MB**

## 12. sandbox-runner CLI 接口

```bash
# 节点执行
sandbox-runner exec \
  --node-id <uuid> \
  --kind agent|merge|deploy \
  --stage 1|2|3 \
  --input /workspace/.runs/<node-id>/input.json \
  --output /workspace/.runs/<node-id>/output \
  --runtime claude_code

# Grill chat 续会话
sandbox-runner grill \
  --session-id <uuid> \
  --message-stdin

# 上传 artifact 到 OSS
sandbox-runner upload-artifact \
  --file /workspace/.runs/<node-id>/output/requirement.md \
  --kind requirement_ir \
  --node-id <uuid>

# 健康检查
sandbox-runner health
```

### 12.1 输出格式（标准化 JSONL）

```jsonl
{"ts":"2026-05-23T10:00:00.123Z","kind":"started","nodeId":"...","runtime":"claude_code","model":"claude-sonnet-4-6"}
{"ts":"2026-05-23T10:00:01.234Z","kind":"thinking","content":"我需要先读 README"}
{"ts":"2026-05-23T10:00:02.345Z","kind":"tool_call","tool":"Read","args":{"file_path":"README.md"}}
{"ts":"2026-05-23T10:00:02.567Z","kind":"tool_result","tool":"Read","output_len":4523}
{"ts":"2026-05-23T10:00:05.678Z","kind":"text","content":"基于 README 我提取出..."}
{"ts":"2026-05-23T10:00:08.789Z","kind":"usage","inputTokens":3421,"outputTokens":892,"cacheReadTokens":0}
{"ts":"2026-05-23T10:00:09.890Z","kind":"artifact","path":"/workspace/.runs/<id>/requirement.md","artifactKind":"requirement_ir","sha256":"..."}
{"ts":"2026-05-23T10:00:10.000Z","kind":"finished","reason":"end_turn","durationMs":9877}
```

worker 通过 kubectl exec 流式读 stdout，逐行解析 → INSERT events + pg_notify。

## 13. Cilium NetworkPolicy 完整 YAML

```yaml
# infra/k8s/base/network-policy-sandbox.yaml
apiVersion: cilium.io/v2
kind: CiliumNetworkPolicy
metadata:
  name: sandbox-egress
  namespace: honeyai
spec:
  endpointSelector:
    matchLabels:
      app: honeyai-sandbox
  egress:
    # DNS（必须）
    - toEndpoints:
        - matchLabels:
            k8s:io.kubernetes.pod.namespace: kube-system
            k8s:k8s-app: kube-dns
      toPorts:
        - ports:
            - port: "53"
              protocol: UDP
          rules:
            dns:
              - matchPattern: "*"
    # Anthropic
    - toFQDNs:
        - matchName: api.anthropic.com
      toPorts:
        - ports: [{ port: "443", protocol: TCP }]
    # GitHub
    - toFQDNs:
        - matchName: api.github.com
        - matchName: github.com
        - matchPattern: "*.github.com"
        - matchName: codeload.github.com
        - matchName: objects.githubusercontent.com
      toPorts:
        - ports: [{ port: "443", protocol: TCP }]
    # npm
    - toFQDNs:
        - matchName: registry.npmjs.org
      toPorts:
        - ports: [{ port: "443", protocol: TCP }]
    # PyPI
    - toFQDNs:
        - matchName: pypi.org
        - matchPattern: "*.pythonhosted.org"
      toPorts:
        - ports: [{ port: "443", protocol: TCP }]
    # 内部：OSS（私有 endpoint）
    - toFQDNs:
        - matchPattern: "*.oss-cn-*.aliyuncs.com"
      toPorts:
        - ports: [{ port: "443", protocol: TCP }]
```

> ⚠️ 任何不在白名单的 FQDN 会被 Cilium drop，sandbox-runner 会捕获 connection refused 并归类 `external_failed`。

## 14. Sandbox Pod 模板

```yaml
# 由 orchestrator 动态生成提交
apiVersion: batch/v1
kind: Job
metadata:
  name: sandbox-<run-id>
  namespace: honeyai
  labels:
    app: honeyai-sandbox
    run-id: <run-id>
    tenant-id: <tenant-id>
spec:
  backoffLimit: 0  # 不让 k8s 自动重试，由 orchestrator 控制
  ttlSecondsAfterFinished: 3600
  template:
    metadata:
      labels:
        app: honeyai-sandbox
        run-id: <run-id>
        tenant-id: <tenant-id>
    spec:
      restartPolicy: Never
      automountServiceAccountToken: false
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        fsGroup: 1000
        seccompProfile: { type: RuntimeDefault }
      containers:
        - name: sandbox
          image: ghcr.io/<org>/honeyai-sandbox@sha256:<digest>
          imagePullPolicy: IfNotPresent
          command: ["/usr/bin/tini", "--", "/bin/bash", "-c", "sleep infinity"]
          env:
            - name: ANTHROPIC_API_KEY
              valueFrom: { secretKeyRef: { name: honeyai-secrets, key: anthropic_api_key } }
            - name: RUN_ID
              value: "<run-id>"
            - name: TRACE_ID
              value: "<trace-id>"
          resources:
            requests: { cpu: "2", memory: "2Gi", ephemeral-storage: "5Gi" }
            limits:   { cpu: "2", memory: "2Gi", ephemeral-storage: "5Gi" }
          volumeMounts:
            - { name: workspace, mountPath: /workspace }
            - { name: secrets-tmpfs, mountPath: /run/secrets }
          securityContext:
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: false  # apt/npm/pip 需要写
            capabilities: { drop: ["ALL"] }
      volumes:
        - name: workspace
          emptyDir: { sizeLimit: 5Gi }
        - name: secrets-tmpfs
          emptyDir: { medium: Memory, sizeLimit: 16Mi }
```

## 15. 失败分类代码
```ts
// packages/orchestrator/src/sandbox.ts
export function classifyPodFailure(pod: V1Pod): FailureClass {
  const reason = pod.status?.containerStatuses?.[0]?.state?.terminated?.reason
  switch (reason) {
    case 'OOMKilled':     return 'sandbox_oom'
    case 'Error':         return 'sandbox_died'
    case 'DeadlineExceeded': return 'sandbox_timeout'
    default:
      if (pod.status?.reason === 'Evicted' && pod.status?.message?.includes('ephemeral-storage')) {
        return 'sandbox_disk_full'
      }
      return 'sandbox_died'
  }
}
```
