// packages/web/lib/strings/zh.ts
// All zh-CN UI strings for @honeyai/web (Q10 — no next-intl, V1 single language).
// Add keys as new components are built; do NOT scatter hardcoded strings in JSX.

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
