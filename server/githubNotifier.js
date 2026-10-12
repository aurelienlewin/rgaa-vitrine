import { isIP } from 'node:net'
import {
  buildDomainGroupSlug,
  readRegistrableDomain,
  resolveDomainGroupPath,
} from './domainGroups.js'

const DEFAULT_GITHUB_API_BASE_URL = 'https://api.github.com'
const GITHUB_NOTIFY_TIMEOUT_MS = 8_000
const PENDING_MODERATION_LABELS = ['moderation-required', 'review-needed']
const APPROVED_PUBLICATION_LABELS = ['auto-publication', 'info-only']
const SUBMISSION_FAILURE_LABELS = ['submission-failure', 'bug']
const ANALYSIS_FALLBACK_LABEL = 'analysis-fallback'
const ANALYSIS_FALLBACK_REASON_MARKER = 'analyse automatique impossible'
const SUBMISSION_FAILURE_STAGE_LABELS = {
  preview: 'Pré-analyse',
  confirmation: 'Confirmation de l’envoi',
}
const SUBMISSION_FAILURE_SOURCE_LABELS = {
  server: 'Serveur (erreur identifiée par l’API)',
  client: 'Navigateur (réponse API absente ou inexploitable)',
}

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

function sanitizeIssueText(value, maxLength, fallback = 'N/A') {
  const compactValue = compactText(value ?? '')
  const safeValue = neutralizeGithubMentions(compactValue || fallback)
  return truncate(safeValue, maxLength)
}

function sanitizeIssueUrl(value) {
  if (typeof value !== 'string' || !value.trim()) {
    return null
  }

  try {
    const parsed = new URL(value.trim())
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return null
    }
    return parsed.toString()
  } catch {
    return null
  }
}

function normalizeForMatch(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function resolveAppUrl(pathOrUrl) {
  if (typeof pathOrUrl !== 'string' || !pathOrUrl.trim()) {
    return null
  }

  if (/^https?:\/\//i.test(pathOrUrl)) {
    return sanitizeIssueUrl(pathOrUrl)
  }

  if (!pathOrUrl.startsWith('/')) {
    return null
  }

  if (!githubNotifierConfig?.appBaseUrl) {
    return pathOrUrl
  }

  return `${githubNotifierConfig.appBaseUrl}${pathOrUrl}`
}

function buildDomainPageUrl(normalizedUrl) {
  if (typeof normalizedUrl !== 'string' || !normalizedUrl.trim()) {
    return null
  }

  const registrableDomain = readRegistrableDomain(normalizedUrl)
  if (!registrableDomain) {
    return null
  }

  const groupSlug = buildDomainGroupSlug(registrableDomain)
  const groupPath = resolveDomainGroupPath(groupSlug)
  return groupPath ? resolveAppUrl(groupPath) : null
}

function formatIssueDate(dateValue) {
  const parsedTimestamp = Date.parse(typeof dateValue === 'string' ? dateValue : '')
  const resolvedDate = Number.isFinite(parsedTimestamp) ? new Date(parsedTimestamp) : new Date()
  const iso = resolvedDate.toISOString()

  const parisDate = new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'full',
    timeStyle: 'long',
    timeZone: 'Europe/Paris',
  }).format(resolvedDate)

  const utcDate = new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'full',
    timeStyle: 'long',
    timeZone: 'UTC',
  }).format(resolvedDate)

  return {
    iso,
    parisDate,
    utcDate,
  }
}

function toIssueLinkLine(label, url, fallbackLabel) {
  if (!url) {
    return `- **${label}**: ${fallbackLabel}`
  }

  return `- **${label}**: <${url}>`
}

function mergeIssueLabels(baseLabels, contextualLabels = []) {
  const labels = []
  const seen = new Set()

  for (const rawLabel of [...baseLabels, ...contextualLabels]) {
    if (typeof rawLabel !== 'string') {
      continue
    }
    const label = rawLabel.trim()
    if (!label || seen.has(label.toLowerCase())) {
      continue
    }
    seen.add(label.toLowerCase())
    labels.push(label)
    if (labels.length >= 12) {
      break
    }
  }

  return labels
}

