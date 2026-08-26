import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from 'dotenv'

// One .env at the repo root, loaded before Next reads anything.
config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../.env') })

/**
 * STATIC_EXPORT=1 produces a folder of plain files for GitHub Pages.
 *
 * It is a showcase mode, not the production target: an export has no server,
 * so server actions, cookie auth and on-demand revalidation are all gone. The
 * admin cannot exist in this build at all, and every page is frozen at the
 * moment it was built. See docs/static-export.md before using it.
 */
const isExport = process.env.STATIC_EXPORT === '1'

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(isExport
    ? {
        output: 'export',
        // GitHub Pages serves a project site from /<repo>, so every asset and
        // link has to be prefixed or the CSS 404s.
        basePath: process.env.EXPORT_BASE_PATH ?? '',
        assetPrefix: process.env.EXPORT_BASE_PATH ?? undefined,
        // No image optimisation server exists in an export.
        images: { unoptimized: true },
        // Pages become /path/index.html, which is what a static host needs.
        trailingSlash: true,
      }
    : {}),
  // Workspace packages ship TypeScript source, so Next compiles them itself.
  transpilePackages: ['@aividi/core', '@aividi/db', '@aividi/pipeline'],
  // Native / connection-holding modules must not be bundled.
  serverExternalPackages: ['postgres', 'bullmq', 'ioredis'],
  eslint: { ignoreDuringBuilds: true },
  webpack: (config) => {
    // The workspace packages use ESM-correct "./foo.js" specifiers that point
    // at TypeScript sources. Node and tsx map those themselves; webpack needs
    // to be told.
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      '.js': ['.ts', '.tsx', '.js'],
    }
    return config
  },
}

export default nextConfig
