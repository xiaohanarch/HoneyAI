# Phase 2.4 Open Questions — 切片 4:`@honeyai/web` 骨架 + 登录 + Run 列表

> **来源**:Phase 2.0 merge 后(PR #6 → `61e345f`)切入切片 1 + 切片 4 并行准备阶段(2026-05-26)
> **当前状态**:**全部 12 项已拍板**(2026-05-26 用户 Option A 一次性默认通过)
> **门禁**:✅ 已解除 —— 切片 4 可进入 Superpowers writing-plans 阶段
> **后续变更**:任意已拍板项变更必须新建 ADR-0XX(自 ADR-032 起递增)

## 状态总览

### 切片 4 内子任务划分(已拍板)

| # | 子切片 | 范围 | 依赖 |
|---|---|---|---|
| 4.1 | Next.js 骨架 + Auth + tokens | App Router 目录 / NextAuth Credentials dev / tokens.css / shadcn 初装 | core(已并) + db(已并) |
| 4.2 | shadcn 基础组件 + AppBar | Button / Card / Dropdown / AppBar / 暗色 placeholder | 4.1 |
| 4.3 ✅ | Welcome 4 步引导（slice 完成，参见 `docs/V1-SPEC/decisions/phase-2-4-3-open-questions.md`） | spec 01 §welcome / ADR-006 4 步必填 | 4.2 |
| 4.4 | Run 列表 + tenant routing | `/t/[slug]/runs` 列表页 + fixture seed | 4.2(并行) |
| 4.5 | 多租户 middleware + 切换 | slug 冲突解析 / AppBar dropdown 切换 | 4.4 |
| 4.6 | Tiptap generator(可选) | 手工 mapping table + zod type guards | 4.2;切片 5 可吸收 |

### 切片 4 留白(已拍板)

| # | 主题 | 拍板 | 关联 ADR |
|---|---|---|---|
| Q1 | Next.js 15 目录布局 | **A — 按特性拆(`app/(auth)` / `app/(welcome)` / `app/t/[slug]`)** | 无(社区共识) |
| Q2 | GitHub OAuth dev mock | **A — NextAuth v5 Credentials provider(仅 dev)** | ADR-029(待开,实施 PR) |
| Q3 | UI 组件库 | **A — shadcn/ui** | 无(spec 07 已隐含) |
| Q4 | Tailwind v4 + tokens 集成 | **A — `tokens.css` CSS vars + `bg-[var(--xxx)]` 任意值语法** | 无(实现细节) |
| Q5 | Tenant slug 冲突策略 | **A — GitHub login + 自动后缀 `-N`** | 无(spec 01 §welcome 扩展) |
| Q6 | Tiptap generator 算法 | **A — 手工 mapping table + zod type guards** | ADR-030(待开,实施 PR) |
| Q7 | Form state 管理 | **A — react-hook-form(frontmatter) + Tiptap(body)** | 无(库选型) |
| Q8 | Run 列表数据源(Phase 4 阶段) | **A — fixture seed(`packages/db/src/seed/fixtures.ts`)** | 无(过渡方案) |
| Q9 | 多租户 UX | **A — 顶部 AppBar dropdown 切换** | 无(spec 01 §welcome) |
| Q10 | i18n 策略 | **A — `lib/strings/zh.ts` + `useStrings()` hook,不引 next-intl** | 无(V1 单语言) |
| Q11 | E2E 框架 | **A — Vitest + jsdom;Playwright 推迟到切片 5** | 无(分层取舍) |
| Q12 | 数据获取层(全 web 通用) | **A — RSC + Server Action,不引 tRPC** | ADR-031(待开,实施 PR) |

---

## 子切片 4.1 — Next.js 骨架 + Auth + tokens

- **范围**:
  - `packages/web/` 完整 Next.js 15 app(App Router)
  - 目录:`app/(auth)/login` / `app/(welcome)` / `app/t/[slug]` / `components/{ui,auth,welcome,runs}` / `lib/` / `server/` / `styles/`
  - NextAuth v5 Credentials provider(仅 dev,fixture 用户列表)
  - `styles/tokens.css` — 全部 CSS vars(spec 07 设计 token)
  - shadcn/ui 初装 + `components.json` 配置
- **不含**:GitHub OAuth(切片 3 落)
- **AC 范围**:`/login` 渲染 + 登录 → `/t/[slug]/runs` 跳转 happy

## 子切片 4.2 — shadcn 基础组件 + AppBar

- **范围**:
  - shadcn `Button` / `Card` / `Dropdown` / `Avatar` / `Skeleton`
  - `components/ui/AppBar.tsx` — logo + tenant dropdown + user avatar
  - 暗色 placeholder:`styles/tokens.css` `@media (prefers-color-scheme: dark)` 块预留
- **AC 范围**:Storybook-less 视觉自查(暂不引 Storybook,推迟到 V1.0)

## 子切片 4.3 ✅ — Welcome 4 步引导（已完成）

- **范围**:
  - 4 步必填(ADR-006):Anthropic API Key / GitHub App 安装 / GitHub Repo 选择 / Default Skills 导入
  - 每步独立 Server Action + zod 校验
- **AC 范围**:AC-01-04..AC-01-12（见 `docs/V1-SPEC/decisions/phase-2-4-3-open-questions.md`）
- **完成状态**:slice 4.3 PR 已合并；详见 `docs/V1-SPEC/CHANGELOG.md v0.9.0`

## 子切片 4.4 — Run 列表 + tenant routing

- **范围**:
  - `app/t/[slug]/runs/page.tsx` — RSC 直读 db
  - Skeleton + 分页(无限滚动推迟到切片 5)
  - 数据源:`packages/db/src/seed/fixtures.ts` 假数据填充
- **AC 范围**:列表渲染 + 跨租户 RLS(读其他 tenant slug 应 404)

## 子切片 4.5 — 多租户 middleware + 切换

- **范围**:
  - `middleware.ts` — 从 `/t/[slug]` 解析 slug → 注入 `tenantId` 到 Server Component context
  - AppBar dropdown 切换 tenant → 跳 `/t/[other-slug]/runs`
  - slug 冲突:用户 GitHub login = `alice`,第二位 alice 注册时 `alice-2`,以此类推
- **AC 范围**:切换 happy + 越权访问其他 tenant 404

## 子切片 4.6 — Tiptap generator(可选)

- **范围**:手工 mapping table `lib/forms/schema-to-tiptap.ts`,从 zod schema → Tiptap node spec
- **依赖**:切片 5 IR 编辑器 + IR 乐观锁(切片 1 完成)
- **取舍**:可整体吸收进切片 5(MVP 联调),也可在切片 4 末提前落,具体由实施 PR 阶段动态判断

---

## Q1. Next.js 15 目录布局

候选:

- **A — 按特性拆**:
  ```
  packages/web/
    ├── app/
    │   ├── (auth)/login/
    │   ├── (welcome)/setup/
    │   ├── t/[slug]/
    │   │   ├── runs/
    │   │   └── settings/
    │   ├── api/
    │   └── layout.tsx
    ├── components/{ui,auth,welcome,runs}/
    ├── lib/{auth,strings,forms}/
    ├── server/{actions,db}/
    └── styles/
  ```
- B — 按技术层拆(`pages/` / `services/` / `models/`)—— 不符合 App Router 习惯
- C — 单层平铺 —— 文件爆炸

**拍板**:**A — 按特性拆**(2026-05-26)
**理由**:Next.js 15 App Router 推荐 route group + colocation;按特性能让 `components/auth/` 与 `app/(auth)/` 紧贴,大幅降低跳转跨度。
**风险**:无。
**ADR**:无(社区共识)

---

## Q2. GitHub OAuth dev mock

候选:

- **A — NextAuth v5 Credentials provider(仅 dev)**:`packages/web/lib/auth/dev-credentials.ts` 列出 4-6 个 fixture 用户(`alice` / `bob` / `carol` / `dave`),输入 username 即登录
- B — 手写 dev login route(不走 NextAuth,prod 切换时需大改)
- C — 完整 GitHub OAuth 直接接入(切片 3 才有 GitHub App credentials)

**拍板**:**A — NextAuth Credentials dev**(2026-05-26)
**理由**:NextAuth v5 session / cookie / middleware 抽象与切片 3 GitHub provider 是同一套 API,dev → prod 仅换 provider,代码改动 < 10 行。
**风险**:Credentials provider 在 prod 必须 disable;通过 `process.env.NODE_ENV === 'development'` 守卫 + 启动时 fail-fast 校验。
**ADR**:ADR-029(实施 PR 内入档)

---

## Q3. UI 组件库

候选:

- **A — shadcn/ui**(spec 07 §setup 已隐含)
- B — Radix UI 裸用(需自己包装,工作量大)
- C — Mantine / Ant Design / Chakra(主题与 spec 07 OKLCH token 不兼容)

**拍板**:**A — shadcn/ui**(2026-05-26)
**理由**:spec 07 设计 token 是 CSS vars 形态,shadcn `globals.css` + Radix primitives 与之天然兼容;源码 copy-paste 模式可自由微调。
**风险**:无。
**ADR**:无(spec 隐含)

---

## Q4. Tailwind v4 + tokens 集成

候选:

- **A — `tokens.css` CSS vars + Tailwind 任意值语法 `bg-[var(--color-bg)]`**:CSS vars 在 `styles/tokens.css` 定义,Tailwind utility 用任意值语法引用
- B — Tailwind v4 `@theme` 块直接定义 color(失去 vars 灵活度,无法运行时换主题)
- C — Tailwind config 静态 colors(回到 v3 模式,失去 v4 收益)

**拍板**:**A — CSS vars + 任意值语法**(2026-05-26)
**理由**:运行时可换主题(暗色 placeholder Q12);spec 07 设计 token 全用 OKLCH,CSS vars 直存;Tailwind v4 任意值语法对 `var()` 一等公民支持。
**风险**:任意值语法编译期不知道颜色名,IntelliSense 弱 —— 接受。
**ADR**:无(实现细节)

---

## Q5. Tenant slug 冲突策略

候选:

- **A — GitHub login + 自动后缀 `-N`**:首位 alice 注册 → `alice`,第二位 alice → `alice-2`,直到无冲突
- B — 强制用户在 Welcome 第 1 步手填 slug(交互成本高)
- C — UUID slug(URL 难读)

**拍板**:**A — login + 后缀**(2026-05-26)
**理由**:零交互成本,可读性好;后缀算法在 Welcome 第 1 步 Server Action 内事务化 SELECT FOR UPDATE + INSERT 防竞态。
**风险**:被恶意大量注册同名抢号 —— V1 内部团队部署不存在此场景;V1.0 可加 rate limit。
**ADR**:无(spec 01 §welcome 扩展;实施 PR 同 patch 01-product.md)

---

## Q6. Tiptap generator 算法

候选:

- **A — 手工 mapping table + zod type guards**:`lib/forms/schema-to-tiptap.ts` 定义 `zodTypeToTiptapNode(zodType)` switch / type guard,显式枚举 ZodString / ZodNumber / ZodEnum / ZodArray / ZodObject
- B — 通用递归遍历 `_def` 内部 API(脆弱,zod 内部结构升级会破)
- C — 引入 `zod-to-json-schema` + JSONSchema → Tiptap 中转(链路长 + 类型损失)

**拍板**:**A — 手工 mapping table**(2026-05-26)
**理由**:V1 IR schema 已 frozen(spec 04),mapping 一次写完 + 单测覆盖即可;手工版本对每种 zod 类型的 Tiptap node 输出有完全控制权,UX 微调成本低。
**风险**:未来 IR schema 增字段类型(如 ZodBigInt)需更新 mapping —— 接受,有单测兜底。
**ADR**:ADR-030(实施 PR 内入档)

---

## Q7. Form state 管理

候选:

- **A — react-hook-form(frontmatter)+ Tiptap(body)**:frontmatter 简单字段用 RHF + zod resolver,body 富文本用 Tiptap editor instance
- B — 全用 Tiptap(frontmatter 也用 Tiptap node 渲染,过度复杂)
- C — useState + 手写校验(轮子)

**拍板**:**A — RHF + Tiptap 双轨**(2026-05-26)
**理由**:RHF + `@hookform/resolvers/zod` 是 React 生态事实标准,与 `@honeyai/core` IR schema 直接对接;Tiptap 专精富文本,两者职责清晰。
**风险**:无。
**ADR**:无(库选型)

---

## Q8. Run 列表数据源(Phase 4 阶段)

候选:

- **A — fixture seed**(`packages/db/src/seed/fixtures.ts`):切片 4 阶段往 db 写 8-15 条假 Run,RSC 直接读真实 db(测 RLS + tenant 路由)
- B — mock service 层(切片 4 内部 in-memory)—— 切到真实 db 时改动大
- C — 接真实 orchestrator(切片 1 未 ready 时阻塞)

**拍板**:**A — fixture seed**(2026-05-26)
**理由**:走真实 db + RLS + drizzle 查询路径,切到真实 orchestrator 时只换 fixture seed 触发逻辑;同时验证 `withTenant` 中间件端到端。
**风险**:无。
**ADR**:无(过渡方案;切片 5 联调时改为真实 orchestrator 产物)

---

## Q9. 多租户 UX

候选:

- **A — 顶部 AppBar dropdown**:点击当前 tenant 名 → dropdown 列出用户所属 tenants → 切换跳 `/t/[other-slug]/runs`
- B — 侧边栏 tenant 列表 + 当前高亮(占侧栏宽度,V1 暂不需要)
- C — `/select-tenant` 独立选择页(刷新成本高)

**拍板**:**A — AppBar dropdown**(2026-05-26)
**理由**:与 GitHub / Vercel / Linear 用户心智一致;1 个 tenant 时 dropdown 自动隐藏。
**风险**:无。
**ADR**:无(spec 01 §welcome 扩展)

---

## Q10. i18n 策略

候选:

- **A — `lib/strings/zh.ts` + `useStrings()` hook**:扁平 key-value 对象,客户端 + 服务端共用;不引 next-intl / react-i18next
- B — next-intl(完整 i18n 框架,V1 单语言用不上)
- C — 散落 hardcode 字符串(后续 i18n 时翻译成本高)

**拍板**:**A — 极简 strings 表**(2026-05-26)
**理由**:V1 简体中文唯一目标用户,无需多语言切换;集中 strings 文件能让未来引 next-intl 时一次性提取 key。
**风险**:无。
**ADR**:无(V1 单语言)

---

## Q11. E2E 框架

候选:

- **A — Vitest + jsdom**(切片 4 内 RSC / Server Action 单测;Playwright 推迟到切片 5)
- B — 切片 4 起就上 Playwright(基础设施重,且切片 4 仅静态页面没 SSE / 长流程)
- C — Cypress(团队不熟)

**拍板**:**A — Vitest + jsdom**(2026-05-26)
**理由**:切片 4 的 AC 集中在 Server Action 逻辑 + 数据获取 + middleware,Vitest + `@testing-library/react` + jsdom 完整覆盖;Playwright 留给切片 5 SSE + Tiptap 富文本 + Gate UI 端到端流程。
**风险**:无。
**ADR**:无(分层取舍)

---

## Q12. 数据获取层(全 web 通用)

候选:

- **A — RSC(server fetch / drizzle 直读)+ Server Action(mutation)**:不引 tRPC / TanStack Query
- B — tRPC(过度抽象,unified Next.js 内 tRPC 收益弱)
- C — REST API routes + TanStack Query

**拍板**:**A — RSC + Server Action**(2026-05-26)
**理由**:spec 02 §unified-nextjs(ADR-003)语义就是不拆 API / Web;RSC 直读 db + Server Action 直写 db 是最短路径;tRPC 在 unified-nextjs 内仅增加抽象层 zero 收益。
**风险**:client-side 实时数据用 SSE(spec 02 ADR-002),不需要 TanStack Query;局部 client mutation 状态用 RHF + `useTransition`。
**ADR**:ADR-031(实施 PR 内入档)

---

## 拍板流程

1. ✅ 2026-05-26 用户 Option A 一次性默认通过 12 项
2. 同 PR(本 PR `docs/phase-2-1-and-4-prep`)落 **ADR-029** + **ADR-030** + **ADR-031** 入档
3. ⛔ 门禁解除后 Superpowers writing-plans 进入切片 4.1 plan 阶段
4. 切片 4.1 → 4.2 → (4.3 ‖ 4.4) → 4.5 → (4.6 可选) 顺序实施;每子切片独立 PR

---

## 不在切片 4 范围(显式排除)

- ❌ Run 详情页(切片 5)
- ❌ SSE 订阅 / 实时事件(切片 5)
- ❌ Gate UI(切片 5)
- ❌ Tiptap 富文本编辑(切片 5;切片 4.6 仅落 generator)
- ❌ GitHub OAuth 真实接入(切片 3)
- ❌ Claude API key 真实校验(切片 2)
- ❌ Storybook(V1.0)
- ❌ E2E Playwright(切片 5)
- ❌ 多语言 / 暗色主题完整实现(V1.1)

切片 4 = `@honeyai/web` 骨架 + 登录(dev mock)+ Welcome + Run 列表 + 多租户切换。**fixture 驱动,不接 LLM / SSE / Tiptap 编辑**。