function readCategorizationInsights(reviewReason) {
  const normalizedReason = normalizeForMatch(reviewReason)
  const hasExternalSensitiveSignal = normalizedReason.includes('categorisation externe sensible detectee')
  const hasBlocklistProjectSource = normalizedReason.includes('source blocklist project')

  const labels = []
  if (normalizedReason.includes(ANALYSIS_FALLBACK_REASON_MARKER)) {
    labels.push(ANALYSIS_FALLBACK_LABEL)
  }
  if (hasExternalSensitiveSignal) {
    labels.push('sensitive-category')
  }
  if (hasBlocklistProjectSource) {
    labels.push('source-blocklist-project')
  }

  const rawReason = compactText(reviewReason ?? '')
  const highlights = []
  if (rawReason) {
    const regex = /Catégorisation externe sensible détectée[^.]*\.\s*Source [^.]*\./gi
    let match = regex.exec(rawReason)
    while (match) {
      highlights.push(sanitizeIssueText(match[0], 280, 'N/A'))
      match = regex.exec(rawReason)
    }
  }

  return {
    hasExternalSensitiveSignal,
    hasBlocklistProjectSource,
    labels,
    highlights: highlights.slice(0, 2),
  }
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
  const shortSubmissionId = sanitizeIssueText(entry.submissionId, 24)
  const safeTitle = sanitizeIssueText(entry.siteTitle, 90, 'Site sans titre')
  const safeCategory = sanitizeIssueText(entry.category, 40, 'Autre')
  const safeStatus = sanitizeIssueText(entry.complianceStatusLabel, 80, 'Niveau inconnu')
  const safeScore =
    typeof entry.complianceScore === 'number' && Number.isFinite(entry.complianceScore)
      ? `${entry.complianceScore}%`
      : 'N/A'
  const safeReason = sanitizeIssueText(entry.reviewReason, 400, 'Non précisé')
  const categorizationInsights = readCategorizationInsights(entry.reviewReason)
  const createdAt = formatIssueDate(entry.createdAt)
  const siteUrl = sanitizeIssueUrl(entry.normalizedUrl)
  const declarationUrl = sanitizeIssueUrl(entry.accessibilityPageUrl)
  const domainUrl = buildDomainPageUrl(entry.normalizedUrl)
  const moderationUrl = resolveAppUrl('/moderation')

  const title = `[MODERATION REQUISE] ${safeTitle} - ${shortSubmissionId}`
  const body = [
    '<!-- annuaire-rgaa:pending-moderation -->',
    '## Nouvelle soumission en attente de modération',
    '',
    '> Statut: ACTION REQUISE',
    '>',
    '> Cette issue nécessite une intervention de modération.',
    '',
    '### Horodatage',
    `- **Créée (Europe/Paris)**: ${createdAt.parisDate}`,
    `- **Créée (UTC)**: ${createdAt.utcDate}`,
    `- **ISO 8601**: \`${createdAt.iso}\``,
    '',
    '### Résumé',
    `- **Submission ID**: \`${shortSubmissionId}\``,
    `- **Site**: ${safeTitle}`,
    `- **Catégorie**: ${safeCategory}`,
    `- **Conformité détectée**: ${safeStatus}`,
    `- **Score**: ${safeScore}`,
    `- **Motif de revue manuelle**: ${safeReason}`,
    '',
    '### Catégorisation sensible',
    `- **Signal externe détecté**: ${categorizationInsights.hasExternalSensitiveSignal ? 'Oui' : 'Non'}`,
    `- **Source Blocklist Project**: ${categorizationInsights.hasBlocklistProjectSource ? 'Oui' : 'Non'}`,
    ...categorizationInsights.highlights.map((highlight) => `- **Extrait**: ${highlight}`),
    '',
    '### Liens utiles',
    toIssueLinkLine('Site soumis', siteUrl, 'URL invalide ou indisponible'),
    toIssueLinkLine('Déclaration d’accessibilité', declarationUrl, 'Non détectée'),
    toIssueLinkLine('Page domaine', domainUrl, 'Domaine introuvable ou lien non résolu'),
    toIssueLinkLine('Console de modération', moderationUrl, 'PUBLIC_APP_URL non configurée'),
    '',
  ].join('\n')

  return {
    title,
    body,
    labels: mergeIssueLabels(
      githubNotifierConfig?.labels ?? [],
      [...PENDING_MODERATION_LABELS, ...categorizationInsights.labels],
    ),
  }
}

