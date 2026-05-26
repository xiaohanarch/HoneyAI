# Phase 2.4.3 Open Questions — 切片 4.3:Welcome 4 步引导

> **来源**:Phase 2.4.2 merge 后(PR #11)切入切片 4.3 grill-me 阶段(2026-05-26)
> **当前状态**:**全部 12 项已拍板**(2026-05-26 用户逐一确认 + 全组合接受)
> **门禁**:✅ 已解除 —— 切片 4.3 可进入 Superpowers writing-plans 阶段
> **后续变更**:任意已拍板项变更必须新建 ADR-0XX(自 ADR-049 起递增)

## 状态总览

### 切片 4.3 留白(已拍板)

| # | 主题 | 拍板 | 关联 ADR |
|---|---|---|---|
| Q1 | 4 步具体内容(spec 三处不一致) | **A — Anthropic Key / GitHub App / GitHub repo / Skills 种子**;预算章节推迟 | ADR-032、ADR-033 |
| Q2 | 持久化模型 vs URL 驱动 | **混合 — URL `/welcome/step/[n]` + `tenants.settings.bootstrap` jsonb** | ADR-032 |
| Q3 | Claude API key 加密策略 | **X5 — stub 接口 `packages/core/src/crypto/anthropic-key.ts`,base64 占位,slice 2 替换 AEAD** | ADR-034 |
| Q4 | Server Action 形态 | **P2 + A + R1 + T2 — 每步独立 module + 本地 zod + redirect/ErrorCode + `useActionState`** | ADR-035 |
| Q5 | AC 测试矩阵 | **γ + 9 ACs(AC-01-04..-12)+ I3 mock-primary + T-C dev-credentials fixture + G3 ac:coverage 跟踪不门禁** | ADR-036 |
| Q6 | Skills 种子内容 | **S-B per-tenant copy + C2 5 seeds + M-B 导入/跳过 + E-A metadata 标记 + A4 TS literals + W-B Step 4 action 写入** | ADR-037、ADR-038 |
| Q7 | Bootstrap guard 缓存与 RSC fetch 边界 | **L2 layout-level + D1 React `cache()` + R1 `revalidatePath` 防御 + TS-C session/URL 双源 + B1 接受 N+1 + F1 welcome layout 反向 guard** | ADR-039、ADR-040 |
| Q8 | 错误边界 + 失败 UX | **U4 字段内联 + 顶部 banner + E3 三层 error.tsx + X3 业务返回/系统抛 + T3 事务+幂等 gate + TL4 4.3 不引 toast + Z1 zh.ts 单文件扩展** | ADR-041、ADR-042 |
| Q9 | Route group 冲突 + step URL + slug 解析 | **P1 `/welcome/step/[n]` + I4 双向 redirect + S1 扩展 `getTenantBootstrap` + G1 welcome group + V3 slug mismatch redirect + LD1 不引 loading.tsx + AC-01-12** | ADR-043 |
| Q10 | 进度指示器 + 视觉/交互一致性 | **A1 多路由 + spec 07 §8.4 patch + PI3 4 张并列 Card 三态 + M3 step1-3 可编辑/step4 锁 + BB1 默认浏览器 back + AN2 状态图标 CSS 微动效 + R4 Tailwind 工具类无 mobile 测试矩阵** | ADR-044、ADR-045 |
| Q11 | 4 步表单字段细节 + 未来切片边界 | **K3 Anthropic key regex + GA2 install URL + checkbox + RP1 owner/name 单字段 regex + WR1 jsonb `pendingRepoOwnerName` + SK2 enum `'skipped' \| 'imported'` + SP1 仅 step 4 可跳过** | ADR-046、ADR-047 |
| Q12 | dev-seed personal tenant 时机 + JWT 集成 | **L2 `instrumentation.ts` + U1 硬编码 uuid v7 + JT3 `authorize` 返回 tenantId + ID3 `onConflictDoNothing` 事务 + TS1 template db 一次性 seed + PG3 双重 guard + ESLint ban + slice 4.5 ADR 弃用** | ADR-048 |

### 新增产物清单(实施 PR 必须同 PR 入档)

- **17 个新 ADR**:ADR-032 至 ADR-048(每个 `Accepted` 状态,引用本文档对应 Q 章节)
- **9 个新 AC**:AC-01-04 至 AC-01-12(详见 Q5)
- **Spec patches**(同 PR review):
  - `docs/V1-SPEC/ADRs/ADR-006-bootstrap-ux.md` §4 步内容
  - `docs/V1-SPEC/01-product.md` §3.1 Step 3 卡片清单
  - `docs/V1-SPEC/decisions/phase-2-4-open-questions.md` §4.3 范围
  - `docs/V1-SPEC/07-frontend.md` §8.4 Welcome 进度区 + 表单结构
  - `docs/V1-SPEC/CHANGELOG.md` 加 v0.2.x 条目

---

## Q1. 4 步具体内容(spec 三处不一致)

**背景**:三处定义冲突
- ADR-006:Anthropic Key / GitHub Repo / 预算 / Skills
- spec 01 §3.1:GitHub App / 默认 repo / Runtime / Skills
- phase-2-4 §4.3:tenant 创建 / GitHub repo / Claude API key / 启动确认

候选:
- A — Anthropic Key / GitHub App / GitHub repo / Skills 种子(本切片实施 + 推迟预算到 slice 5)
- B — 按 ADR-006 原样实现(包含预算)
- C — 按 spec 01 §3.1(含 Runtime 但缺 Anthropic key)

**拍板**:**A**(2026-05-26)
**理由**:Anthropic key 是 Run 跑起来的硬依赖(Claude Code CLI 必填);预算是 V1.0 功能(spec 06 §billing 推迟);GitHub App + repo 必须二分,因为 App 安装是租户级一次性、repo 选择是 Run-time 资源关联;Skills 种子最小可达"开箱可用"标准。
**风险**:预算字段在 `tenants.settings.budget` 留 jsonb 空位(slice 5 填),不影响 Phase 2 schema。
**ADR**:ADR-032(4 步定义统一)、ADR-033(预算章节推迟至 slice 5)

---

## Q2. 持久化模型 vs URL 驱动 vs AC-01-03 断点续传

**背景**:AC-01-03 要求"已填字段断点续传保留";phase-2-4 §4.3 描述"URL 参数驱动";二者潜在矛盾。

候选:
- A — 纯 URL query(`?step=2&key=...`)—— 刷新即丢失敏感数据
- B — 纯 db `tenants.settings.bootstrap` jsonb
- **C — 混合**:URL `/welcome/step/[n]` 驱动 step 切换 + jsonb 持久化已填字段
- D — sessionStorage(SSR 不友好)

**拍板**:**C — 混合**(2026-05-26)
**理由**:URL segment(非 query)是 step 唯一来源,符合 Next.js App Router segment + dynamic param 习惯;jsonb 保留服务端真源,刷新可恢复;两者分工清晰。
**风险**:jsonb migration 需在 slice 4.3 同 PR 加列(`tenants.settings.bootstrap`)。
**ADR**:ADR-032 同步包含

---

## Q3. Claude API key 加密策略

**背景**:spec 02 §security 标 AEAD 加密为切片 2(`packages/secrets`)范围,但切片 4.3 必须落库;不能等切片 2 解锁。

候选:
- X1 — 明文存储(违反 spec)
- X2 — 直接接入 KMS(切片 2 才有)
- X3 — bcrypt(单向哈希,不能解密供 sandbox 用)
- X4 — base64 仅编码(无加密语义)
- **X5 — stub 接口**:`packages/core/src/crypto/anthropic-key.ts` 暴露 `encryptAnthropicKey(plain): string` / `decryptAnthropicKey(cipher): string`,Phase 2.4.3 实现为 base64,Phase 2.2(切片 2)替换 AEAD,调用方零感知

**拍板**:**X5**(2026-05-26)
**理由**:接口契约前置,实施延后;切片 2 替换时只改 core/crypto 内部,业务包不需要改;且 `_ciphertext` 字段命名预留语义。
**风险**:base64 占位期间(切片 4.3 → 切片 2)需在 README + zh.ts error 标注 "dev 模式存储不加密";slice 2 替换后必须有 ADR + migration 重新加密历史数据。
**ADR**:ADR-034(crypto stub + slice 2 替换路径)

---

## Q4. Server Action 形态

**背景**:4 个独立 step,4 个独立 Server Action,如何组织模块、zod schema 位置、成功/失败返回类型、客户端绑定。

候选(分四子项):
- **P2 — 独立 action 模块**:`lib/actions/welcome/step{1..4}-*.ts`(vs P1 单文件 dispatcher)
- **A — 本地 zod**:每个 action 文件内定义 schema(vs B 共享 schemas)
- **R1 — 成功 redirect / 失败返回 ErrorCode**:成功 `redirect(/welcome/step/{n+1})`、失败 `return { code: WelcomeErrorCode, fields?: Record<string, string> }`(vs R2 统一 throw)
- **T2 — React 19 `useActionState`**:客户端 hook 处理 pending + error 状态(vs T1 原生 form)

**拍板**:**P2 + A + R1 + T2**(2026-05-26)
**理由**:独立模块便于测试隔离;本地 zod 避免跨步骤耦合(每步字段差异大);redirect/ErrorCode 二分让成功路径不被 try-catch 包裹;`useActionState` 是 Next.js 15 + React 19 推荐范式。
**WelcomeErrorCode union 定义**:
```ts
type WelcomeErrorCode =
  | 'INVALID_KEY_FORMAT'
  | 'INVALID_REPO_FORMAT'
  | 'BOOTSTRAP_ALREADY_COMPLETE'
  | 'UNAUTHENTICATED'
  | 'TENANT_NOT_FOUND'
  | 'INTERNAL_ERROR'
```
**ADR**:ADR-035(Server Action 形态约定)

---

## Q5. AC 测试矩阵

**背景**:AC-01-03 当前标 [Manual],但 layout-level redirect 完全可自动化;phase-2-4 §4.3 AC 范围仅泛指"4 步 happy",细节缺失。

候选:
- α — AC-01-03 保持 [Manual] 不动,4 步 happy 用 1 个组合 AC
- β — AC-01-03 改 [Happy] 自动化(破坏已有 manual 语义)
- **γ — 拆分**:AC-01-03 保持 [Manual] 原状,新增自动化 AC-01-04..-12 覆盖各路径

**测试基础设施候选**:
- I1 — testcontainer 跑所有 web 测试(慢)
- I2 — 全部 mock(失真)
- **I3 — mock-primary + testcontainer for cross-tenant**:单测全 mock(`vi.mock('drizzle-orm')`),跨租户 RLS-like 测试用真实 PG template

**personal tenant fixture 候选**:
- T-A — 测试运行时 ad-hoc 创建
- **T-C — dev-credentials 时(server boot)同步 seed**

**ac:coverage 候选**:
- G1 — 紧 gate(seed 之外也必须 100%)
- G2 — 不引入新 seed
- **G3 — 9 个 AC 进 ac:coverage 跟踪但不进 seed gate**(slice 4.3 起 web 包覆盖率逐步爬坡)

**拍板**:**γ + 9 ACs + I3 + T-C + G3**(2026-05-26)

### 新增 AC 清单

| AC ID | 类型 | 标题 | 覆盖范围 |
|-------|------|------|----------|
| AC-01-03 | [Failure][Manual] | 未完成 bootstrap 的用户访问 `/t/[slug]/runs` 被 redirect 到 `/welcome/step/1` | 保留原文 |
| AC-01-04 | [Failure][Happy] | layout guard:server-side check `bootstrap.completedAt == null` → `redirect('/welcome/step/1')` | guard 自动化 |
| AC-01-05 | [Happy] | step 1 Anthropic key 合法 → jsonb 写入 `anthropicKeyCiphertext` + redirect step 2 | step 1 happy |
| AC-01-06 | [Happy] | step 2 GitHub App checkbox 勾选 → jsonb `githubAppInstalled=true` + redirect step 3 | step 2 happy |
| AC-01-07 | [Happy] | step 3 repo `owner/name` 合法 → jsonb `pendingRepoOwnerName` + redirect step 4 | step 3 happy |
| AC-01-08 | [Happy] | step 4 import → seed 5 个 default skills 进 `assets`(per-tenant copy)+ `completedAt` 写入 + redirect `/t/[slug]/runs` | step 4 happy + seeds |
| AC-01-09 | [Happy] | step 4 skip → `defaultSkillsApplied='skipped'` + `completedAt` 写入 + redirect | step 4 skip |
| AC-01-10 | [Failure] | Anthropic key regex 不匹配 → return `INVALID_KEY_FORMAT` 不写库 | step 1 validation |
| AC-01-11 | [Failure] | 跨租户:用户 A 的 jsonb 不被用户 B 的 action 读到(`withTenant` proxy 强制) | RLS-like 跨租户隔离 |
| AC-01-12 | [Failure] | slug mismatch:用户 A 访问 `/t/{B-slug}/...` → redirect 到 `/t/{A-slug}/runs` | slug 守卫 |

**ADR**:ADR-036(testcontainer + dev-credentials fixture seed)

---

## Q6. Skills 种子内容

**背景**:spec 01 §3.2.c "5-10 个官方默认,可禁用不可删";ADR-006 §④ "至少 1 个 skill";`assets.tenantId` nullable(null = 全局),`assets.is_enabled` 全局布尔 —— 与 per-tenant 启停语义冲突。

候选(分六子项):
- 存储模型:S-A 全局 null tenantId / **S-B per-tenant copy + `metadata.is_seed=true`**
- 种子数量:C1 1 个 / **C2 5 个**(每 kind 各 1:skill/rule/command/hint/hook)/ C3 10 个
- UI 模式:M-A 仅导入 / M-B **导入 + 跳过** / M-C 浏览-勾选
- "不可删"强制:**E-A metadata 标记(slice 2 加守卫)** / E-B FK 强约束 / E-C 软删除列
- 内容源:A1 外部 markdown / A2 db 表填充 / **A4 TS literals(切片 4.3 内)→ markdown 文件未来迁移**
- 写入时机:W-A 用户首次登录 / **W-B Step 4 action**

**拍板**:**S-B + C2 + M-B + E-A + A4 + W-B**(2026-05-26)
**理由**:per-tenant copy 让 `is_enabled` 语义一致;5 个 kind 是 spec §3.2.c 下限;Step 4 写入与"启动确认"语义贴合;TS literals 内联让切片 4.3 无外部依赖。
**5 个种子清单(TS literals,`lib/seeds/default-skills.ts`)**:
1. `skill`:`code-review-assistant`
2. `rule`:`no-pii-in-logs`
3. `command`:`run-tests`
4. `hint`:`prefer-server-components`
5. `hook`:`pre-commit-format`
**风险**:per-tenant copy 在大租户场景下 row 数线性增长(5 × N tenants),但 V1 = 5-10 人小团队,< 100 行可忽略;markdown 迁移路径见 ADR-038。
**ADR**:ADR-037(Step 4 import/skip 二选一)、ADR-038(5-seed 清单 + per-tenant copy + markdown 未来迁移)

---

## Q7. Bootstrap guard 缓存与 RSC fetch 边界

**背景**:`/t/[slug]/layout.tsx` 当前是 stub;guard 需要在 layout 层执行;React 19 RSC fetch 重复调用 + Server Action 后缓存失效是设计要点。

候选(分六子项):
- guard 位置:L1 middleware / **L2 layout-level guard helper** / L3 page-level
- dedup:**D1 React 19 `cache()` per-request memo** / D2 显式传参
- 重验:**R1 Server Action 内 `revalidatePath('/t/[slug]', 'layout')` 防御性** / R2 不主动 revalidate(依赖 cache miss)
- tenantId 来源:TS-A 仅 session / TS-B 仅 URL / **TS-C session for `/welcome`,URL+session validation for `/t/[slug]`**
- 性能预算:**B1 接受 N+1(PG <1ms each)** / B2 single round trip join
- `/welcome` 反向 guard:**F1 welcome layout 强制 `bootstrap.completedAt == null`,否则 redirect `/t/[slug]/runs`** / F2 不守

**拍板**:**L2 + D1 + R1 + TS-C + B1 + F1**(2026-05-26)
**理由**:layout-level 是 Next.js 15 守卫模式标准位;React `cache()` 是 RSC dedup 官方推荐;`revalidatePath('layout')` 失效粒度合适;TS-C 在 `/welcome` 无 slug 时仍能工作;F1 防止已完成用户回到 wizard。
**`lib/bootstrap/guard.ts` 接口签名**:
```ts
export const getTenantBootstrap = cache(async (tenantId: string) => {
  // SELECT settings.bootstrap FROM tenants WHERE id = $1
  return { slug: string, bootstrap: TenantBootstrapState | null }
})
export async function requireBootstrapComplete(tenantId: string): Promise<void>
export async function requireBootstrapIncomplete(tenantId: string): Promise<void>
```
**风险**:`cache()` 仅 per-request,跨请求不共享;长期可加 unstable_cache,但 V1 不需要。
**ADR**:ADR-039(guard 形态)、ADR-040(tenantId 双源解析)

---

## Q8. 错误边界 + 失败 UX

**背景**:spec §4 失败 UX 针对 Run runtime,不覆盖 bootstrap;`packages/web/app/` 目前 0 个 error.tsx。

候选(分六子项):
- 错误渲染位置:U1 仅页面顶部 / U2 仅字段 / U3 全局 toast / **U4 字段内联 + 顶部系统 banner**
- error.tsx 分层:E1 单 root / E2 二层 / **E3 三层**(`app/error.tsx` + `app/(welcome)/error.tsx` + `app/(welcome)/welcome/step/[n]/error.tsx`)
- action 异常处理:X1 全 throw / X2 全 return / **X3 业务错误 return code,系统错误 throw → 上抛 error.tsx**
- step 4 部分状态:T1 全失败回滚 / T2 容忍部分写入 / **T3 事务 + 幂等 gate**(`BOOTSTRAP_ALREADY_COMPLETE` 错误码)
- toast 库:TL1 sonner / TL2 shadcn toast / TL3 自建 / **TL4 4.3 不引,推迟到 4.4**
- zh.ts 结构:Z1 **扩展 zh.ts 单文件**(`welcome.step1..4` + `errors.welcome.*`)/ Z2 拆 namespace 文件

**拍板**:**U4 + E3 + X3 + T3 + TL4 + Z1**(2026-05-26)
**理由**:U4 适配字段 + 系统二分;E3 与 route group 嵌套对齐;X3 让业务错误不污染 error stack;T3 防止重复点击触发 Step 4 双写;TL4 不为孤立组件膨胀范围;Z1 单文件已被 ADR-029 锁定。
**zh.ts 扩展位置**:`packages/web/lib/strings/zh.ts` 增加 `welcome.step1..4.{title,description,...}` + `errors.welcome.{invalidKeyFormat,invalidRepoFormat,bootstrapAlreadyComplete,unauthenticated,tenantNotFound,internalError}` 两个命名空间。
**新 shadcn primitives**(slice 4.3 内补齐):
- `Alert`(顶部 banner)
- `Input`(text field)
- `Label`(form label)
- `FormMessage`(字段下错误文本)
**ADR**:ADR-041(失败 UX 三轨制)、ADR-042(toast 推迟到 4.4)

---

## Q9. Route group 冲突 + step URL + slug 解析

**背景**:`(welcome)/page.tsx` 与 `app/page.tsx` 都占 `/` —— 路径冲突;step URL 形态;tenant slug 从哪取。

候选(分六子项):
- step URL:P1 **`/welcome/step/[n]` 动态** / P2 静态 `/welcome/step-1..4` / P3 query string
- `/welcome` 索引:I1 重定向到 step 1 / I2 显示首页文案 / I3 404 / **I4 双向 redirect**(完成 → `/t/[slug]/runs`,未完成 → `step/1`)
- slug 来源:S1 **扩展 `getTenantBootstrap` 同时返回 `{slug, bootstrap}`** / S2 单独 query / S3 从 session
- group 结构:**G1 `(welcome)/welcome/page.tsx` + `(welcome)/welcome/step/[n]/page.tsx`**(welcome group + nested welcome/ segment 解决 `/` 冲突)/ G2 干掉 group
- slug mismatch:V1 报 403 / V2 静默 / **V3 redirect 到用户自己的 slug**
- loading.tsx:**LD1 不引(action 内 pending 由 `useActionState` 接管)** / LD2 引

**拍板**:**P1 + I4 + S1 + G1 + V3 + LD1**(2026-05-26)
**理由**:`/welcome/step/[n]` segment 是唯一真源;G1 让 root `/` 保持现状,welcome 路径独立于 `(welcome)` group;V3 用户友好(不让用户卡在 403);loading.tsx 与 useActionState 重复。
**新 AC**:AC-01-12 slug mismatch redirect(已纳入 Q5 矩阵)
**ADR**:ADR-043(welcome group + nested welcome/ 结构)

---

## Q10. 进度指示器 + 视觉 / 交互一致性

**背景**:spec 07 §8.4 "4 张卡片,每张完成后变 ✓" 与 Q2 多路由冲突;无 responsive 策略。

候选(分六子项):
- 卡片 vs 路由:**A1 多路由 + 进度区显示 4 张状态 Card**(patch spec 07 §8.4)/ A2 单页 SPA-like 4 张卡片
- 进度视觉:PI1 stepper bar / PI2 进度条 / **PI3 4 张并列 Card,三态:done(✓)/ active(高亮)/ pending(灰)**
- 返回编辑:M1 不允许 / M2 全部可编辑 / **M3 step 1-3 可点击编辑,step 4 完成后锁定**
- 浏览器 back:**BB1 默认行为**(`router.push` 加入 history stack)/ BB2 拦截弹窗
- step 切换动效:AN1 无 / **AN2 状态图标 CSS 微动效**(`transition: transform 200ms`)/ AN3 framer-motion
- responsive:R1 mobile-first / R2 desktop-first + breakpoint / R3 全靠 grid auto / **R4 Tailwind utilities,不引 mobile 测试矩阵**

**拍板**:**A1 + PI3 + M3 + BB1 + AN2 + R4**(2026-05-26)
**理由**:A1 与 Q2/Q9 多路由一致;PI3 是 spec 07 视觉延续;M3 与 T3 幂等 gate 配合(step 4 锁防双写);Tailwind utilities 是 spec 07 §10 已确认基线。
**spec 07 §8.4 patch 草案**(实施 PR 内入档):
```diff
- ### 8.4 Bootstrap Welcome
- 4 张卡片,每张完成后变 ✓。4 张全 ✓ → [开始使用] 按钮可点。
+ ### 8.4 Bootstrap Welcome
+ 路由:`/welcome/step/[n]`(n ∈ {1,2,3,4}),每步独立 Server Action。
+ 进度区:页面顶部并列 4 张状态 Card,三态(done/active/pending)。
+ Step 1-3 完成后可点击 Card 返回编辑;Step 4 完成后 redirect `/t/[slug]/runs`。
+ Card 状态图标用 CSS `transition: transform 200ms`,不引动画库。
```
**ADR**:ADR-044(spec 07 §8.4 patch)、ADR-045(re-entry 策略:step 1-3 editable / step 4 locked)

---

## Q11. 4 步表单字段细节 + 未来切片边界

**背景**:Q3 X5 stub crypto / Q1 4 step 锁定 / `repositories.installationId NOT NULL` 阻塞 / dev-credentials mock GitHub 登录。

候选(分六子项):
- Anthropic key 校验:K1 后端去打 API / K2 仅长度 / **K3 regex `^sk-ant-[A-Za-z0-9_-]{32,}`** / K4 不校验
- GitHub App "installed" 判定:GA1 webhook callback / **GA2 install URL link + checkbox "已完成安装"** / GA3 GitHub API probe
- repo 输入形态:RP1 **单字段 `owner/name`(regex `^[\w.-]+/[\w.-]+$`)** / RP2 两字段拆分 / RP3 下拉(API 拉取)
- repo 落库:WR1 **jsonb `pendingRepoOwnerName`**(`tenants.settings.bootstrap`)/ WR2 直接落 `repositories`(installationId NOT NULL 卡住)
- step 4 跳过状态:SK1 nullable 布尔 / **SK2 enum `'skipped' \| 'imported'`** / SK3 计数列
- per-step 可跳过:SP1 **仅 step 4 可跳过** / SP2 全部可跳过 / SP3 都不可

**拍板**:**K3 + GA2 + RP1 + WR1 + SK2 + SP1**(2026-05-26)
**理由**:K3 防止明显错格式;GA2 是无 webhook 期间唯一可达方案;RP1 单字段简洁;WR1 解决 installationId NOT NULL 阻塞(slice 3 GitHub App 落地后 migration 写入真表);SK2 比布尔有语义;SP1 让 1-3 必填强语义。
**新 env var**:`GITHUB_APP_INSTALL_URL`(slice 3 来源)

> **Implementation note (2026-05-26, O1 confirmed by user):** `bootstrap` lives as a nested key inside the existing `tenants.settings` jsonb column (`tenants.settings = { bootstrap: { ... } }`). No SQL migration in slice 4.3 PR; only a TypeScript `.$type<TenantSettings>()` annotation on the existing column. `pendingRepoOwnerName` in WR1 = `tenants.settings.bootstrap.pendingRepoOwnerName`.
**TenantBootstrapState 完整 shape**:
```ts
type TenantBootstrapState = {
  anthropicKeyCiphertext?: string
  githubAppInstalled?: boolean
  githubAppMarkedAt?: string
  pendingRepoOwnerName?: string
  defaultSkillsApplied?: 'skipped' | 'imported'
  completedAt?: string
}
```
**风险**:slice 3 GitHub App 真接入后,需要 migration 从 `pendingRepoOwnerName` → `repositories` 行;同 PR 出 ADR。
**ADR**:ADR-046(4 步字段 stub + slice 3 migration 路径)、ADR-047(`pendingRepoOwnerName` jsonb 状态机 + SK2 enum)

---

## Q12. dev-seed personal tenant 时机 + JWT 集成

**背景**:`dev-credentials.ts` 内存数组 DEV_USERS(id 字符串如 `'dev-user-alice'`)与 `users.id uuid` 冲突;`auth/index.ts` JWT callback `token['tenantId'] = null` 硬编码。

候选(分七子项):
- 触发位置:L1 next.config / **L2 `instrumentation.ts`** / L3 lazy first-request / L4 manual cli / **L5 test setup(也启用)**
- uuid 映射:**U1 硬编码 uuid v7 字面量** / U2 deterministic hash / U3 random per-boot
- JWT 集成:JT1 留 null / JT2 fetch on read / **JT3 `authorize` 返回 `{id, name, email, tenantId}` → user → token**
- 幂等:ID1 truncate / ID2 select-then-insert / **ID3 drizzle `onConflictDoNothing` 事务** / ID4 检查环境变量
- 测试使用:TS1 **template db 一次性 seed**(template_honeyai 内含 dev tenants)/ TS2 每测重建 / TS3 单独 factory
- 生产 guard:PG1 仅 NODE_ENV 检查 / PG2 加 schema fail-fast / **PG3 双重 guard + ESLint ban + slice 4.5 ADR 弃用**

**拍板**:**L2 + L5 + U1 + JT3 + ID3 + TS1 + PG3**(2026-05-26)
**理由**:`instrumentation.ts` 是 Next.js 15 server boot 唯一标准钩子;硬编码 uuid v7 让 dev fixture 跨进程可重复;JT3 让 layout guard 拿到 tenantId;template db seed 是 testcontainer 已有模式延伸(Phase 1 已锁定)。
**`packages/web/lib/auth/dev-credentials.ts` 修改要点**:
- DEV_USERS 字面量增加 `id: uuid` + `tenantId: uuid` + `tenantSlug: string` 字段(硬编码 uuid v7)
- `authorize` 返回 `{id, name, email, tenantId}` 而非仅 `{id, name, email}`
**`packages/web/lib/auth/index.ts` JWT callback 修改要点**:
- line 45 `token['tenantId'] = null` → `token['tenantId'] = user.tenantId`
**新文件**:
- `packages/web/instrumentation.ts`:`register()` 内调用 `seedDevTenants()`
- `packages/web/lib/auth/dev-seed.ts`:`seedDevTenants()` 实现(`onConflictDoNothing` 写 tenants + users)
- `packages/web/lib/test/db.ts`:template db 测试桥
**风险**:`instrumentation.ts` 在 prod 环境也会 register,必须 PG3 双重 guard(`NODE_ENV !== 'production'` + 调用栈 throw 兜底)+ ESLint 规则 ban 业务包导入 `dev-seed.ts`;slice 4.5 中间件落地后,起 ADR 标记 `dev-seed` 为 deprecated 路径,准备 slice 3 GitHub App 接入后整体下线。
**ADR**:ADR-048(dev-seed 生命周期 + slice 4.5 弃用承诺)

---

## 切片 4.3 实施 Definition of Done

实施 PR 必须满足:

1. **代码层**(实建):
   - [ ] `packages/web/instrumentation.ts` + `lib/auth/dev-seed.ts` + `lib/test/db.ts`
   - [ ] `packages/core/src/crypto/anthropic-key.ts`(stub + slice 2 替换点注释)
   - [ ] `packages/web/lib/bootstrap/{guard.ts,read.ts}`
   - [ ] `packages/web/lib/actions/welcome/step{1..4}-*.ts`(4 个独立 module)
   - [ ] `packages/web/lib/seeds/default-skills.ts`(5 seeds TS literals)
   - [ ] `packages/web/app/(welcome)/welcome/page.tsx`(I4 双向 redirect)
   - [ ] `packages/web/app/(welcome)/welcome/step/[n]/page.tsx`
   - [ ] 三个 `error.tsx`(app / `(welcome)` / `welcome/step/[n]`)
   - [ ] 新 shadcn primitives:`Alert` / `Input` / `Label` / `FormMessage`
   - [ ] `packages/web/lib/auth/dev-credentials.ts` 扩展 uuid v7 + tenantSlug + authorize 返回 tenantId
   - [ ] `packages/web/lib/auth/index.ts` line 45 JWT callback 改 `token.tenantId = user.tenantId`
   - [ ] `packages/web/lib/auth/types.ts` `User.tenantId: string`
   - [ ] `packages/web/lib/strings/zh.ts` 扩展 `welcome.step1..4` + `errors.welcome.*`
   - [ ] `packages/web/app/(welcome)/layout.tsx` 加 `requireBootstrapIncomplete`
   - [ ] `packages/web/app/t/[slug]/layout.tsx` 加 `requireBootstrapComplete` + slug validation
   - [ ] migration:`tenants.settings.bootstrap` jsonb 列(`@honeyai/db`)
   - [ ] env:`GITHUB_APP_INSTALL_URL` 加入 `.env.example` + `@t3-oss/env-core` schema

2. **测试层**:
   - [ ] AC-01-04..-12 全部自动化通过(9 个)
   - [ ] AC-01-03 [Manual] 保留,不引入回归
   - [ ] `ac:coverage` 在 web 包扫到 AC-01-04..-12 进 tracking 报表(不进 seed gate)

3. **ADR 入档**(同 PR):
   - [ ] ADR-032 至 ADR-048 共 17 个 `Accepted` 状态

4. **Spec patch**(同 PR review):
   - [ ] `docs/V1-SPEC/ADRs/ADR-006-bootstrap-ux.md` 改 §4 步内容
   - [ ] `docs/V1-SPEC/01-product.md` §3.1 Step 3 卡片清单
   - [ ] `docs/V1-SPEC/decisions/phase-2-4-open-questions.md` §4.3 范围
   - [ ] `docs/V1-SPEC/07-frontend.md` §8.4 Welcome 进度区
   - [ ] `docs/V1-SPEC/CHANGELOG.md` v0.2.x 条目

5. **CI**:
   - [ ] typecheck / lint / test / ac:coverage 四闸全绿
   - [ ] ESLint 新规则:业务包禁止 import `dev-seed.ts`

6. **新留白触发**:
   - [ ] 实施过程如发现拍板外新留白,**停下来问用户**(不准自决),按需出 ADR-049+

---

## 下一步

✅ **门禁解除**。进入 `superpowers:writing-plans` skill,基于本文档输出 slice 4.3 实施计划到:

`docs/superpowers/plans/2026-05-26-phase-2-4-3-welcome-wizard.md`
