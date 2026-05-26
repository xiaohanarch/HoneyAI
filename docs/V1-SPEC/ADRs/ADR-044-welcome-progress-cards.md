# ADR-044: Welcome 右侧 4 张进度 Card

- 状态: Accepted
- 日期: 2026-05-26

## Context

spec 07 §8.4 原始描述为"4 张卡片,每张完成后变 ✓,4 张全 ✓ → [开始使用] 按钮可点"。这一描述隐含 SPA 单页模型,与 Q2/Q9 多路由决策(每步独立路由 `/welcome/step/[n]`)存在冲突。需要明确进度指示器的视觉形态和布局方式,并同步 patch spec 07 §8.4。

## Decision

选 **A1 — 多路由 + 右侧进度区显示 4 张状态 Card**,同步 patch spec 07 §8.4。

页面布局为左右分栏:
- **左侧主区域**:当前 step 的表单内容(输入框、说明文字、提交按钮)。
- **右侧 sidebar**:并列 4 张 Card,每张对应一个 step,直观展示用户当前所在步骤和历史完成情况。

4 张 Card 对应:
1. Anthropic API Key
2. GitHub App 安装
3. GitHub 仓库配置
4. Skills 种子导入

Card 三态由 ADR-045 定义(idle / running / done)。Step 1-3 完成后 Card 可点击返回编辑;Step 4 完成后整体 redirect 到 `/t/[slug]/runs`(幂等 gate,见 ADR-041 T3)。

**spec 07 §8.4 patch 内容**:将"SPA 单页 4 张卡片"改为"多路由 + 右侧进度 Card"描述(见 Q10 patch 草案)。

## Consequences

**正面**:
- A1 与 Q2/Q9 多路由决策完全一致,无 SPA 状态管理复杂度。
- 右侧 Card 让用户一眼知道在哪一步、哪几步已完成,信息密度合适。
- Step 1-3 可编辑设计增加容错空间(用户填错后可回去修改)。

**负面**:
- 左右分栏在小屏幕上可能需要响应式处理(R4 Tailwind utilities,但切片 4.3 不测试 mobile)。
- spec 07 §8.4 需要同 PR patch,增加 PR review 内容。

**后续影响**:
- spec 07 §8.4 patch 入档后,后续切片的 Welcome 相关设计以本 ADR 和 patch 为准。
- Card 三态动效由 ADR-045 约定,实现时引用。

## Alternatives Considered

- **A2 — 单页 SPA-like 4 张卡片**:与多路由决策矛盾,需要在单页管理 4 步状态机,复杂度高;Server Action `redirect()` 也无法在 SPA 模式下自然工作。
- **PI1 — stepper bar**:线性条形进度指示器信息密度低,无法显示每步标题和状态细节。
- **PI2 — 进度条**:百分比进度条不直观表达"哪步在哪步",且 4 步离散节点不适合连续进度条。

## Related

- 触发决策: `decisions/phase-2-4-3-open-questions.md §Q10`
- 关联 spec: 07-frontend.md §8.4(待 patch)
- 关联 ADR: ADR-045(Card 三态 + CSS 动效), ADR-032(4 步定义), ADR-043(路由结构)
