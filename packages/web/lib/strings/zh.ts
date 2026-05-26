// packages/web/lib/strings/zh.ts
// All zh-CN UI strings for @honeyai/web (Q10 — no next-intl, V1 single language).
// Add keys as new components are built; do NOT scatter hardcoded strings in JSX.

import type { WelcomeErrorCode } from '../errors/welcome-errors'

export const zh = {
  common: {
    appName: 'HoneyAI',
    loading: '加载中…',
    error: '出错了，请稍后再试',
  },
  login: {
    title: '登录 HoneyAI',
    usernamePlaceholder: '用户名',
    passwordPlaceholder: '密码',
    submitLabel: '登录',
    errorInvalid: '用户名或密码错误',
    errorUnknown: '登录失败，请稍后再试',
  },
  welcome: {
    heading: '欢迎使用 HoneyAI',
    subheading: '多智能体 AI 数字研发产线',
    loginLink: '去登录',
  },
  appBar: {
    switchTenant: '切换租户',
    userMenu: '用户菜单',
    signOut: '退出登录',
  },
} as const

export type ZhStrings = typeof zh

export const zhWelcome = {
  step1: {
    title: '第 1 步：填入 Anthropic API Key',
    keyLabel: 'API Key',
    keyHint: '以 sk-ant- 开头，至少 39 字符',
    submit: '保存并继续',
    submitting: '保存中…',
  },
  step2: {
    title: '第 2 步：安装 GitHub App',
    install: '前往 GitHub 安装',
    confirm: '我已完成安装',
    submitting: '保存中…',
  },
  step3: {
    title: '第 3 步：选择 GitHub 仓库',
    repoLabel: '仓库 (owner/name)',
    submit: '保存并继续',
    submitting: '保存中…',
  },
  step4: {
    title: '第 4 步：导入默认 Skills',
    import: '导入 5 个默认',
    skip: '跳过',
  },
} as const

// Server-side message strings surfaced via WelcomeActionResult.message.
// Kept separate from zhErrorsWelcome because these are step-precondition hints,
// not error-code translations — they piggy-back on INTERNAL_ERROR's banner slot.
export const zhWelcomeServerMessages = {
  step2Prereq: '请先完成第 1 步',
  step3Prereq: '请先完成第 2 步',
  step4Prereq: '请先完成第 3 步',
} as const

// Exhaustive map keyed by WelcomeErrorCode — typo / missing code = compile error.
export const zhErrorsWelcome: Record<WelcomeErrorCode, string> = {
  INVALID_KEY_FORMAT: 'Anthropic Key 格式不正确',
  INVALID_REPO_FORMAT: '仓库格式不正确，应为 owner/name',
  BOOTSTRAP_ALREADY_COMPLETE: '引导已完成，无法重复提交',
  UNAUTHENTICATED: '请先登录',
  TENANT_NOT_FOUND: '找不到对应租户',
  INTERNAL_ERROR: '系统内部错误，请稍后重试',
}

export const zhRuns = {
  list: {
    heading: '所有 Run',
    empty: '暂无 Run，点击右上角创建',
    newRun: '新建 Run',
    colStatus: '状态',
    colTitle: '标题',
    colCreatedAt: '创建时间',
  },
  new: {
    heading: '新建 Run',
    titleLabel: '标题',
    titlePlaceholder: '简短描述这次任务',
    oneLinerLabel: '一句话需求',
    oneLinerPlaceholder: '详细描述你想要实现的功能…',
    submit: '创建并启动',
    submitting: '创建中…',
    examples: [
      '为用户登录添加 JWT 刷新机制',
      '将首页图片懒加载改为优先加载',
      '给订单列表页加上按状态筛选',
    ],
  },
  detail: {
    status: '状态',
    cost: '已花费',
    cancel: '终止',
    retry: '重试节点',
    approve: '通过 Gate ✓',
    reject: '拒绝 Gate ✗',
    rejectReason: '拒绝原因',
    rejectSubmit: '确认拒绝',
  },
  status: {
    created: '已创建',
    scheduling: '调度中',
    running: '运行中',
    paused_at_gate: '等待审批',
    completed: '已完成',
    failed: '失败',
    cancelled: '已取消',
  },
  nodeStatus: {
    pending: '待运行',
    running: '运行中',
    success: '已完成',
    failed: '失败',
    skipped: '已跳过',
  },
} as const