function buildApprovedPublicationIssuePayload(entry) {
  const safeTitle = sanitizeIssueText(entry.siteTitle, 90, 'Site sans titre')
  const safeCategory = sanitizeIssueText(entry.category, 40, 'Autre')
  const safeStatus = sanitizeIssueText(entry.complianceStatusLabel, 80, 'Niveau inconnu')
  const safeScore =
    typeof entry.complianceScore === 'number' && Number.isFinite(entry.complianceScore)
      ? `${entry.complianceScore}%`
      : 'N/A'
  const publishedAt = formatIssueDate(entry.updatedAt)
  const siteUrl = sanitizeIssueUrl(entry.normalizedUrl)
  const declarationUrl = sanitizeIssueUrl(entry.accessibilityPageUrl)
  const domainUrl = buildDomainPageUrl(entry.normalizedUrl)
  const profileUrl = resolveAppUrl(typeof entry.profilePath === 'string' ? entry.profilePath : '')
  const moderationUrl = resolveAppUrl('/moderation')

  const title = `[INFO PUBLICATION AUTO] ${safeTitle}`
  const body = [
    '<!-- annuaire-rgaa:auto-approved-publication -->',
    '## Publication automatique informative',
    '',
    '> Statut: INFORMATIF UNIQUEMENT',
    '>',
    '> Aucune action de modération n’est requise. Cette issue conserve les liens de suivi.',
    '',
    '### Horodatage',
    `- **Publiée (Europe/Paris)**: ${publishedAt.parisDate}`,
    `- **Publiée (UTC)**: ${publishedAt.utcDate}`,
    `- **ISO 8601**: \`${publishedAt.iso}\``,
    '',
    '### Résumé',
    '',
    `- **Site**: ${safeTitle}`,
    `- **Catégorie**: ${safeCategory}`,
    `- **Conformité détectée**: ${safeStatus}`,
    `- **Score**: ${safeScore}`,
    '',
    '### Liens utiles',
    toIssueLinkLine('Site publié', siteUrl, 'URL invalide ou indisponible'),
    toIssueLinkLine('Déclaration d’accessibilité', declarationUrl, 'Non détectée'),
    toIssueLinkLine('Page domaine', domainUrl, 'Domaine introuvable ou lien non résolu'),
    toIssueLinkLine('Fiche publique', profileUrl, 'Lien fiche indisponible'),
    toIssueLinkLine('Console de modération', moderationUrl, 'PUBLIC_APP_URL non configurée'),
    '',
  ].join('\n')

  return {
    title,
    body,
    labels: mergeIssueLabels(githubNotifierConfig?.labels ?? [], APPROVED_PUBLICATION_LABELS),
  }
}

