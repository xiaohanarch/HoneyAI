# 07 — Frontend

## 1. 技术栈

- Next.js 15（App Router）
- React 19
- RSC + Server Actions
- Tailwind CSS v4
- shadcn/ui（headless primitives，按需复制到 packages/web/src/components/ui）
- Tiptap 2.x + @tiptap/extension-markdown
- Zustand（轻量 client store，只装 SSE 实时事件）
- TanStack Query（V1 仅用于 client-fetched 非关键数据，主路径走 RSC）
- Auth.js v5 + DrizzleAdapter（DB session）

## 2. 路由结构

```
app/
├── (auth)/
│   ├── login/page.tsx                ← GitHub OAuth 入口
│   └── callback/route.ts             ← Auth.js callback
├── (welcome)/
│   ├── welcome/page.tsx              ← 首次登录引导
│   └── install-github-app/page.tsx
├── t/
│   └── [slug]/                       ← tenant 作用域
│       ├── layout.tsx                ← 校验成员 + withTenant(db)
│       ├── runs/
│       │   ├── page.tsx              ← Run 列表
│       │   ├── new/page.tsx          ← 新建 Run
│       │   └── [runId]/
│       │       ├── page.tsx          ← Run 详情（时间轴 + 节点视图）
│       │       └── nodes/[nodeId]/page.tsx  ← 节点深入（艺ifact / 编辑器）
│       ├── assets/
│       │   ├── page.tsx              ← 8 类 tab + 列表 + 编辑器
│       │   └── new/page.tsx
│       ├── settings/
│       │   ├── page.tsx              ← tenant 设置
│       │   ├── members/page.tsx      ← 成员管理（owner only）
│       │   └── repos/page.tsx        ← repo 绑定
│       └── billing/page.tsx          ← 成本面板
├── admin/                            ← platform_admin only
│   ├── tenants/page.tsx
│   ├── assets/page.tsx               ← 系统级 assets
│   ├── pricing/page.tsx
│   └── runtime/page.tsx              ← 模型路由配置
├── api/
│   ├── runs/[id]/stream/route.ts     ← SSE
│   ├── runs/[id]/grill/route.ts      ← Grill chat POST
│   ├── export/route.ts               ← tenant 数据导出
│   ├── webhooks/github/route.ts      ← GitHub webhook
│   └── auth/[...nextauth]/route.ts
└── layout.tsx
```

## 3. 设计 Tokens

### 3.1 来源
从 legacy/ 原型抽取，放 `app/styles/tokens.css` —— 作为 V1 第一个 PR

### 3.2 关键变量
- 颜色（OKLCH）：bg-base/card/elev/deep、text-strong/body/muted/faint
- 状态色：done/run/review/idle-soft/halt
- Agent 身份色：a-req/a-graph/a-arch/a-dev/a-sec/a-perf/a-test
- 字体：Inter (UI) / Instrument Serif + Songti SC (display) / JetBrains Mono (mono)
- 间距 / radius / shadow / motion duration / ease

### 3.3 atmosphere 效果
- `.bg-atmosphere`（radial OKLCH gradient）
- `.grain::before`（inline SVG noise, mix-blend-mode: multiply）

## 4. 实时推送（SSE + POST）

### 4.1 SSE endpoint
```
GET /api/runs/<id>/stream
  → SSE 事件流（见 05-orchestrator §8）
  → 浏览器 EventSource 连接
  → Zustand store 更新
```

### 4.2 用户操作（POST）
- saveArtifact / passGate / cancelRun / retryNode / startGrill / sendGrillMessage
- 全部走 Server Action 或 POST /api/...

### 4.3 不用 WebSocket
（见 ADR-002）

## 5. Tiptap IR 编辑器

### 5.1 双区布局
- 上半：Frontmatter 表单（基于 zod schema 自动生成 form fields）
- 下半：Markdown 富文本（Tiptap + @tiptap/extension-markdown）

### 5.2 校验
- onChange debounced 500ms → zod parse → 高亮缺失字段（非阻断）
- 保存时 → zod parse → 校验失败拒绝并显示 error path

### 5.3 乐观锁
- 保存 payload 带 `if_version`
- 冲突时弹窗 [查看 diff] [覆盖] [放弃]

### 5.4 字段动态生成
- Frontmatter 表单按 zod schema 元数据自动渲染
- 支持类型：string / number / enum (radio/select) / array (+ button) / object (nested)

## 6. shadcn 组件清单（V1 用到）

- Button / Input / Textarea / Select / Checkbox / Radio
- Card / Sheet / Dialog / DropdownMenu / Tabs
- Toast / Alert
- Tooltip / Popover
- Table / Badge / Avatar
- Skeleton / Spinner

不用：DatePicker / Calendar / Combobox（V1 用不上）

## 7. i18n / 主题
- zh-CN only，所有 UI 文案集中 `lib/strings/zh.ts`
- 浅色 only，深色变量留好不暴露切换
- V1.1 加 en + 深色

