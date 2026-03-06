const DEFAULT_PUBLIC_APP_URL = 'https://rgaa-vitrine.org'

function resolveBaseUrl(input) {
  if (typeof input !== 'string' || !input.trim()) {
    return DEFAULT_PUBLIC_APP_URL
  }

  try {
    return new URL(input).origin
  } catch {
    return DEFAULT_PUBLIC_APP_URL
  }
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function toIsoDate(value) {
  const parsed = Date.parse(value)
  if (Number.isNaN(parsed)) {
    return new Date().toISOString()
  }

  return new Date(parsed).toISOString()
}

function serializeUrlEntry(baseUrl, entry) {
  const absoluteUrl = new URL(entry.path, `${baseUrl}/`).toString()
  const lastModified = toIsoDate(entry.lastModified)
  const lines = [
    '  <url>',
    `    <loc>${escapeXml(absoluteUrl)}</loc>`,
    `    <lastmod>${escapeXml(lastModified)}</lastmod>`,
  ]

  if (entry.changeFrequency) {
    lines.push(`    <changefreq>${escapeXml(entry.changeFrequency)}</changefreq>`)
  }

  if (typeof entry.priority === 'number') {
    lines.push(`    <priority>${entry.priority.toFixed(1)}</priority>`)
  }

  lines.push('  </url>')
  return lines.join('\n')
}

export function resolvePublicAppUrl() {
  return resolveBaseUrl(process.env.PUBLIC_APP_URL ?? process.env.VITE_PUBLIC_SITE_URL)
}

export function buildSitemapXml(baseUrl, entries) {
  const rows = entries.map((entry) => serializeUrlEntry(baseUrl, entry)).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${rows}
</urlset>`
}
