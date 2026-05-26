// packages/web/next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // pg native bindings require external package handling (Next 15: moved out of experimental)
  serverExternalPackages: ['pg', 'pg-native'],
  // workspace packages use ESM .js extension imports; transpile so webpack resolves .ts sources
  transpilePackages: ['@honeyai/core', '@honeyai/db'],
  webpack(config, { isServer }) {
    // Map .js extension imports to their .ts/.tsx counterparts (ESM TypeScript convention)
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      '.js': ['.ts', '.tsx', '.js'],
      '.mjs': ['.mts', '.mjs'],
    }

    // pg and its transitive Node-only dependencies must never be bundled by webpack.
    // serverExternalPackages does not cover deps found inside transpilePackages, so we
    // add a custom externals function that catches any require/import of these packages
    // in all compilation contexts (server, edge, client).
    const pgExternalPackages = new Set([
      'pg',
      'pg-native',
      'pg-connection-string',
      'pg-protocol',
      'pg-types',
      'pgpass',
      'split2',
    ])
    const existingExternals = config.externals ?? []
    config.externals = [
      ...(Array.isArray(existingExternals) ? existingExternals : [existingExternals]),
      ({ request }, callback) => {
        if (pgExternalPackages.has(request)) {
          return callback(null, `commonjs ${request}`)
        }
        callback()
      },
    ]

    return config
  },
}

export default nextConfig
