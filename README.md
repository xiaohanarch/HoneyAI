# HoneyAI

AI 数字研发产线（DevPipeline）UI 原型集合。

围绕「需求富化 → 设计与拆解 → 编码 + UT → SIT 集成测试」四阶段流水线，配套 Agent 编排、军规库、知识图谱、运营看板等界面探索。

## 目录结构

```
prototype/
├── index.html              # 主控台 · 当前运行
├── runs-list.html          # 运行历史
├── create-run.html         # 新建运行
├── stage-1-requirement.html
├── stage-2-architecture.html
├── stage-4-test.html
├── agent-detail.html       # Agent 详情
├── review-detail.html      # 评审详情
├── artifact-diff.html      # 产物 Diff
├── node-config-drawer.html # 节点配置抽屉
├── interrupt-modal.html    # 中断恢复弹窗
├── rules-library.html      # 军规库
├── knowledge-graph.html    # 知识图谱
├── operations.html         # AI 资产运营
└── people-ops.html         # 人员运营
```

## 设计基调

- 纯静态 HTML 原型，零构建依赖
- Tailwind CDN + Chart.js + Inter / Instrument Serif / JetBrains Mono
- OKLCH 色彩空间，明亮 bento 风格 + 颗粒氛围层
- 12 列网格，编辑型排印（display 标题 + mono 度量）

## 本地预览

```bash
cd prototype
python3 -m http.server 8888
# 浏览 http://localhost:8888/
```

## 状态

原型阶段（prototype v0.2），仅用于交互与视觉验证，不含真实业务逻辑与数据。