## 8. 关键页面交互细节

### 8.1 Run 详情页
- 左侧时间轴（垂直 stepper）
- 右侧当前节点视图（agent: 流式输出 + tool calls；gate: IR 编辑器；deploy: PR 链接）
- 顶部：Run 状态 + 已花成本 + [终止] / [从此节点重试]
- 底部抽屉：日志全文 + LLM raw 输出（折叠 + 脱敏警告）

### 8.2 新建 Run 弹窗
- 标题（必填）
- 一句话需求（必填 textarea）+ 2-3 个示例需求按钮（点击填充）
- 目标 repo（默认上次用的）
- 目标分支（默认 main）
- [创建] → 立刻创建 + 启动 + 跳转

### 8.3 Asset 编辑页
- Tiptap 双区编辑器（同 IR 编辑器）
- 顶部 source 标识（手写 / mirror / import-once）
- mirror 模式下编辑器只读 + 提示 "此 Asset 由 GitHub mirror，请到源 repo 修改"

### 8.4 Welcome Screen

Welcome 引导使用 `(welcome)` route group，布局为 `grid grid-cols-[1fr_320px]`：左侧为当前步骤表单，右侧为 `ProgressCards` 侧边栏。

#### ProgressCards (PI3)

4 张卡片对应 4 个步骤，每张有三态：

| 状态 | 视觉 | aria |
|------|------|------|
| `idle` | 灰边框 + 低不透明度 | — |
| `running` | 蓝边框 + 浅蓝背景 | `aria-current="step"` |
| `done` | 绿边框 + 浅绿背景 | — |

状态切换通过 CSS `transition-all duration-300` 实现（AN2）。颜色来自 tokens.css 设计令牌：`--status-done` / `--status-run` / `--status-idle-soft`。

> 实现参见 `packages/web/components/welcome/ProgressCards.tsx`。

## 9. 构建输出

- Next.js standalone output
- 镜像：distroless 基础 ~130MB
- 副本：web ×2 + worker ×1（生产）

## 10. 设计 Tokens CSS（从 legacy/ 抽取）

```css
/* packages/web/src/styles/tokens.css */
:root {
  /* Surfaces (OKLCH) */
  --bg-base:  oklch(98% 0.005 90);
  --bg-card:  oklch(99% 0.003 90);
  --bg-elev:  oklch(100% 0 0);
  --bg-deep:  oklch(94% 0.008 90);

  /* Text scale */
  --text-strong: oklch(18% 0.01 250);
  --text-body:   oklch(28% 0.01 250);
  --text-muted:  oklch(48% 0.008 250);
  --text-faint:  oklch(65% 0.005 250);

  /* Status */
  --status-done:      oklch(68% 0.14 145);
  --status-run:       oklch(72% 0.16 60);
  --status-review:    oklch(74% 0.12 270);
  --status-idle-soft: oklch(78% 0.02 250);
  --status-halt:      oklch(60% 0.22 25);

  /* Agent identity palette */
  --a-req:   oklch(70% 0.14 30);
  --a-graph: oklch(70% 0.14 90);
  --a-arch:  oklch(70% 0.14 150);
  --a-dev:   oklch(70% 0.14 210);
  --a-sec:   oklch(70% 0.14 270);
  --a-perf:  oklch(70% 0.14 330);
  --a-test:  oklch(70% 0.14 60);

  /* Typography */
  --font-ui:      'Inter', system-ui, sans-serif;
  --font-display: 'Instrument Serif', 'Songti SC', serif;
  --font-mono:    'JetBrains Mono', ui-monospace, monospace;

  --text-xs:   clamp(0.75rem, 0.72rem + 0.1vw, 0.8125rem);
  --text-sm:   clamp(0.875rem, 0.84rem + 0.15vw, 0.9375rem);
  --text-base: clamp(1rem,   0.96rem + 0.2vw, 1.0625rem);
  --text-lg:   clamp(1.125rem, 1.06rem + 0.3vw, 1.25rem);
  --text-xl:   clamp(1.375rem, 1.25rem + 0.5vw, 1.625rem);
  --text-2xl:  clamp(1.75rem, 1.5rem + 1vw, 2.25rem);
  --text-3xl:  clamp(2.25rem, 1.75rem + 2vw, 3.5rem);
  --text-hero: clamp(3rem, 1rem + 7vw, 8rem);

  /* Spacing */
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-6: 1.5rem;
  --space-8: 2rem;
  --space-12: 3rem;
  --space-section: clamp(4rem, 3rem + 5vw, 10rem);

  /* Radius */
  --r-sm: 6px;
  --r-md: 10px;
  --r-lg: 16px;
  --r-xl: 24px;

  /* Shadow */
  --shadow-soft: 0 1px 2px oklch(0% 0 0 / 0.04), 0 4px 12px oklch(0% 0 0 / 0.04);
  --shadow-elev: 0 2px 8px oklch(0% 0 0 / 0.06), 0 12px 32px oklch(0% 0 0 / 0.08);

  /* Motion */
  --dur-fast:   150ms;
  --dur-normal: 300ms;
  --dur-slow:   500ms;
  --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in-out:   cubic-bezier(0.4, 0, 0.2, 1);
}

/* Atmosphere（signature look） */
.bg-atmosphere {
  background:
    radial-gradient(ellipse 80% 50% at 70% 0%, oklch(95% 0.05 60 / 0.4), transparent 60%),
    radial-gradient(ellipse 60% 60% at 20% 100%, oklch(95% 0.04 270 / 0.3), transparent 70%),
    var(--bg-base);
}

.grain::before {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 100;
  background-image: url("data:image/svg+xml;utf8,<svg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.6 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
  opacity: 0.08;
  mix-blend-mode: multiply;
}

/* Motion utilities */
@keyframes pulse-run {
  0%, 100% { box-shadow: 0 0 0 0 var(--status-run); opacity: 1; }
  50%      { box-shadow: 0 0 0 8px transparent;     opacity: 0.7; }
}
.pulse-run { animation: pulse-run 2s var(--ease-in-out) infinite; }
```

