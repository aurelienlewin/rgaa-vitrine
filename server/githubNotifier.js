import { isIP } from 'node:net'

const DEFAULT_GITHUB_API_BASE_URL = 'https://api.github.com'
const GITHUB_NOTIFY_TIMEOUT_MS = 8_000

function isPrivateIpLiteral(host) {
  const version = isIP(host)
  if (version === 4) {
    const parts = host.split('.').map((part) => Number.parseInt(part, 10))
    if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
      return true
    }

    const [a, b] = parts
    return (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    )
  }

  if (version === 6) {
    const normalized = host.toLowerCase()
    return (
      normalized === '::1' ||
      normalized === '::' ||
      normalized.startsWith('fc') ||
      normalized.startsWith('fd') ||
      normalized.startsWith('fe8') ||
      normalized.startsWith('fe9') ||
      normalized.startsWith('fea') ||
      normalized.startsWith('feb')
    )
  }

  return false
}

function parseGithubApiBaseUrl(rawValue) {
  const candidate =
    typeof rawValue === 'string' && rawValue.trim()
      ? rawValue.trim()
      : DEFAULT_GITHUB_API_BASE_URL

  let parsed
  try {
    parsed = new URL(candidate)
  } catch {
    return {
      valid: false,
      reason: 'invalid GITHUB_API_URL (expected an absolute HTTPS URL).',
    }
  }

  if (parsed.protocol !== 'https:') {
    return {
      valid: false,
      reason: 'invalid GITHUB_API_URL protocol (HTTPS required).',
    }
  }

  if (parsed.username || parsed.password) {
    return {
      valid: false,
      reason: 'invalid GITHUB_API_URL (credentials in URL are not allowed).',
    }
  }

  const hostname = parsed.hostname.trim().toLowerCase()
  if (
    !hostname ||
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    isPrivateIpLiteral(hostname)
  ) {
    return {
      valid: false,
      reason: 'invalid GITHUB_API_URL host (public HTTPS host required).',
    }
  }

  parsed.hash = ''
  parsed.search = ''
  const normalizedPath = parsed.pathname.replace(/\/+$/, '')

  return {
    valid: true,
    url: `${parsed.origin}${normalizedPath}`,
  }
}

function readGithubNotifierConfig() {
  const token = (
    process.env.GITHUB_NOTIFY_TOKEN ??
    process.env.RGAA_NOTIFY_TOKEN ??
    ''
  ).trim()
  const repo = (process.env.GITHUB_NOTIFY_REPO ?? process.env.RGAA_NOTIFY_REPO ?? '').trim()

  if (!token || !repo) {
    return null
  }

  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) {
    console.error('GitHub notifier disabled: invalid GITHUB_NOTIFY_REPO format (expected owner/repo).')
    return null
  }

  const labels = (process.env.GITHUB_NOTIFY_LABELS ?? 'moderation')
    .split(',')
    .map((label) => label.trim())
    .filter(Boolean)
    .slice(0, 8)

  const appBaseUrl = (process.env.PUBLIC_APP_URL ?? process.env.APP_BASE_URL ?? '').trim().replace(/\/+$/, '')
  const apiBaseUrlResult = parseGithubApiBaseUrl(process.env.GITHUB_API_URL)
  if (!apiBaseUrlResult.valid) {
    console.error(`GitHub notifier disabled: ${apiBaseUrlResult.reason}`)
    return null
  }

  return {
    token,
    repo,
    labels,
    appBaseUrl,
    apiBaseUrl: apiBaseUrlResult.url,
  }
}

const githubNotifierConfig = readGithubNotifierConfig()

