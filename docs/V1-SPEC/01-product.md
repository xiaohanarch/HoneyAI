# 01 — Product

## 1. 目标用户

### 1.1 V1 主要用户画像
- 5-10 人的研发团队
- 已使用 GitHub 管理代码
- 团队 lead 愿意接受"AI 写代码、人在 Gate 把关"的协作模式
- 单一团队即单一 tenant

### 1.2 非目标用户（V1 不服务）
- 完全无开发经验的产品/运营
- 大型企业（>50 人）—— 需要 SSO/MFA/审计，V1 不支持
- 多 Region 部署需求

## 2. V1 范围（Tier B）

### 2.1 V1.0 包含
- 多租户（URL slug + 切换 UI + 邀请）
- GitHub 集成（多 repo 绑定 + PR 创建 + 状态回写）
- 3 阶段流水线（Stage1/2/3）+ IR 编辑器 + 节点级重试
- Grill 聊天（Stage 0 需求 intake + 每个 Gate 节点）
- Assets 管理（skill/rule/command/script/hook/hint/template/context 8 类 CRUD + 启用/禁用 + GitHub 导入两种 sync 模式）
- Runs 历史 + 详情 + 日志 + artifact 下载
- 成本面板（Run 级 + 租户月度）
- Observability（Loki 日志入口 + 3 张基础 Grafana 图）
- Sandbox（kubectl exec 长跑 pod + FQDN 白名单 + 资源限额）
- Auth（GitHub OAuth + DB Session + owner/member RBAC）
- zh-CN + 浅色
- Runtime build-time 锁定 Claude Code

### 2.2 V1.0 显式不含（见 10-tech-debt.md 对应条目）
- Issue 双向同步 / Review 评论同步
- Run replay / Run 间 diff / 跨 Run 模板
- 市场 / 分享 / 版本 diff UI
- 预算告警 / 异常检测 / 按用户成本拆分
- 自定义 Grafana dashboard / 告警规则
- GPU 节点 / 自定义 sandbox 镜像
- SSO / MFA / 细粒度权限
- 英文 / 深色
- opencode Runtime
- 移动端

## 3. Bootstrap UX（首次使用流）

### 3.1 Step 列表
- Step 1 — GitHub OAuth 登录
- Step 2 — 自动创建 personal tenant（用 GitHub login 作 slug）
- Step 3 — Welcome 页 4 张卡片必须依次完成
  1. 安装 GitHub App
  2. 选择 1 个默认 repo
  3. 选择 Runtime（锁定 Claude Code）
  4. 配置 Skills（3 种方式：导入官方默认 / 从 GitHub repo 导入 / 跳过稍后）
- Step 4 — 跳 /t/<slug>/runs，空状态显示大按钮
- Step 5 — 新建 Run 弹窗（标题 + 一句话需求 + repo + 分支）
- Step 6 — Run 详情页时间轴 + 当前节点视图
- Step 7 — Gate 编辑 → 通过 → 下一阶段 → PR

### 3.2 关键决策（详见 ADR-006）
- a. personal tenant 自动创建，不让用户起名
- b. GitHub App 必装
- c. 默认 Assets 种子（5-10 个官方默认，可禁用不可删）
- d. 示例需求引导
- e. Stage1 自动启动
- f. Gate 强制查看不强制改
- g. Stage3 失败 → Run failed，提供节点级重试
- h. PR 创建后顶部 banner 不自动跳转

## 4. 失败 UX

### 4.1 6 类失败 → 用户文案 → 用户操作
- `llm_rate_limited` — 自动指数退避重试 3 次（5s/30s/120s）
- `llm_quality_failed` — 自动 schema 反馈重试 3 次 → 手动修复
- `sandbox_timeout` — 不自动，手动节点重试 / 拆分需求
- `sandbox_oom` — 不自动，手动重试 + 资源升档（2Gi/4Gi/8Gi）
- `external_failed` — 自动 1 次 + 手动重试，PR 冲突文案提示
- `user_cancelled` — 无操作

### 4.2 Run 详情页失败态布局
- 顶部按钮：[从失败节点重试] [终止 Run]
- 左侧时间轴（失败节点红色 + 状态图标）
- 右侧失败详情（类型/重试次数/原因 + [完整日志] [LLM raw 输出] + 建议操作）