## 11. 关键 React 组件骨架

### 11.1 RunTimeline
```tsx
// packages/web/src/components/run/RunTimeline.tsx
'use client'
import { useRunStore } from '@/lib/store'
import { cn } from '@/lib/cn'

export function RunTimeline({ runId }: { runId: string }) {
  const nodes = useRunStore(s => s.runs[runId]?.nodes ?? [])
  return (
    <ol className="flex flex-col gap-3 p-4">
      {nodes.map(n => (
        <li key={n.id} className="flex items-center gap-3">
          <NodeStatusIcon status={n.status} kind={n.kind} />
          <span className={cn('font-mono text-sm', n.status === 'failed' && 'text-[var(--status-halt)]')}>
            {n.name}
          </span>
          {n.status === 'running' && <span className="pulse-run h-2 w-2 rounded-full bg-[var(--status-run)]" />}
        </li>
      ))}
    </ol>
  )
}
```

### 11.2 TiptapIREditor 双区
```tsx
// packages/web/src/components/editor/TiptapIREditor.tsx
'use client'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Markdown from '@tiptap/extension-markdown'
import { SchemaForm } from './SchemaFormGenerator'

export function TiptapIREditor({ schema, value, onSave }: Props) {
  const [frontmatter, setFrontmatter] = useState(value.frontmatter)
  const editor = useEditor({ extensions: [StarterKit, Markdown], content: value.body })

  return (
    <div className="grid grid-rows-[auto_1fr_auto] gap-4 h-full">
      <SchemaForm schema={schema} value={frontmatter} onChange={setFrontmatter} />
      <EditorContent editor={editor} className="prose max-w-none border rounded-[var(--r-lg)] p-4" />
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => onSave({ frontmatter, body: editor?.getMarkdown() }, 'draft')}>
          保存草稿
        </Button>
        <Button onClick={() => onSave({ frontmatter, body: editor?.getMarkdown() }, 'pass')}>
          通过 Gate ✓
        </Button>
      </div>
    </div>
  )
}
```

### 11.3 Server Action 示例
```ts
// packages/web/src/server/actions/run.ts
'use server'
import { auth } from '@/lib/auth'
import { withTenant, db as rawDb } from '@/db'
import { scheduleRun } from '@orchestrator'
import { revalidatePath } from 'next/cache'

export async function createRun(input: { title: string; oneLiner: string; repoId: string; targetBranch: string }) {
  const session = await auth()
  if (!session?.tenantId) throw new ValidationError('no tenant')
  const db = withTenant(session.tenantId, rawDb)

  const run = await db.transaction(async tx => {
    const [run] = await tx.insert(schema.runs).values({
      id: uuidv7(),
      tenantId: session.tenantId,
      repositoryId: input.repoId,
      createdByUserId: session.userId,
      title: input.title,
      oneLiner: input.oneLiner,
      targetBranch: input.targetBranch,
      status: 'created',
    }).returning()
    await scheduleRun(tx, run.id)
    return run
  })

  revalidatePath(`/t/${session.tenantSlug}/runs`)
  redirect(`/t/${session.tenantSlug}/runs/${run.id}`)
}
```

## 11. 验收清单（V1.0 种子）

> 见 [00-README.md §验收清单约定](./00-README.md#验收清单约定acceptance-criteria)。

- [ ] **AC-07-01** `[Concurrency]` (consumes AC-04-01)：用户 A 进入 IR 编辑 → 用户 B 同 IR 看到"A 正在编辑（剩 04:xx）"+ 按钮 [查看 / 等待 / 强抢]；B 点 [强抢] + 二次确认 → A 的 tab 通过 `ir.lock.changed` SSE 收到通知，编辑器置只读
- [ ] **AC-07-02** `[Timeout]`：用户进入 IR 编辑后关闭浏览器，5min 内无 keep-alive → Redis lock 过期，第二人无需 [强抢] 直接进入编辑

