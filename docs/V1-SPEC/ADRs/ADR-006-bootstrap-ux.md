# ADR-006: Bootstrap Welcome 4 步必填

- 状态: Accepted
- 日期: 2026-05-23

## Context
首次进入 HoneyAI 的新租户必须完成最少配置才能创建 Run，否则失败体验差。

候选方式：
- A. 极简注册即用，缺啥提示啥
- B. **强制 4 步 Bootstrap 向导**，全部完成才解锁 Create Run
- C. 多种向导根据场景分支

需要前置的最少信息：Anthropic Key、GitHub Repo、预算、至少一个 Skill。

## Decision
选 **B. 强制 4 步 Welcome 向导**。

| 步骤 | 内容 | 必填 |
|---|---|---|
| ① 接 Anthropic Key | 校验调通 `claude --version` | ✅ |
| ② 接 GitHub Repo | OAuth + 选默认 repo + 校验写权限 | ✅ |
| ③ 设预算 | 月度 micro-USD 预算 + 80%/100% 阈值 | ✅ |
| ④ 配置 Skills | 8 类 Asset 至少 1 个 skill（mirror 或 import-once） | ✅ |

- 任一步未完成 → /t/<slug>/* 全部 redirect 回 /welcome
- 4 步独立保存，可断点续传

## Consequences
- 正面:
  - Create Run 时所有前置条件已就绪，失败率显著降低
  - 新用户被强制走完关键路径，留存度 ↑
  - 后续 ops 排查时可断言「凡是过了 Welcome 的租户均有 4 项」
- 负面:
  - 阻塞首次体验，无法「先玩玩看」
  - 4 步对纯探索用户有摩擦
- 后续影响:
  - 必须给每步加跳过的工程后门（admin 后台改 tenants 行）
  - Welcome 页是 V1.0 第一个高质量设计页（编辑式语言，非 admin dashboard 风）

## Alternatives Considered
- **A. 渐进式提示**: 实测会让用户跳过 → 在 Create Run 才碰壁，沮丧度高；放弃
- **C. 分支向导**: V1 用户场景单一，复杂度过剩；放弃

## Related
- 01-product.md §Bootstrap UX
- 07-frontend.md §welcome 路由
- TD（无对应债，但 Welcome 文案在 TD-012 中提到 zh-CN only）
