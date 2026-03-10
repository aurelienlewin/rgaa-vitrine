import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { execSync } from 'node:child_process'

const buildTimestamp = new Date().toISOString()

function sanitizeVersion(rawValue: string | undefined) {
  if (!rawValue) {
    return null
  }

  const trimmed = rawValue.trim()
  if (!trimmed) {
    return null
  }

  return trimmed.replace(/^v/i, '')
}

function resolveBuildVersion() {
  const envVersion =
    sanitizeVersion(process.env.VITE_BUILD_VERSION) ||
    sanitizeVersion(process.env.RELEASE_VERSION) ||
    sanitizeVersion(process.env.GITHUB_REF_NAME)

  if (envVersion) {
    return envVersion
  }

  try {
    const latestTag = execSync('git describe --tags --abbrev=0', {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString('utf8')
      .trim()

    const sanitizedTag = sanitizeVersion(latestTag)
    if (sanitizedTag) {
      return sanitizedTag
    }
  } catch {
    // Ignore tag lookup failures in shallow/non-git environments.
  }

  return sanitizeVersion(process.env.npm_package_version) ?? '0.0.0'
}

const buildVersion = resolveBuildVersion()

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@vercel/analytics/next': '@vercel/analytics/react',
    },
  },
  define: {
    'import.meta.env.VITE_BUILD_TIMESTAMP': JSON.stringify(buildTimestamp),
    'import.meta.env.VITE_BUILD_VERSION': JSON.stringify(buildVersion),
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: false,
      },
      '/sitemap.xml': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: false,
      },
      '/ai-context.json': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: false,
      },
    },
  },
})
