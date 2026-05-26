// packages/web/next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    // pg native bindings require external package handling
    serverComponentsExternalPackages: ['pg', 'pg-native'],
  },
}

export default nextConfig
