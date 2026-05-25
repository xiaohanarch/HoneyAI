# Phase 2 Open Questions

> **来源**：Phase 1 merge 后(PR #4 → `fb32aee`)切入 Phase 2 规划阶段(2026-05-26)
> **当前状态**:**全部 9 项已拍板**(2026-05-26 用户逐一确认 Q1-Q6 + M1-M3)
> **门禁**:✅ 已解除 —— Phase 2.0 可进入 Superpowers plan 阶段
> **后续变更**：任意已拍板项后续变更必须新建 ADR-0XX(自 ADR-020 起递增)

## 状态总览

### Phase 2 全局(已拍板)

| # | 主题 | 拍板 | 关联 ADR |
|---|---|---|---|
| M1 | Phase 2 切片顺序 | **0 → 1 + 4 并行 → 2 → 3 → 5** | 无(过程决策) |
| M2 | Phase 2.0 起手范围 | **`@honeyai/core` IR zod schemas** | 无(过程决策) |
| M3 | Sandbox MVP 运行时 | **本地 Docker(替代 spec 06 §k3s)** | ADR-020(待开) |

### Phase 2.0(切片 0 = Core IR)留白

| # | 主题 | 拍板 | 关联 ADR |
|---|---|---|---|
| Q1 | Markdown frontmatter 解析库 | **A — `gray-matter`** | ADR-021(待开,实施 PR) |
| Q2 | `@honeyai/core/src/ir/` 文件布局 | **A — 按 IR 拆 3 文件 + 1 共享** | ADR-022(待开,实施 PR) |
| Q3 | Markdown 正文 section 是否进 zod 校验 | **B — 仅 frontmatter zod,正文 warning** | ADR-023(待开,实施 PR) |
| Q4 | Phase 2.0 是否包含 `parseIR` / `stringifyIR` 工具函数 | **A — 包含** | ADR-024(待开,实施 PR) |
| Q5 | Phase 2.0 是否包含 IR 版本规则运行时逻辑 | **B — 不含,延后切片 1** | ADR-025(待开,实施 PR) |
| Q6 | Tiptap 表单 generator 是否进 Phase 2.0 | **B — 不进,延后切片 4** | ADR-026(待开,实施 PR) |

---

## M1. Phase 2 切片顺序

- **拍板**:**0 → 1 + 4 并行 → 2 → 3 → 5**
- **切片定义**:
  - 切片 0 = `@honeyai/core` IR zod schemas
  - 切片 1 = `@honeyai/orchestrator` FSM(fixture 驱动,不接 LLM)
  - 切片 2 = `@honeyai/adapter-claude` + `@honeyai/sandbox-runner`
  - 切片 3 = `@honeyai/github` OAuth + App + PR 创建
  - 切片 4 = `@honeyai/web` 骨架 + 登录 + Run 列表
  - 切片 5 = `@honeyai/web` Run 详情 + SSE + Gate UI(MVP 端到端 ✨)
- **理由**:0 阻塞 1/2/3 + 短小可一次完成;1 和 4 互不依赖可并行;5 是联调收口
- **ADR**:无(纯过程决策,不入 ADR)

---

## M2. Phase 2.0 起手范围

- **拍板**:**`@honeyai/core` IR zod schemas**
- **生效产物**:
  - 3 个 IR zod schema(Requirement / Design / Implementation)与 spec 04 完全对齐
  - 单元测试:每 schema happy + failure case + spec §8 示例作 golden fixture
  - Phase 2.0 PR **不**包含 orchestrator / adapter / web 任何代码
- **理由**:体量小、阻塞他人、TDD 友好、对齐 ADR-014 推迟的债
- **ADR**:无

---

## M3. Sandbox MVP 运行时

- **拍板**:**本地 Docker `docker exec`**(MVP 阶段),`kubectl exec` 推迟到 V1.0
- **生效配置**:`@honeyai/sandbox-runner` 通过 dockerode 或 `child_process.exec('docker exec ...')` 进入 sandbox 容器
- **影响范围**:
  - spec 06 §sandbox 改为"V1.0 = k3s,MVP = 本地 Docker"双模式说明
  - `@honeyai/sandbox-runner` 内部抽象 `SandboxBackend` 接口,两个 impl
  - 切片 2 PR 仅交付 `LocalDockerSandbox`,`K8sSandbox` 占位
- **理由**:省 k3s 部署 / Cilium 配置 / 网络策略验证 50% 工作量,演示阶段不需要 prod 隔离
- **ADR**:**ADR-020 — Sandbox MVP 用本地 Docker**(待开)
- **附带 spec patch**:Phase 2.2 PR 必须 patch `06-sandbox.md` 起首段(声明 MVP / V1.0 分层)

---

## Q1. Markdown frontmatter 解析库

候选:

- **A — `gray-matter`**(npm 1.7M weekly,React/Next 生态事实标准,支持 YAML/TOML/JSON frontmatter,体积 1.5KB gzipped)
- B — `remark` + `remark-frontmatter`(完整 AST,但体量大,适合需要修改 markdown 的场景)
- C — 手写正则(规避依赖,但要测试边缘 case)

**拍板**:**A — `gray-matter`**(2026-05-26)
**理由**:`@honeyai/core` 是 server-side / sandbox-side 双跑,gray-matter 无 DOM 依赖,体积小,Drizzle/Next.js 生态熟悉。
**风险**:gray-matter 不支持 markdown AST 修改 —— 但 Phase 2.0 仅需 parse + zod validate,不需要改 markdown 内容,符合需求。
**ADR**:ADR-021(实施 PR 内入档)

---

## Q2. `@honeyai/core/src/ir/` 文件布局

候选:

- **A — 按 IR 拆 3 文件 + 1 共享**:
  ```
  packages/core/src/ir/
    ├── requirement.ts   # RequirementIRSchema + parse/stringify
    ├── design.ts         # DesignIRSchema + parse/stringify
    ├── implementation.ts # ImplementationIRSchema + parse/stringify
    ├── shared.ts         # 共享 enum (Priority/Complexity/Severity)
    └── index.ts          # barrel(ADR-014)
  ```
- B — 单文件全塞 `ir.ts`(简单但 200+ 行)
- C — 按 zod / parse / stringify 横切拆分

**拍板**:**A — 按 IR 拆 3 文件 + 1 共享**(2026-05-26)
**理由**:每个 IR 独立 + 共享 enum 隔离 + 与 spec 04 §2/§3/§4 章节一一对应,review 体验最好。
**ADR**:ADR-022(实施 PR 内入档)

---

## Q3. Markdown 正文 section 是否进 zod 校验

spec 04 §2.2 / §3.2 / §4.2 定义了正文必须含 `## 背景` / `## 用户故事` / `## 验收标准明细` 等 section,但没指明这是 zod 校验范围还是 prompt 模板范围。

候选:

- A — 进 zod,缺少 section 拒绝保存(强校验)
- **B — 仅 frontmatter 进 zod,正文 sections 检测出"缺失"返回 warning(非阻断)**
- C — 完全不校验正文

**拍板**:**B — 仅 frontmatter zod,正文 sections warning**(2026-05-26)
**理由**:正文是 LLM 输出 + 人工编辑混合产物,过于严苛会引发频繁 quality_failed 重试;但完全不校验会丢失 UX 提示。warning 通过 `parseIR` 第二个返回值暴露,前端可显示"缺失 ## 开放问题 章节"提示。
**风险**:warning 语义需另立类型,不能复用 `z.SafeParseReturnType`,代码略增。
**ADR**:ADR-023(实施 PR 内入档)

---

## Q4. Phase 2.0 是否包含 `parseIR` / `stringifyIR` 工具函数

`parseIR(markdownString)` = gray-matter 提取 frontmatter + 用 zod 校验 + 返回 `{ frontmatter, body, warnings }`
`stringifyIR(ir)` = 用 gray-matter 把 frontmatter + body 拼回 markdown 字符串(用于 Tiptap 保存)

候选:

- **A — 包含**(schema + 工具同 PR 落)
- B — 不含,Phase 2.0 仅暴露 zod schema,工具函数推迟到使用方(orchestrator / web)各自实现
- C — 仅含 `parseIR`,不含 `stringifyIR`(stringify 延后)

**拍板**:**A — 包含 `parseIR` / `stringifyIR`**(2026-05-26)
**理由**:`@honeyai/core` 是 IR 唯一权威,parse/stringify 与 schema 配对最自然;否则三个消费方各写一遍 frontmatter 提取逻辑,drift 风险高。
**ADR**:ADR-024(实施 PR 内入档)

---

## Q5. Phase 2.0 是否包含 IR 版本规则运行时逻辑

spec 04 §11 定义了 IR 版本规则:`ir_documents.version` 单调递增 int + Redis advisory 编辑锁 5min idle + 强抢二次确认 + zod 失败 / 锁丢失 UX。

候选:

- A — 包含完整运行时(`acquireEditLock` / `incrementVersion` / `forceUnlock`)
- **B — 不含,Phase 2.0 仅暴露 zod 类型 + parse/stringify;版本规则运行时延后到切片 1(orchestrator)或切片 5(web)**
- C — 仅含版本号字段定义,不含锁逻辑

**拍板**:**B — 不含,延后切片 1**(2026-05-26)
**理由**:版本规则需 Redis 连接 + Server Action 调用上下文,与 `@honeyai/core` 的"纯函数 + 类型"定位冲突;放进 orchestrator 更自然。
**风险**:切片 5(web Gate UI)依赖此逻辑,排期顺序需保证 orchestrator 先于 web 完成。已在 M1 切片顺序中保证。
**ADR**:ADR-025(实施 PR 内入档)

---

## Q6. Tiptap 表单 generator 是否进 Phase 2.0

spec 04 §9 说 zod schema 喂给 generator 自动出 Tiptap 表单。

候选:

- A — 进 Phase 2.0(`@honeyai/core` 暴露 zod-to-tiptap util)
- **B — 不进,推迟到切片 4(`@honeyai/web`)**:zod 是无 DOM 的,Tiptap generator 是 React + DOM,放 `@honeyai/web/src/lib/forms/` 更合适
- C — 进单独包 `@honeyai/forms`

**拍板**:**B — 不进,延后切片 4**(2026-05-26)
**理由**:`@honeyai/core` 必须 server/sandbox/web 三端可跑,绝不能引入 React 依赖;Tiptap generator 是纯前端工具,语义不属于 core。
**ADR**:ADR-026(实施 PR 内入档)

---

## 拍板流程

1. 用户对 Q1-Q6 逐一确认或反向选择
2. 我把每项 ✅ 推进到上方"状态总览"表
3. 同 PR(或独立 ADR PR)落 **ADR-020** 起依次入档:
   - ADR-020 — Sandbox MVP 用本地 Docker
   - 如 Q1-Q6 选择偏离建议,逐一起 ADR-021+
4. ⛔ 门禁解除 后才允许 grill-me / Superpowers writing-plans 进入 Phase 2.0 plan 阶段

---

## 不在 Phase 2.0 范围(显式排除)

- ❌ orchestrator FSM(切片 1)
- ❌ Claude Code CLI 接入(切片 2)
- ❌ Sandbox 实建(切片 2)
- ❌ GitHub OAuth / App(切片 3)
- ❌ Next.js web 任何代码(切片 4+)
- ❌ Tiptap 编辑器(切片 4+)
- ❌ SSE / LISTEN+NOTIFY(切片 5)
- ❌ Redis 编辑锁(切片 1 或 5)
- ❌ IR ↔ `ir_documents` / `artifacts` 表的持久化桥接(切片 1)

Phase 2.0 = 纯 schema + parse/stringify 工具 + 单元测试。**就这些。**
