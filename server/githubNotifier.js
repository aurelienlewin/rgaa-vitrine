function readGithubNotifierConfig() {
  const token = (
    process.env.GITHUB_NOTIFY_TOKEN ??
    process.env.RGAA_NOTIFY_TOKEN ??
    process.env.GITHUB_TOKEN ??
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
  const apiBaseUrl = (process.env.GITHUB_API_URL ?? 'https://api.github.com').trim().replace(/\/+$/, '')

  return {
    token,
    repo,
    labels,
    appBaseUrl,
    apiBaseUrl,
  }
}

const githubNotifierConfig = readGithubNotifierConfig()

function markdownEscapeInline(value) {
  return String(value)
    .replace(/[\\`*_{}\[\]()#+\-.!|>]/g, '\\$&')
    .trim()
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

function buildIssuePayload(entry) {
  const shortSubmissionId = truncate(markdownEscapeInline(entry.submissionId), 18)
  const safeTitle = truncate(markdownEscapeInline(compactText(entry.siteTitle || 'Site sans titre')), 90)
  const safeUrl = truncate(markdownEscapeInline(compactText(entry.normalizedUrl || 'N/A')), 250)
  const safeCategory = truncate(markdownEscapeInline(compactText(entry.category || 'Autre')), 40)
  const safeStatus = truncate(markdownEscapeInline(compactText(entry.complianceStatusLabel || 'Niveau inconnu')), 80)
  const safeScore =
    typeof entry.complianceScore === 'number' && Number.isFinite(entry.complianceScore)
      ? `${entry.complianceScore}%`
      : 'N/A'
  const safeReason = truncate(markdownEscapeInline(compactText(entry.reviewReason || 'Non précisé')), 300)
  const safeCreatedAt = truncate(markdownEscapeInline(compactText(entry.createdAt || new Date().toISOString())), 80)
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

export function isGithubNotifierEnabled() {
  return Boolean(githubNotifierConfig)
}

export async function notifyPendingModerationOnGithub(entry) {
  if (!githubNotifierConfig) {
    return { enabled: false, notified: false }
  }

  const { title, body } = buildIssuePayload(entry)

  const response = await fetch(`${githubNotifierConfig.apiBaseUrl}/repos/${githubNotifierConfig.repo}/issues`, {
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
  })

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