function buildSubmissionFailureIssuePayload(failure) {
  const stripBackticks = (value) => value.replace(/`/g, "'")
  const safeReference = stripBackticks(sanitizeIssueText(failure.reference, 40))
  const safeHost = sanitizeIssueText(failure.host, 120, 'Hôte inconnu')
  const safeInputUrl = stripBackticks(sanitizeIssueText(failure.inputUrl, 300, 'Non transmise'))
  const safeCode = stripBackticks(sanitizeIssueText(failure.errorCode, 60, 'unknown'))
  const safeMessage = sanitizeIssueText(failure.message, 400, 'Non précisé')
  const safeStage = SUBMISSION_FAILURE_STAGE_LABELS[failure.stage] ?? 'Inconnue'
  const safeSource = SUBMISSION_FAILURE_SOURCE_LABELS[failure.source] ?? 'Inconnue'
  const safeStatus =
    typeof failure.statusCode === 'number' && Number.isFinite(failure.statusCode) ? `${failure.statusCode}` : 'N/A'
  const safeUserAgent = sanitizeIssueText(failure.userAgent, 200, 'Non transmis')
  const occurredAt = formatIssueDate(failure.occurredAt)
  const siteUrl = sanitizeIssueUrl(failure.siteUrl)
  const moderationUrl = resolveAppUrl('/moderation')

  const title = `[ÉCHEC SOUMISSION] ${safeHost} - ${safeCode}`
  const body = [
    '<!-- annuaire-rgaa:submission-failure -->',
    '## Soumission de site non aboutie',
    '',
    '> Statut: À ANALYSER',
    '>',
    '> Un utilisateur n’a pas pu soumettre ce site. Les alertes identiques (même hôte et même cause) sont regroupées pendant une fenêtre de déduplication.',
    '',
    '### Horodatage',
    `- **Survenue (Europe/Paris)**: ${occurredAt.parisDate}`,
    `- **Survenue (UTC)**: ${occurredAt.utcDate}`,
    `- **ISO 8601**: \`${occurredAt.iso}\``,
    '',
    '### Diagnostic',
    `- **Référence affichée à l’utilisateur**: \`${safeReference}\``,
    `- **Étape**: ${safeStage}`,
    `- **Origine du signalement**: ${safeSource}`,
    `- **Code de cause**: \`${safeCode}\``,
    `- **Statut HTTP renvoyé**: ${safeStatus}`,
    `- **Message affiché**: ${safeMessage}`,
    `- **URL saisie**: \`${safeInputUrl}\``,
    `- **Navigateur**: ${safeUserAgent}`,
    '',
    '### Liens utiles',
    toIssueLinkLine('Site concerné', siteUrl, 'URL invalide ou indisponible'),
    toIssueLinkLine('Console de modération', moderationUrl, 'PUBLIC_APP_URL non configurée'),
    '',
    '### Pistes de résolution',
    '- Vérifier que le site répond publiquement (statut HTTP, certificat, pare-feu applicatif).',
    '- Si le site bloque les robots, l’ajouter manuellement depuis la console de modération.',
    '- Si la cause est interne (`internal-error`, `storage-unavailable`), consulter les journaux serveur à l’horodatage indiqué.',
    '',
  ].join('\n')

  return {
    title,
    body,
    labels: mergeIssueLabels(githubNotifierConfig?.labels ?? [], SUBMISSION_FAILURE_LABELS),
  }
}

export function isGithubNotifierEnabled() {
  return Boolean(githubNotifierConfig)
}

export class GithubNotifierError extends Error {
  constructor(message, statusCode = 502) {
    super(message)
    this.name = 'GithubNotifierError'
    this.statusCode = statusCode
  }
}