### 4.3 关键规则（详见 ADR-007）
- Run 状态二元（成功/失败），不支持部分失败继续
- 失败节点 artifact 保留（status=failed），用于 debug + eval 集
- 失败计入 cost_events
- LLM raw 输出默认折叠 + 脱敏警告
- V1 不发通知（V1.1 加 GitHub commit comment）

## 5. 产品哲学红线（V1 不可妥协）

1. **人在回路**：Gate 必须有人查看才能通过，不允许全自动跳过 Gate
2. **失败可追溯**：所有失败保留 artifact + raw 日志
3. **成本可见**：每个 Run 必须显示已花成本
4. **数据可导出**：tenant 数据必须支持 `/api/export` 全量拉取
5. **租户隔离**：跨 tenant 数据访问必须 middleware 强制阻断

## 6. 用户画像深入

### 6.1 主用户：团队 Tech Lead "李工"
- 5 年后端经验，团队 6 人
- 已经在用 Claude Code 个人提效，想拉团队一起用
- 痛点：团队成员能力参差，新功能需求散乱进 GitHub Issue 后变成"我自己写最快"
- 期望：让中级工程师在 HoneyAI 里把需求过一遍 Gate 后得到一个 80% 完成度的 PR，自己只需 review + 微调
- 不期望：自己被 AI 取代；让所有决策都自动化

### 6.2 副用户：团队成员"小王"
- 2 年经验，中级工程师
- 痛点：拿到 Issue 后理解需求要反复确认，方案设计常被 review 打回
- 期望：先在 HoneyAI 里把 RequirementIR + DesignIR 跑出来给 Lead 看，再决定要不要写代码
- 不期望：被 AI 完全代笔失去成长机会

### 6.3 反面用户（V1 不服务）
- 完全无开发经验的 PM / 运营 —— 看不懂 DesignIR
- 大型企业 SecOps —— V1 无 SSO/MFA/审计完整性
- 跨国分布团队 —— V1 zh-CN only

## 7. 三个 V1 黄金路径（Demo Scenarios）

### 7.1 黄金路径 A — "加一个 /health 端点"（XS 复杂度）
```
[小王] 登录 → personal tenant → 完成 Welcome 4 步（选默认 repo: my-go-api）
[小王] /runs/new → 标题 "加 health 端点" → 需求 "给 /health 加一个返回 db/redis 状态的 endpoint"
[小王] 点 [创建 Run]
[系统] Stage1.enrich 输出 RequirementIR（约 30 秒）
[小王] 查看 → 加一句 "返回格式参考 k8s liveness probe" → 通过 Gate
[系统] Stage2.design 输出 DesignIR + task_graph（4 个节点）（约 1 分钟）
[小王] 查看 → 通过 Gate
[系统] Stage3.implement 跑 4 个节点（约 3 分钟）→ Stage3.quality 跑 lint/test → Stage3.pr 创建 PR
[小王] 看到顶部 banner "PR #42 已创建"
[李工] GitHub 上看 PR，merge 或评论改
```
预期成本：~$0.15 / 总时长 ~5 分钟 / token 用量 ~30K

### 7.2 黄金路径 B — "添加用户注销 API + 测试"（M 复杂度）
跑通 Stage1/2/3 但 Stage3 第一次因 `llm_quality_failed` 失败，自动重试一次成功。验证失败 UX。

### 7.3 黄金路径 C — "重构认证中间件"（L 复杂度）
跑通 Stage1，Stage2 失败（task_graph 太大被 schema 校验拒），用户手动修复后通过。验证手动修复 UX + 大需求拆分能力。

## 8. 成功指标

### 8.1 V1 试用阶段（前 30 天）
- 至少 3 个团队（>10 人）跑通至少 5 个 Run / 周
- 黄金路径 A 成功率 > 80%
- 黄金路径 A 端到端中位时长 < 8 分钟
- 单 Run 平均成本 < $0.50

### 8.2 用户满意度
- "AI 产出 PR 我能直接 review"  > 60% 同意
- "省了我的时间"  > 70% 同意
- "我会继续用"  > 50% 同意

### 8.3 系统健康
- /api 5xx 错误率 < 0.5%
- Run 失败率 < 30%（含人为取消）
- 跨租户数据泄露 = 0
- 月度成本超预算事故 = 0

## 9. 关键页面线框

