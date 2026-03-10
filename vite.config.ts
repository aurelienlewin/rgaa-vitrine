import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve as resolvePath } from 'node:path'

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

function optimizeCriticalStylesheetDelivery(): Plugin {
  let criticalFontPreloads = ''

  return {
    name: 'optimize-critical-stylesheet-delivery',
    apply: 'build',
    generateBundle(_options, bundle) {
      const fontHrefs = Object.values(bundle)
        .filter((chunk) => chunk.type === 'asset' && typeof chunk.fileName === 'string')
        .map((asset) => asset.fileName)
        .filter((fileName) => /^assets\/atkinson-hyperlegible-.*\.woff2$/i.test(fileName))
        .sort()
        .map((fileName) => `    <link rel="preload" href="/${fileName}" as="font" type="font/woff2" crossorigin>`)

      criticalFontPreloads = fontHrefs.join('\n')
    },
    writeBundle(outputOptions) {
      const outDir = typeof outputOptions.dir === 'string' ? outputOptions.dir : 'dist'
      const indexHtmlPath = resolvePath(outDir, 'index.html')
      const stylesheetPattern = /<link rel="stylesheet" crossorigin href="([^"]+\.css)">/g

      let html = readFileSync(indexHtmlPath, 'utf8')
      html = html.replace(stylesheetPattern, (_match, href: string) => {
        return [
          `<link rel="preload" as="style" crossorigin href="${href}">`,
          `<link rel="stylesheet" crossorigin href="${href}" media="print" onload="this.media='all'">`,
          `<noscript><link rel="stylesheet" crossorigin href="${href}"></noscript>`,
        ].join('\n    ')
      })

      if (criticalFontPreloads) {
        html = html.replace(
          '<link rel="preload" href="/logo-rgaa-vitrine.svg" as="image" type="image/svg+xml" fetchpriority="high" />',
          `<link rel="preload" href="/logo-rgaa-vitrine.svg" as="image" type="image/svg+xml" fetchpriority="high" />\n${criticalFontPreloads}`,
        )
      }

      writeFileSync(indexHtmlPath, html)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), optimizeCriticalStylesheetDelivery()],
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
