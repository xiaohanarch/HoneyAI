#!/bin/sh
set -e

# Write opencode custom provider config at startup, injecting DASHSCOPE_API_KEY from env.
# Uses the Alibaba Cloud Bailian Token Plan endpoint (anthropic-compatible API format).
mkdir -p /root/.config/opencode

node -e "
const cfg = {
  provider: {
    'bailian-token-plan': {
      npm: '@ai-sdk/anthropic',
      name: 'Alibaba Cloud Model Studio',
      options: {
        baseURL: 'https://coding.dashscope.aliyuncs.com/apps/anthropic/v1',
        apiKey: process.env.DASHSCOPE_API_KEY || ''
      },
      models: {
        'qwen3.6-plus': { name: 'qwen3.6-plus' },
        'qwen3-coder-plus': { name: 'qwen3-coder-plus' }
      }
    }
  }
};
require('fs').writeFileSync('/root/.config/opencode/config.json', JSON.stringify(cfg, null, 2));
console.log('[entrypoint] opencode config written with provider bailian-token-plan');
"

exec node_modules/.bin/tsx packages/worker/src/start.ts
