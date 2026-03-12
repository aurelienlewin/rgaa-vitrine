import { defineConfig, type Plugin } from 'vite'
import type { OutputChunk } from 'rollup'
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
  let routeModulePreloadScript = ''

  function collectChunkDependencies(
    bundle: Record<string, OutputChunk>,
    fileName: string,
    seen = new Set<string>(),
  ): string[] {
    if (seen.has(fileName)) {
      return []
    }

    seen.add(fileName)
    const chunk = bundle[fileName]
    if (!chunk || chunk.type !== 'chunk') {
      return []
    }

    const importedFiles: string[] = Array.isArray(chunk.imports)
      ? chunk.imports.flatMap((importedFileName) => collectChunkDependencies(bundle, importedFileName, seen))
      : []

    return [chunk.fileName, ...importedFiles]
  }

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

      const bundleChunks = Object.values(bundle).filter(
        (chunk): chunk is OutputChunk => chunk.type === 'chunk',
      )
      const bundleByFileName = Object.fromEntries(
        bundleChunks.map((chunk) => [chunk.fileName, chunk]),
      )

      const domainGroupChunk = bundleChunks.find((chunk) =>
        chunk.facadeModuleId?.endsWith('/src/DomainGroupPage.tsx'),
      )
      const siteProfileChunk = bundleChunks.find((chunk) =>
        chunk.facadeModuleId?.endsWith('/src/SiteProfilePage.tsx'),
      )
      const moderationChunk = bundleChunks.find((chunk) =>
        chunk.facadeModuleId?.endsWith('/src/ModerationPage.tsx'),
      )
      const siteMapChunk = bundleChunks.find((chunk) =>
        chunk.facadeModuleId?.endsWith('/src/SiteMapPage.tsx'),
      )
      const accessibilityChunk = bundleChunks.find((chunk) =>
        chunk.facadeModuleId?.endsWith('/src/AccessibilityPage.tsx'),
      )
      const homeChunk = bundleChunks.find((chunk) =>
        chunk.facadeModuleId?.endsWith('/src/App.tsx'),
      )

      const domainGroupRouteFiles = domainGroupChunk
        ? Array.from(new Set(collectChunkDependencies(bundleByFileName, domainGroupChunk.fileName))).map(
            (fileName) => `/${fileName}`,
          )
        : []
      const siteProfileRouteFiles = siteProfileChunk
        ? Array.from(new Set(collectChunkDependencies(bundleByFileName, siteProfileChunk.fileName))).map(
            (fileName) => `/${fileName}`,
          )
        : []
      const moderationRouteFiles = moderationChunk
        ? Array.from(new Set(collectChunkDependencies(bundleByFileName, moderationChunk.fileName))).map(
            (fileName) => `/${fileName}`,
          )
        : []
      const siteMapRouteFiles = siteMapChunk
        ? Array.from(new Set(collectChunkDependencies(bundleByFileName, siteMapChunk.fileName))).map(
            (fileName) => `/${fileName}`,
          )
        : []
      const accessibilityRouteFiles = accessibilityChunk
        ? Array.from(new Set(collectChunkDependencies(bundleByFileName, accessibilityChunk.fileName))).map(
            (fileName) => `/${fileName}`,
          )
        : []
      const homeRouteFiles = homeChunk
        ? Array.from(new Set(collectChunkDependencies(bundleByFileName, homeChunk.fileName))).map(
            (fileName) => `/${fileName}`,
          )
        : []

      routeModulePreloadScript =
        domainGroupRouteFiles.length > 0 ||
        siteProfileRouteFiles.length > 0 ||
        moderationRouteFiles.length > 0 ||
        siteMapRouteFiles.length > 0 ||
        accessibilityRouteFiles.length > 0 ||
        homeRouteFiles.length > 0
          ? [
              '    <script>',
              '      (function () {',
              '        var pathname = window.location.pathname;',
              `        var domainRouteFiles = ${JSON.stringify(domainGroupRouteFiles)};`,
              `        var siteRouteFiles = ${JSON.stringify(siteProfileRouteFiles)};`,
              `        var moderationRouteFiles = ${JSON.stringify(moderationRouteFiles)};`,
              `        var siteMapRouteFiles = ${JSON.stringify(siteMapRouteFiles)};`,
              `        var accessibilityRouteFiles = ${JSON.stringify(accessibilityRouteFiles)};`,
              `        var homeRouteFiles = ${JSON.stringify(homeRouteFiles)};`,
              '        var routeFiles = /^\\/domaine\\/[a-z0-9-]{4,120}\\/?$/.test(pathname)',
              '          ? domainRouteFiles',
              '          : /^\\/site\\/[a-z0-9-]{4,120}\\/?$/.test(pathname)',
              '            ? siteRouteFiles',
              "            : pathname === '/plan-du-site' || pathname === '/plan-du-site/'",
              '              ? siteMapRouteFiles',
              "              : pathname === '/accessibilite' || pathname === '/accessibilite/'",
              '                ? accessibilityRouteFiles',
              "                : pathname === '/moderation' || pathname.startsWith('/moderation/')",
              '                  ? moderationRouteFiles',
              '                  : homeRouteFiles;',
              '        for (var index = 0; index < routeFiles.length; index += 1) {',
              '          var href = routeFiles[index];',
              '          if (document.querySelector(\'link[rel="modulepreload"][href="\' + href + \'"]\')) {',
              '            continue;',
              '          }',
              '          var link = document.createElement("link");',
              '          link.rel = "modulepreload";',
              '          link.crossOrigin = "";',
              '          link.href = href;',
              '          document.head.appendChild(link);',
              '        }',
              '      })();',
              '    </script>',
            ].join('\n')
          : ''
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

      if (routeModulePreloadScript) {
        html = html.replace(
          /(\s*<script type="module" crossorigin src="[^"]+"><\/script>)/,
          `\n${routeModulePreloadScript}$1`,
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
