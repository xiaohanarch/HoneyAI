# 10 — Tech Debt Register

> V1 因 MVP 简单优先做的妥协全部记录在此。每条都有 V1 缓解 + V2 修复方向 + 触发信号。

## 模板

```
### TD-XXX: <一句话标题>
  V1 选择: <怎么做的>
  反常规点 / 妥协: <为什么 hack>
  V1 风险缓解: <怎么不出大事>
  V2 修复方向: <长远怎么修>
  触发 V2 的信号: <什么时候必须修>
```

---

### TD-001: Sandbox 拓扑使用 kubectl exec 长跑 pod 模式
- **V1 选择**：一个 Run 一个 Job，Pod `sleep infinity` + worker 多次 kubectl exec 串行节点
- **反常规点**：Pod 不是无状态短任务，违背 k8s Job 语义；exec 流不在 k8s 事件模型内；OOM/被驱逐时 Job controller 不重启节点级状态
- **V1 缓解**：5 分钟 reconcile loop + Run 级超时 + 节点边界显式 checkpoint 到 OSS
- **V2 修复方向**：Argo Workflows 或自研 Job-per-Node 事件驱动编排（PVC 用 OSS S3 artifact 共享）
- **触发信号**：(a) 并发 Run > 20 (b) 单 Run 节点数 > 10 (c) 出现 3 次以上 "pod 还活着但节点状态丢失" 事故

---

### TD-002: 多租户访问控制仅靠应用层 middleware
- **V1 选择**：所有 DB 查询通过 `withTenant(db)` 包装强制注入 tenant_id WHERE
- **反常规点**：缺第二道防线，开发者漏调 withTenant 就跨租户泄露
- **V1 缓解**：所有 repo 函数签名强制 tenantId 参数 + 端到端测试 fixture 验证跨租户阻断
- **V2 修复方向**：开启 Postgres RLS，按 session.tenant_id 强制行级过滤
- **触发信号**：(a) 任意一次跨租户泄露事故 (b) 用户数 > 50

---

### TD-003: Grafana 内嵌仅 3 张固定面板，无自定义
- **V1 选择**：硬编码 3 张面板（QPS / 延迟 / 错误率），admin only 可见
- **反常规点**：用户运维需要时无法自助创建面板
- **V1 缓解**：日志查 Loki + 指标查 VictoriaMetrics 原始数据可对外开放只读
- **V2 修复方向**：Grafana viewer 角色对接 tenant，按租户隔离 dashboard
- **触发信号**：用户多次要求自定义指标视图

---

### TD-004: 单节点 ECS 无 HA
- **V1 选择**：k3s 单节点，所有服务跑一台 ECS
- **反常规点**：ECS 宕机即不可用
- **V1 缓解**：CNPG 每日备份 OSS，RTO 估 30 分钟；监控磁盘/CPU
- **V2 修复方向**：加备用节点 + k3s HA 模式（外部 etcd）+ CNPG 主备
- **触发信号**：(a) 任意一次因 ECS 故障的不可用 (b) 用户数 > 30

---

### TD-005: 无审批流的 Gate 通过
- **V1 选择**：tenant 内任何 member 都能点 [通过 Gate]
- **反常规点**：缺少多角色审批（如 senior dev 审批 architect IR）
- **V1 缓解**：audit_log 记录通过人 + 时间
- **V2 修复方向**：可配置 Gate 审批策略（人数 / 角色 / 必须不同人）
- **触发信号**：用户要求"四眼审批"

---

### TD-006: Secret 手动 echo 注入
- **V1 选择**：kubectl create secret 手动 echo + ECS 本地 chmod 600 备份
- **反常规点**：无中心化 Secret 管理，无审计
- **V1 缓解**：Secret 列表在 spec 文档明确 + bootstrap 脚本检查必填项
- **V2 修复方向**：Aliyun KMS / Vault + external-secrets operator
- **触发信号**：(a) 多于 3 个 tenant 各自管理 secret (b) 任意 secret 泄露

---

