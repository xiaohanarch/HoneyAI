// packages/web/next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // pg native bindings require external package handling (Next 15: moved out of experimental)
  serverExternalPackages: ['pg', 'pg-native'],
}

export default nextConfig