async function githubRequest(method, path, body) {
  const fetchOptions = {
    method,
    headers: {
      authorization: `Bearer ${githubNotifierConfig.token}`,
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      'user-agent': 'annuaire-rgaa-notifier/1.0',
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  }

  if (typeof AbortSignal?.timeout === 'function') {
    fetchOptions.signal = AbortSignal.timeout(GITHUB_NOTIFY_TIMEOUT_MS)
  }

  let response
  try {
    response = await fetch(`${githubNotifierConfig.apiBaseUrl}/repos/${githubNotifierConfig.repo}${path}`, fetchOptions)
  } catch (error) {
    if (error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError')) {
      throw new GithubNotifierError(`GitHub notifier timeout after ${GITHUB_NOTIFY_TIMEOUT_MS}ms`, 504)
    }
    throw error
  }

  const payload = await readJsonSafely(response)
  if (!response.ok) {
    const message = typeof payload?.message === 'string' ? payload.message : `HTTP ${response.status}`
    throw new GithubNotifierError(`GitHub notifier error: ${message}`, response.status === 404 ? 404 : 502)
  }

  return payload
}

async function createGithubIssue({ title, body, labels }) {
  if (!githubNotifierConfig) {
    return { enabled: false, notified: false }
  }

  const payload = await githubRequest('POST', '/issues', {
    title,
    body,
    labels: Array.isArray(labels) && labels.length > 0 ? labels : githubNotifierConfig.labels,
  })

  return {
    enabled: true,
    notified: true,
    issueUrl: typeof payload?.html_url === 'string' ? payload.html_url : null,
  }
}

const NOTIFIER_ISSUE_MARKERS = {
  'submission-failure': '<!-- annuaire-rgaa:submission-failure -->',
  'pending-moderation': '<!-- annuaire-rgaa:pending-moderation -->',
  'auto-approved-publication': '<!-- annuaire-rgaa:auto-approved-publication -->',
}
// Issues opened before body markers existed are recognised by their title prefix.
const LEGACY_NOTIFIER_TITLE_PREFIXES = {
  '[Modération RGAA]': 'pending-moderation',
  '[Publication RGAA]': 'auto-approved-publication',
}
const MAX_NOTIFIER_ISSUE_PAGES = 5
const NOTIFIER_ISSUES_PER_PAGE = 100
export const MAX_NOTIFIER_ISSUES_PER_CLOSE = 50

function readNotifierIssueKind(issue) {
  const body = typeof issue?.body === 'string' ? issue.body : ''
  for (const [kind, marker] of Object.entries(NOTIFIER_ISSUE_MARKERS)) {
    if (body.includes(marker)) {
      return kind
    }
  }
  const title = typeof issue?.title === 'string' ? issue.title : ''
  for (const [prefix, kind] of Object.entries(LEGACY_NOTIFIER_TITLE_PREFIXES)) {
    if (title.startsWith(prefix)) {
      return kind
    }
  }
  return null
}

function toNotifierIssueSummary(issue, kind) {
  return {
    number: issue.number,
    title: typeof issue.title === 'string' ? issue.title : `Issue #${issue.number}`,
    kind,
    state: issue.state === 'closed' ? 'closed' : 'open',
    createdAt: typeof issue.created_at === 'string' ? issue.created_at : null,
    url: sanitizeIssueUrl(issue.html_url),
    labels: Array.isArray(issue.labels)
      ? issue.labels.map((label) => (typeof label === 'string' ? label : label?.name)).filter(Boolean).slice(0, 12)
      : [],
  }
}

// Lists open issues created by this notifier only (marker or legacy title); pull requests are excluded.
export async function listNotifierIssues() {
  if (!githubNotifierConfig) {
    return { enabled: false, issues: [] }
  }

  const issues = []
  for (let page = 1; page <= MAX_NOTIFIER_ISSUE_PAGES; page += 1) {
    const batch = await githubRequest(
      'GET',
      `/issues?state=open&sort=created&direction=desc&per_page=${NOTIFIER_ISSUES_PER_PAGE}&page=${page}`,
    )
    if (!Array.isArray(batch) || batch.length === 0) {
      break
    }
    for (const issue of batch) {
      if (issue?.pull_request || !Number.isInteger(issue?.number)) {
        continue
      }
      const kind = readNotifierIssueKind(issue)
      if (kind) {
        issues.push(toNotifierIssueSummary(issue, kind))
      }
    }
    if (batch.length < NOTIFIER_ISSUES_PER_PAGE) {
      break
    }
  }

  return { enabled: true, repo: githubNotifierConfig.repo, issues }
}

// Closes one issue after re-reading it: anything not created by this notifier is refused.
export async function closeNotifierIssue(number, stateReason = 'completed') {
  if (!githubNotifierConfig) {
    throw new GithubNotifierError('Notifications GitHub non configurées.', 503)
  }

  const issue = await githubRequest('GET', `/issues/${number}`)
  if (issue?.pull_request) {
    throw new GithubNotifierError('Cette référence désigne une pull request, pas une issue.', 400)
  }
  const kind = readNotifierIssueKind(issue)
  if (!kind) {
    throw new GithubNotifierError('Issue non créée par le notificateur de l’annuaire : fermeture refusée.', 403)
  }
  if (issue.state === 'closed') {
    return { ...toNotifierIssueSummary(issue, kind), alreadyClosed: true }
  }

  const closed = await githubRequest('PATCH', `/issues/${number}`, {
    state: 'closed',
    state_reason: stateReason === 'not_planned' ? 'not_planned' : 'completed',
  })
  return { ...toNotifierIssueSummary(closed, kind), alreadyClosed: false }
}

export async function notifyPendingModerationOnGithub(entry) {
  return createGithubIssue(buildPendingModerationIssuePayload(entry))
}

export async function notifyApprovedPublicationOnGithub(entry) {
  return createGithubIssue(buildApprovedPublicationIssuePayload(entry))
}

export async function notifySubmissionFailureOnGithub(failure) {
  return createGithubIssue(buildSubmissionFailureIssuePayload(failure))
}