### TD-007: 无分布式 tracing
- **V1 选择**：仅日志带 trace_id，靠 LogQL 串
- **反常规点**：跨服务调用链不可视化
- **V1 缓解**：所有日志强制带 trace_id + service 标签
- **V2 修复方向**：OpenTelemetry SDK + Tempo + Grafana trace view
- **触发信号**：定位跨服务问题耗时 > 30 分钟成为常态

---

### TD-008: 无告警规则
- **V1 选择**：只看 Grafana 面板，无 Alertmanager
- **反常规点**：被动发现故障
- **V1 缓解**：每日 admin 巡检 dashboard
- **V2 修复方向**：Alertmanager + 钉钉 webhook + 分级告警
- **触发信号**：首次因未告警导致故障

---

### TD-009: opencode adapter 代码存在但 build-time 锁定 Claude Code
- **V1 选择**：build-time 选择 runtime，默认 Claude Code，opencode 不上线
- **反常规点**：写了代码不上线浪费
- **V1 缓解**：CI 仍构建 + 单测 adapter-opencode，避免代码烂掉
- **V2 修复方向**：admin 控制台可切换 + Run 级覆盖
- **触发信号**：(a) 用户明确要求 opencode (b) Anthropic 出现长时间故障，需要降级

---

### TD-010: 无 Run replay / Run 间 diff / 跨 Run 模板
- **V1 选择**：失败强制从头开
- **反常规点**：失败一次浪费一次 token
- **V1 缓解**：失败节点 artifact 保留，用户可手工拷贝 IR 文本复用
- **V2 修复方向**：fork Run（从指定节点继承 artifact 开新 Run）+ Run 模板
- **触发信号**：用户多次抱怨重复输入

---

### TD-011: 无 Issue / Review 双向同步
- **V1 选择**：只创建 PR，不同步 GitHub Issue 评论 / PR Review
- **反常规点**：GitHub 上的反馈无法回到 HoneyAI 触发新 Run
- **V1 缓解**：PR 创建后留 GitHub 链接，用户在 GitHub 看评论
- **V2 修复方向**：webhook 接收 issue_comment / pull_request_review → 自动创建 follow-up Run
- **触发信号**：用户要求 "PR review 评论自动转 follow-up"

---

### TD-012: zh-CN only / 浅色 only
- **V1 选择**：只做中文 + 浅色
- **反常规点**：i18n 基础设施未铺
- **V1 缓解**：strings 集中 `lib/strings/zh.ts`；色变量浅深两套写好不暴露切换
- **V2 修复方向**：next-intl + 主题切换
- **触发信号**：海外用户需求

---

### TD-013: 单 sandbox 镜像（无 GPU / 无自定义）
- **V1 选择**：一个 600MB 综合镜像
- **反常规点**：用户无法选自己的依赖环境
- **V1 缓解**：镜像内预装常见工具 + sandbox 内 npm/pip 可临时装
- **V2 修复方向**：租户级镜像覆盖 + GPU 节点池
- **触发信号**：(a) 用户跑 ML 项目 (b) 用户要求 Rust/Go 等非内置语言

---

### TD-014: 无预算告警 / 异常检测
- **V1 选择**：80%/100% 硬性阈值，banner 提示 + 拒绝新 Run
- **反常规点**：被动触发，无趋势预警
- **V1 缓解**：成本面板可查
- **V2 修复方向**：基线异常检测 + 多档预警 + 钉钉
- **触发信号**：首次因预算意外耗尽事故

---

### TD-015: 失败时无通知
- **V1 选择**：只 UI 红点 + tab 标题
- **反常规点**：用户离开浏览器就不知道失败
- **V1 缓解**：tab 标题 "(1) HoneyAI" 长存
- **V2 修复方向**：GitHub commit comment / 邮件 / 钉钉
- **触发信号**：用户抱怨 "Run 挂了我不知道"

---

## 升级触发汇总表

| 触发条件 | 触发的 TD 修复 |
|---|---|
| 并发 Run > 20 | TD-001 |
| 用户数 > 30 | TD-004 |
| 用户数 > 50 | TD-002 |
| 海外用户 | TD-012 |
| ML / 非内置语言项目 | TD-013 |
| 任何泄露/丢数据事故 | TD-002, TD-004, TD-006 |
| 多次重复用户反馈 | TD-003, TD-005, TD-010, TD-011, TD-015 |
