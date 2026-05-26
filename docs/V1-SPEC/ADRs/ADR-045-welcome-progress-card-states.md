# ADR-045: Progress Card 3 状态 + AN2 转场

- 状态: Accepted
- 日期: 2026-05-26

## Context

ADR-044 确定 Welcome 右侧 4 张进度 Card 的布局方案。每张 Card 需要清晰表达当前状态,以及状态切换时的视觉反馈。候选方案涉及动效库引入、CSS-only 方案和无动效方案的取舍。同时需要明确 Step 1-3 完成后的可编辑策略与 Step 4 锁定策略。

## Decision

采用 **PI3 + M3 + AN2** 组合:

**PI3 — 4 张并列 Card 三态**:
- `idle`:步骤未开始,Card 显示灰色/低对比度图标,标题文字正常。
- `active`:当前正在进行的步骤,Card 高亮边框或背景,状态图标为活跃状态。
- `done`:步骤已完成,Card 显示绿色勾选图标(✓)。

**AN2 — 状态图标 CSS 微动效**:状态切换时图标使用 CSS `transition-all duration-300`(或 `transition: transform 200ms`)实现 fade + scale 微动效,不引入 framer-motion 或其他动画库。

**M3 — Step 1-3 可编辑,Step 4 完成后锁定**:
- Step 1-3 的 `done` 状态 Card 可点击,跳转到对应 step 页面重新编辑。
- Step 4 完成(即 `completedAt` 写入)后,整体 redirect 到 `/t/[slug]/runs`,Welcome 流程结束,无需返回。
- 幂等 gate(ADR-041 T3)防止 Step 4 重复触发。

**BB1 — 默认浏览器 back 行为**:`router.push` 将每步加入 history stack,用户可用浏览器 back 按钮返回;不拦截或弹窗确认。

## Consequences

**正面**:
- CSS-only 转场无额外 JS 体积,符合 web/performance.md 规定的 compositor-friendly 动画策略。
- `transition-all duration-300` 在所有现代浏览器中原生支持,无兼容性风险。
- M3 与 T3 幂等 gate 配合:step 4 锁定防双写,step 1-3 可编辑提供容错。

**负面**:
- CSS-only 无法实现复杂的序列动画(如 stagger、链式效果)。
- `active` 状态高亮依赖 Tailwind utilities,需要 Card 组件接收 `state` prop。

**后续影响**:
- 如需更丰富的动效(V2),可引入 framer-motion 替换 CSS transition,接口向后兼容。
- Card 组件接收 `state: 'idle' | 'active' | 'done'` + `onClick?: () => void` prop,接口清晰。

## Alternatives Considered

- **AN1 — 无动效**:状态切换无视觉反馈,用户不易感知进度变化。
- **AN3 — framer-motion**:YAGNI,仅为 Welcome 4 张 Card 引入动画库依赖过重。
- **M2 — 全部可编辑**:Step 4 完成后仍可编辑会触发 `BOOTSTRAP_ALREADY_COMPLETE` 错误,用户体验困惑;锁定更直观。
- **M1 — 不允许编辑**:Step 1-3 填错后无路径修正,体验差。

## Related

- 触发决策: `decisions/phase-2-4-3-open-questions.md §Q10`
- 关联 spec: 07-frontend.md §8.4(待 patch), web/performance.md §动画性能
- 关联 ADR: ADR-044(4 张 Card 布局), ADR-041(T3 幂等 gate), ADR-043(路由结构)