function markdownEscapeInline(value) {
  return String(value)
    .replace(/[\\`*_{}\[\]()#+\-.!|>]/g, '\\$&')
    .trim()
}

function neutralizeGithubMentions(value) {
  return String(value).replace(/@/g, '@\u200b')
}

function compactText(value) {
  return String(value).replace(/\s+/g, ' ').trim()
}

function truncate(value, maxLength) {
  if (value.length <= maxLength) {
    return value
  }
  return `${value.slice(0, Math.max(0, maxLength - 1))}…`
}

async function readJsonSafely(response) {
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''
  const rawBody = await response.text()

  if (!rawBody.trim()) {
    return {}
  }

  if (!contentType.includes('application/json')) {
    return {}
  }

  try {
    return JSON.parse(rawBody)
  } catch {
    return {}
  }
}

function buildPendingModerationIssuePayload(entry) {
  const shortSubmissionId = truncate(markdownEscapeInline(neutralizeGithubMentions(entry.submissionId)), 18)
  const safeTitle = truncate(markdownEscapeInline(neutralizeGithubMentions(compactText(entry.siteTitle || 'Site sans titre'))), 90)
  const safeUrl = truncate(markdownEscapeInline(neutralizeGithubMentions(compactText(entry.normalizedUrl || 'N/A'))), 250)
  const safeCategory = truncate(markdownEscapeInline(neutralizeGithubMentions(compactText(entry.category || 'Autre'))), 40)
  const safeStatus = truncate(
    markdownEscapeInline(neutralizeGithubMentions(compactText(entry.complianceStatusLabel || 'Niveau inconnu'))),
    80,
  )
  const safeScore =
    typeof entry.complianceScore === 'number' && Number.isFinite(entry.complianceScore)
      ? `${entry.complianceScore}%`
      : 'N/A'
  const safeReason = truncate(
    markdownEscapeInline(neutralizeGithubMentions(compactText(entry.reviewReason || 'Non précisé'))),
    300,
  )
  const safeCreatedAt = truncate(
    markdownEscapeInline(neutralizeGithubMentions(compactText(entry.createdAt || new Date().toISOString()))),
    80,
  )
  const moderationUrl = githubNotifierConfig?.appBaseUrl
    ? `${githubNotifierConfig.appBaseUrl}/moderation`
    : '/moderation'

  const title = `[Modération RGAA] ${safeTitle} • ${shortSubmissionId}`
  const body = [
    '<!-- annuaire-rgaa:pending-moderation -->',
    `Une soumission nécessite une validation manuelle dans l’annuaire RGAA.`,
    '',
    `- **submissionId**: \`${shortSubmissionId}\``,
    `- **Site**: ${safeTitle}`,
    `- **URL**: ${safeUrl}`,
    `- **Catégorie**: ${safeCategory}`,
    `- **Conformité détectée**: ${safeStatus}`,
    `- **Score**: ${safeScore}`,
    `- **Raison de revue manuelle**: ${safeReason}`,
    `- **Créée le**: ${safeCreatedAt}`,
    '',
    `Accès modération: ${moderationUrl}`,
  ].join('\n')

  return { title, body }
}

function buildApprovedPublicationIssuePayload(entry) {
  const safeTitle = truncate(
    markdownEscapeInline(neutralizeGithubMentions(compactText(entry.siteTitle || 'Site sans titre'))),
    90,
  )
  const safeUrl = truncate(
    markdownEscapeInline(neutralizeGithubMentions(compactText(entry.normalizedUrl || 'N/A'))),
    250,
  )
  const safeCategory = truncate(
    markdownEscapeInline(neutralizeGithubMentions(compactText(entry.category || 'Autre'))),
    40,
  )
  const safeStatus = truncate(
    markdownEscapeInline(neutralizeGithubMentions(compactText(entry.complianceStatusLabel || 'Niveau inconnu'))),
    80,
  )
  const safeScore =
    typeof entry.complianceScore === 'number' && Number.isFinite(entry.complianceScore)
      ? `${entry.complianceScore}%`
      : 'N/A'
  const safePublishedAt = truncate(
    markdownEscapeInline(neutralizeGithubMentions(compactText(entry.updatedAt || new Date().toISOString()))),
    80,
  )
  const safeProfilePath = truncate(
    markdownEscapeInline(neutralizeGithubMentions(compactText(entry.profilePath || 'N/A'))),
    160,
  )
  const moderationUrl = githubNotifierConfig?.appBaseUrl
    ? `${githubNotifierConfig.appBaseUrl}/moderation`
    : '/moderation'

  const title = `[Publication RGAA] ${safeTitle}`
  const body = [
    '<!-- annuaire-rgaa:auto-approved-publication -->',
    'Publication automatique informative. Aucune action de modération n’est requise.',
    '',
    `- **Site**: ${safeTitle}`,
    `- **URL**: ${safeUrl}`,
    `- **Catégorie**: ${safeCategory}`,
    `- **Conformité détectée**: ${safeStatus}`,
    `- **Score**: ${safeScore}`,
    `- **Publiée le**: ${safePublishedAt}`,
    `- **Fiche publique**: ${safeProfilePath}`,
    '',
    `Accès modération: ${moderationUrl}`,
  ].join('\n')

  return { title, body }
}

export function isGithubNotifierEnabled() {
  return Boolean(githubNotifierConfig)
}

async function createGithubIssue({ title, body }) {
  if (!githubNotifierConfig) {
    return { enabled: false, notified: false }
  }

  const fetchOptions = {
    method: 'POST',
    headers: {
      authorization: `Bearer ${githubNotifierConfig.token}`,
      accept: 'application/vnd.github+json',
      'content-type': 'application/json',
      'x-github-api-version': '2022-11-28',
      'user-agent': 'annuaire-rgaa-notifier/1.0',
    },
    body: JSON.stringify({
      title,
      body,
      labels: githubNotifierConfig.labels,
    }),
  }

  if (typeof AbortSignal?.timeout === 'function') {
    fetchOptions.signal = AbortSignal.timeout(GITHUB_NOTIFY_TIMEOUT_MS)
  }

  let response
  try {
    response = await fetch(`${githubNotifierConfig.apiBaseUrl}/repos/${githubNotifierConfig.repo}/issues`, fetchOptions)
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`GitHub notifier timeout after ${GITHUB_NOTIFY_TIMEOUT_MS}ms`)
    }
    throw error
  }

  const payload = await readJsonSafely(response)

  if (!response.ok) {
    const message =
      typeof payload?.message === 'string' ? payload.message : `HTTP ${response.status} lors de la création d’issue`
    throw new Error(`GitHub notifier error: ${message}`)
  }

  return {
    enabled: true,
    notified: true,
    issueUrl: typeof payload?.html_url === 'string' ? payload.html_url : null,
  }
}

export async function notifyPendingModerationOnGithub(entry) {
  return createGithubIssue(buildPendingModerationIssuePayload(entry))
}

export async function notifyApprovedPublicationOnGithub(entry) {
  return createGithubIssue(buildApprovedPublicationIssuePayload(entry))
}