### 9.1 Welcome 页（首次登录）
```
┌─────────────────────────────────────────┐
│  欢迎使用 HoneyAI  你好 @username       │
│                                         │
│  完成 4 步开始使用：                     │
│  ┌──────────┬──────────┬──────────┬───┐│
│  │ ① 安装   │ ② 选 repo│ ③ Runtime│④Skills│
│  │ GitHub   │ my-repo  │ ✅Claude │ 选择 ││
│  │ App      │   ▼      │ Code     │ ▼   ││
│  └──────────┴──────────┴──────────┴───┘│
│              [开始使用]                  │
└─────────────────────────────────────────┘
```

### 9.2 Run 详情页
```
┌─────────────────────────────────────────────────────┐
│ ← Runs   Run #abc12  Running   $0.034 / 30K tokens  │
│                              [终止] [从失败节点重试]│
├──────────────────┬──────────────────────────────────┤
│ 时间轴            │ 当前节点：stage2.gate            │
│                  │                                  │
│ ✅ stage1.enrich │ 类型：Gate（人在回路）           │
│ ✅ stage1.gate   │ 上游 IR：DesignIR v2             │
│ ✅ stage2.design │                                  │
│ ✅ stage2.merge  │ ┌──────────────────────────────┐│
│ 🟡 stage2.gate ← │ │ Tiptap Frontmatter 表单      ││
│ ⏳ stage3.impl   │ │ approach_summary: ...        ││
│ ⏳ stage3.qual   │ │ task_graph: 4 nodes          ││
│ ⏳ stage3.pr     │ ├──────────────────────────────┤│
│                  │ │ Markdown 富文本（正文）       ││
│                  │ │ ...                          ││
│                  │ └──────────────────────────────┘│
│                  │  [保存草稿]  [通过 Gate ✓]       │
└──────────────────┴──────────────────────────────────┘
```

### 9.3 失败态
```
┌─────────────────────────────────────────────────────┐
│ Run #abc12  ❌ Failed   $0.082 已花                 │
│                       [从失败节点重试] [终止]       │
├──────────────────┬──────────────────────────────────┤
│ ✅ stage1.enrich │ ❌ stage2.design                 │
│ ✅ stage1.gate   │ 类型：llm_quality_failed         │
│ ❌ stage2.design │ 重试：3/3                        │
│ ─                │ 原因：DesignIR.task_graph        │
│ ─                │       缺少 root 节点              │
│                  │ ────                              │
│                  │ 建议：                            │
│                  │ · 点 [手动修复] 用编辑器补全     │
│                  │ · 或 [从此节点重试] 让 AI 再试   │
│                  │ ────                              │
│                  │ [完整日志] [LLM raw 输出 ⚠️ 折叠] │
└──────────────────┴──────────────────────────────────┘
```

### 9.4 Asset 列表
```
┌─────────────────────────────────────────────────────┐
│ Assets        [+ 新建]  [📥 从 GitHub 导入]         │
├──┬──────────────────────────────────────────────────┤
│ S│ Name              Source     Enabled  Updated   │
│ k├──────────────────────────────────────────────────┤
│ i│ tdd-workflow      official   ✅       2d ago    │
│ l│ frontend-design   mirror     ✅       1h ago    │
│ l│ my-custom-skill   manual     ✅       just now  │
│ s│ legacy-tool       manual     ❌       1w ago    │
│ R│                                                  │
│ u│                                                  │
│ l│                                                  │
│ e│                                                  │
│ s│                                                  │
│ ...                                                 │
└──┴──────────────────────────────────────────────────┘
```

## 10. 验收清单（V1.0 种子）

> 全量验收清单写入流程见 [00-README.md §验收清单约定](./00-README.md#验收清单约定acceptance-criteria)。本节为种子 3 条，必须 100% 通过才能 V1.0 release。余下条目随实现 PR 渐进补足。

- [ ] **AC-01-01** `[Happy]`：黄金路径 A（/health 端点增强，XS 复杂度）→ 中位完成时长 ≤ 8 分钟、成本 ≤ $0.50、PR 状态 = open 且 CI 绿
- [ ] **AC-01-02** `[Happy]`：黄金路径 B（logout 按钮，M 复杂度）→ 实现 PR 包含 ≥ 2 个文件改动且单测覆盖 ≥ 80%
- [ ] **AC-01-03** `[Failure]` `[Manual]`：Bootstrap 4 步任一步未完成 → 访问 `/t/<slug>/runs` 被 redirect 回 `/welcome`，已填字段断点续传保留
