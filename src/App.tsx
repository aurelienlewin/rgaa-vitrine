import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent, MouseEvent as ReactMouseEvent, RefObject } from 'react'
import ThemeToggle from './ThemeToggle'
import type { DomainContext, DomainStatusSummary } from './domainGroups'
import { resolveDomainGroupPath, normalizeDomainContext } from './domainGroups'
import {
  focusElementWithScroll,
  focusTargetClass,
  focusTargetScrollMarginClass,
  useHashTargetFocus,
} from './hashNavigation'
import { applySeo, createAbsoluteUrl } from './seo'
import { resolveShowcaseProfilePath } from './siteProfiles'
import SiteFooter from './SiteFooter'
import GlobalSearchForm from './GlobalSearchForm'
import PrimaryNavigation from './PrimaryNavigation'
import { visuallyHiddenStyle } from './visuallyHidden'
import {
  formatCategory,
  readStatusFilterFromQuery,
  showcaseCategories,
} from './showcaseFilters'
import type { ShowcaseStatusFilter } from './showcaseFilters'

type ComplianceStatus = 'full' | 'partial' | 'none' | null
type RgaaBaseline = '4.1' | '5.0-ready'

type ShowcaseEntry = {
  normalizedUrl: string
  siteHost?: string | null
  siteOrigin?: string | null
  registrableDomain?: string | null
  slug?: string
  profilePath?: string
  domainGroupSlug?: string | null
  domainGroupPath?: string | null
  domainContext?: DomainContext | null
  siteTitle: string
  thumbnailUrl: string | null
  accessibilityPageUrl: string | null
  hasAccessibilityPage?: boolean
  complianceStatus: ComplianceStatus
  complianceStatusLabel: string | null
  complianceScore: number | null
  rgaaBaseline: RgaaBaseline
  upvoteCount: number
  hasUpvoted: boolean
  votesBlocked: boolean
  updatedAt: string
  category: string
}

type DirectoryGroupItem = {
  kind: 'group'
  groupSlug: string
  groupPath: string
  registrableDomain: string
  matchingSiteCount: number
  totalSiteCount: number
  updatedAt: string
  primaryEntry: ShowcaseEntry | null
  primaryProfilePath: string | null
  primaryTitle: string | null
  statusSummary: DomainStatusSummary
  children: ShowcaseEntry[]
}

type DirectoryItem =
  | {
      kind: 'site'
      entry: ShowcaseEntry
    }
  | DirectoryGroupItem

type DirectorySortOption = 'latest' | 'earliest' | 'score-desc' | 'score-asc'

type SubmissionStatus = 'approved' | 'duplicate' | 'pending'
type SubmissionFeedbackKind = 'duplicate' | 'already-pending'
type SubmissionFeedback = {
  id: number
  entry: ShowcaseEntry
  message: string
  kind: SubmissionFeedbackKind
}
type SubmitErrorPhase = 'preview' | 'submit'
type SubmitErrorState = {
  id: number
  summary: string
  guidance: string
  detail: string | null
}

const statusClassByValue: Record<Exclude<ComplianceStatus, null>, string> = {
  full: 'border border-emerald-700 bg-emerald-100 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-100',
  partial: 'border border-amber-700 bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-100',
  none: 'border border-rose-700 bg-rose-100 dark:bg-rose-950 text-rose-900 dark:text-rose-100',
}

const publicSubmissionCategoryFallback = 'Autre'
const publicSubmissionCategoryByNormalized = new Map(
  showcaseCategories.map((category) => [normalizeText(category), category]),
)
publicSubmissionCategoryByNormalized.set(
  normalizeText('Cooperative et services'),
  'Coopérative et services',
)

const officialResources = [
  {
    label: 'Article : RGAA 5 arrive fin 2026 (État)',
    url: 'https://design.numerique.gouv.fr/articles/2026-03-02-rgaa5/',
  },
  {
    label: 'Guide du développeur RGAA',
    url: 'https://disic.github.io/guide-developpeur/',
  },
  {
    label: "Guide de l’intégrateur RGAA",
    url: 'https://disic.github.io/guide-integrateur/',
  },
  {
    label: 'Mémo dev',
    url: 'https://design.numerique.gouv.fr/outils/memo-dev/',
  },
  {
    label: 'Checklist dev',
    url: 'https://design.numerique.gouv.fr/outils/checklist-dev/',
  },
  {
    label: 'Bibliothèque de référence ARIA',
    url: 'https://www.info.gouv.fr/accessibilite/developpement/bibliotheque-de-reference-des-restitutions-des-composants-javascript-aria',
  },
  {
    label: 'Guide des composants JavaScript accessibles',
    url: 'https://www.info.gouv.fr/accessibilite/developpement/le-guide-des-composants-javascript-accessibles',
  },
]

const wcagResources = [
  {
    label: "WCAG 2 - Vue d’ensemble (français)",
    url: 'https://www.w3.org/WAI/standards-guidelines/wcag/fr',
  },
  {
    label: 'WCAG 2.2 - Quoi de neuf',
    url: 'https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/',
  },
  {
    label: 'WCAG 2.2 - Référence rapide (QuickRef)',
    url: 'https://www.w3.org/WAI/WCAG22/quickref/',
  },
]

const githubProfile = {
  name: 'Aurélien Lewin',
  login: 'aurelienlewin',
  avatarUrl: 'https://avatars.githubusercontent.com/u/45093822?v=4',
  profileUrl: 'https://github.com/aurelienlewin',
}

const focusRingClass =
  'focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-brand-focus'
const ctaHoverClass = 'transition-colors duration-150 hover:underline'
const ctaNeutralClass = `border border-slate-700 dark:border-slate-300 bg-transparent text-slate-900 dark:text-slate-50 hover:bg-slate-100 dark:hover:bg-slate-800 ${ctaHoverClass}`
const ctaPrimaryClass = `border border-slate-950 dark:border-slate-50 bg-slate-950 dark:bg-slate-50 text-slate-50 dark:text-slate-950 hover:bg-slate-800 dark:hover:bg-slate-200 ${ctaHoverClass}`
const ctaSkyClass = `border border-sky-700 dark:border-sky-300 bg-transparent text-sky-900 dark:text-sky-100 hover:bg-sky-50 dark:hover:bg-sky-950 ${ctaHoverClass}`
const ctaConfirmClass = `border border-sky-800 dark:border-sky-200 bg-sky-800 dark:bg-sky-200 text-sky-50 dark:text-sky-950 hover:bg-sky-900 dark:hover:bg-sky-100 ${ctaHoverClass}`
const ctaEmeraldClass = `border border-emerald-700 dark:border-emerald-300 bg-transparent text-emerald-900 dark:text-emerald-100 hover:bg-emerald-50 dark:hover:bg-emerald-950 ${ctaHoverClass}`
const moderationContactPath = '/accessibilite#contact-accessibilite'
const moderationContactEmail = 'mailto:aurelienlewin@proton.me'
const skipLinksContainerClass =
  'fixed start-2 top-2 z-60 flex max-w-[calc(100vw-1rem)] -translate-y-[120%] flex-col items-start gap-2 transition-transform duration-150 motion-reduce:transition-none focus-within:translate-y-0 sm:start-4 sm:top-4 sm:max-w-none'
const skipLinkClass = `inline-flex min-h-11 items-center rounded-lg border border-slate-900 bg-slate-950 px-3 py-2 text-slate-50 underline decoration-2 underline-offset-2 shadow-lg dark:border-slate-50 dark:bg-slate-50 dark:text-slate-950 ${focusRingClass}`
const TILE_BATCH_SIZE = 24
const CLIENT_VOTER_ID_STORAGE_KEY = 'annuaire-rgaa-voter-id'
const defaultDirectorySort: DirectorySortOption = 'latest'
const directorySortOptions: Array<{
  value: DirectorySortOption
  label: string
  summaryLabel: string
}> = [
  {
    value: 'latest',
    label: 'Plus récentes d’abord',
    summaryLabel: 'plus récentes d’abord',
  },
  {
    value: 'earliest',
    label: 'Plus anciennes d’abord',
    summaryLabel: 'plus anciennes d’abord',
  },
  {
    value: 'score-desc',
    label: 'Score le plus élevé',
    summaryLabel: 'score le plus élevé d’abord',
  },
  {
    value: 'score-asc',
    label: 'Score le plus faible',
    summaryLabel: 'score le plus faible d’abord',
  },
]
const statsValueClass =
  'mt-1 inline-flex min-h-8 min-w-[3ch] items-end text-2xl font-bold [font-variant-numeric:tabular-nums]'

function formatDate(value: string) {
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(new Date(value))
}

function formatScore(value: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 'N/A'
  }

  const localized = new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value)

  return `${localized}%`
}

function formatSubmissionStatusLabel(value: SubmissionStatus | null) {
  if (value === 'approved') {
    return 'Publication probable'
  }
  if (value === 'pending') {
    return 'Validation manuelle probable'
  }
  if (value === 'duplicate') {
    return 'Déjà référencé'
  }
  return 'En attente d’analyse'
}

function normalizeRgaaBaseline(value: unknown): RgaaBaseline {
  if (value === '5.0-ready') {
    return '5.0-ready'
  }
  return '4.1'
}

function getRgaaBadgePresentation(baseline: RgaaBaseline) {
  if (baseline === '5.0-ready') {
    return {
      shortLabel: 'RGAA 5.0 prêt',
      ariaLabel: 'RGAA 5.0 prêt',
      description:
        'Le site mentionne une préparation au référentiel RGAA 5.0 sur sa déclaration d’accessibilité.',
      className:
        'border border-cyan-700 bg-cyan-100 dark:bg-cyan-950 text-cyan-900 dark:text-cyan-100',
    }
  }

  return {
    shortLabel: 'RGAA 4.1',
    ariaLabel: 'RGAA 4.1',
    description:
      'Le site indique une conformité basée sur le référentiel RGAA 4.1 (ou 4.1.2).',
    className:
      'border border-sky-700 bg-sky-100 dark:bg-sky-950 text-sky-900 dark:text-sky-100',
  }
}

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function normalizeCategoryInput(value: string) {
  const trimmed = value.trim()
  if (!trimmed) {
    return showcaseCategories[0]
  }

  return trimmed.slice(0, 60)
}

function normalizePublicSubmissionCategory(value: string) {
  const normalized = normalizeText(value.trim())
  return publicSubmissionCategoryByNormalized.get(normalized) ?? publicSubmissionCategoryFallback
}

function readDirectorySortFromQuery(value: string | null): DirectorySortOption {
  if (value === 'earliest' || value === 'score-desc' || value === 'score-asc') {
    return value
  }
  return defaultDirectorySort
}

function toDomSafeIdSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 120)
}

function normalizeShowcaseEntry(entry: ShowcaseEntry): ShowcaseEntry {
  return {
    ...entry,
    slug:
      typeof entry.slug === 'string' && /^[a-z0-9-]{4,120}$/.test(entry.slug)
        ? entry.slug
        : undefined,
    profilePath: resolveShowcaseProfilePath(entry.normalizedUrl, entry.slug),
    rgaaBaseline: normalizeRgaaBaseline(entry.rgaaBaseline),
    upvoteCount:
      typeof entry.upvoteCount === 'number' && Number.isFinite(entry.upvoteCount) && entry.upvoteCount >= 0
        ? Math.floor(entry.upvoteCount)
        : 0,
    hasUpvoted: entry.hasUpvoted === true,
    votesBlocked: entry.votesBlocked === true,
    registrableDomain:
      typeof entry.registrableDomain === 'string' && entry.registrableDomain.trim()
        ? entry.registrableDomain.trim().toLowerCase()
        : null,
    domainGroupSlug:
      typeof entry.domainGroupSlug === 'string' && /^[a-z0-9-]{4,120}$/.test(entry.domainGroupSlug)
        ? entry.domainGroupSlug
        : null,
    domainGroupPath:
      typeof entry.domainGroupPath === 'string' && entry.domainGroupPath.startsWith('/')
        ? entry.domainGroupPath
        : null,
    domainContext: normalizeDomainContext(entry.domainContext),
  }
}

function compareDomainChildEntries(left: ShowcaseEntry, right: ShowcaseEntry) {
  const leftRole = left.domainContext?.role ?? 'standalone'
  const rightRole = right.domainContext?.role ?? 'standalone'
  const leftWeight = leftRole === 'primary' ? 0 : leftRole === 'child' ? 1 : 2
  const rightWeight = rightRole === 'primary' ? 0 : rightRole === 'child' ? 1 : 2

  if (leftWeight !== rightWeight) {
    return leftWeight - rightWeight
  }

  const leftUpdatedAt = Date.parse(left.updatedAt)
  const rightUpdatedAt = Date.parse(right.updatedAt)
  if (!Number.isNaN(leftUpdatedAt) && !Number.isNaN(rightUpdatedAt) && leftUpdatedAt !== rightUpdatedAt) {
    return rightUpdatedAt - leftUpdatedAt
  }

  return left.siteTitle.localeCompare(right.siteTitle, 'fr')
}

function buildStatusSummaryFromEntries(entries: ShowcaseEntry[]): DomainStatusSummary {
  return entries.reduce<DomainStatusSummary>(
    (summary, entry) => {
      if (entry.complianceStatus === 'full') {
        summary.full += 1
        return summary
      }
      if (entry.complianceStatus === 'partial') {
        summary.partial += 1
        return summary
      }
      if (entry.complianceStatus === 'none') {
        summary.none += 1
        return summary
      }

      summary.unknown += 1
      return summary
    },
    {
      full: 0,
      partial: 0,
      none: 0,
      unknown: 0,
    },
  )
}

function buildDirectoryItems(entries: ShowcaseEntry[]): DirectoryItem[] {
  const groupsBySlug = new Map<string, ShowcaseEntry[]>()
  const standaloneEntries: ShowcaseEntry[] = []

  for (const entry of entries) {
    const domainContext = entry.domainContext
    if (domainContext && domainContext.siteCount > 1 && domainContext.groupSlug) {
      const currentGroup = groupsBySlug.get(domainContext.groupSlug) ?? []
      currentGroup.push(entry)
      groupsBySlug.set(domainContext.groupSlug, currentGroup)
      continue
    }

    standaloneEntries.push(entry)
  }

  const items: DirectoryItem[] = standaloneEntries.map((entry) => ({
    kind: 'site',
    entry,
  }))

  for (const [groupSlug, children] of groupsBySlug.entries()) {
    const sortedChildren = [...children].sort(compareDomainChildEntries)
    const firstEntry = sortedChildren[0]
    const domainContext = firstEntry?.domainContext
    if (!firstEntry || !domainContext) {
      continue
    }

    const matchingSiteCount = sortedChildren.length
    const totalSiteCount = Math.max(domainContext.siteCount, matchingSiteCount)
    const primaryEntry =
      sortedChildren.find((entry) => entry.domainContext?.role === 'primary') ?? sortedChildren[0]

    items.push({
      kind: 'group',
      groupSlug,
      groupPath: domainContext.groupPath ?? resolveDomainGroupPath(groupSlug),
      registrableDomain: domainContext.registrableDomain,
      matchingSiteCount,
      totalSiteCount,
      updatedAt: sortedChildren.reduce((latest, entry) => {
        const latestTimestamp = Date.parse(latest)
        const entryTimestamp = Date.parse(entry.updatedAt)
        if (Number.isNaN(entryTimestamp)) {
          return latest
        }
        if (Number.isNaN(latestTimestamp) || entryTimestamp > latestTimestamp) {
          return entry.updatedAt
        }
        return latest
      }, sortedChildren[0]?.updatedAt ?? new Date().toISOString()),
      primaryEntry,
      primaryProfilePath: domainContext.primarySitePath ?? primaryEntry.profilePath ?? null,
      primaryTitle: domainContext.primarySiteTitle ?? primaryEntry.siteTitle,
      statusSummary: buildStatusSummaryFromEntries(sortedChildren),
      children: sortedChildren,
    })
  }

  return items
}

function getDirectoryItemUpdatedTimestamp(item: DirectoryItem) {
  const rawValue = item.kind === 'site' ? item.entry.updatedAt : item.updatedAt
  const timestamp = Date.parse(rawValue)
  return Number.isNaN(timestamp) ? null : timestamp
}

function getDirectoryItemScore(item: DirectoryItem) {
  const score = item.kind === 'site' ? item.entry.complianceScore : item.primaryEntry?.complianceScore ?? null
  return typeof score === 'number' && Number.isFinite(score) ? score : null
}

function getDirectoryItemLabel(item: DirectoryItem) {
  return item.kind === 'site' ? item.entry.siteTitle : item.primaryEntry?.siteTitle ?? item.registrableDomain
}

function compareNullableNumbers(left: number | null, right: number | null, direction: 'asc' | 'desc') {
  if (left === null && right === null) {
    return 0
  }
  if (left === null) {
    return 1
  }
  if (right === null) {
    return -1
  }

  return direction === 'asc' ? left - right : right - left
}

function sortDirectoryItems(items: DirectoryItem[], sortOrder: DirectorySortOption) {
  return [...items].sort((left, right) => {
    if (sortOrder === 'latest' || sortOrder === 'earliest') {
      const byTimestamp = compareNullableNumbers(
        getDirectoryItemUpdatedTimestamp(left),
        getDirectoryItemUpdatedTimestamp(right),
        sortOrder === 'earliest' ? 'asc' : 'desc',
      )
      if (byTimestamp !== 0) {
        return byTimestamp
      }
    } else {
      const byScore = compareNullableNumbers(
        getDirectoryItemScore(left),
        getDirectoryItemScore(right),
        sortOrder === 'score-asc' ? 'asc' : 'desc',
      )
      if (byScore !== 0) {
        return byScore
      }

      const byTimestamp = compareNullableNumbers(
        getDirectoryItemUpdatedTimestamp(left),
        getDirectoryItemUpdatedTimestamp(right),
        'desc',
      )
      if (byTimestamp !== 0) {
        return byTimestamp
      }
    }

    return getDirectoryItemLabel(left).localeCompare(getDirectoryItemLabel(right), 'fr')
  })
}

function describeDomainContext(domainContext: DomainContext | null | undefined) {
  if (!domainContext) {
    return null
  }

  const publishedCount = domainContext.publishedSiteCount ?? domainContext.siteCount
  const pendingCount = domainContext.pendingSiteCount ?? 0
  if (publishedCount <= 0 && pendingCount <= 0) {
    return null
  }

  const parts = []
  if (publishedCount > 0) {
    parts.push(`${publishedCount} fiche(s) publiée(s)`)
  }
  if (pendingCount > 0) {
    parts.push(`${pendingCount} soumission(s) en attente`)
  }

  return `Le domaine ${domainContext.registrableDomain} compte déjà ${parts.join(' et ')}.`
}

function buildDirectorySummaryText({
  visibleCardCount,
  totalCardCount,
  filteredEntryCount,
  totalEntryCount,
  sortLabel,
}: {
  visibleCardCount: number
  totalCardCount: number
  filteredEntryCount: number
  totalEntryCount: number
  sortLabel: string
}) {
  const usesGrouping = filteredEntryCount !== totalCardCount || totalEntryCount !== totalCardCount

  if (usesGrouping) {
    const entryLabel =
      filteredEntryCount === totalEntryCount
        ? `${totalEntryCount} fiche(s) référencée(s)`
        : `${filteredEntryCount} fiche(s) filtrée(s), ${totalEntryCount} fiche(s) référencée(s) au total`
    const cardLabel =
      visibleCardCount === totalCardCount
        ? `${totalCardCount} carte(s) après regroupement par domaine`
        : `${visibleCardCount} carte(s) affichée(s) sur ${totalCardCount} après regroupement par domaine`

    return `${entryLabel}, ${cardLabel}. Tri actuel : ${sortLabel}.`
  }

  if (filteredEntryCount === totalEntryCount) {
    return `${visibleCardCount} fiche(s) affichée(s) sur ${totalEntryCount} fiche(s) référencée(s). Tri actuel : ${sortLabel}.`
  }

  return `${visibleCardCount} fiche(s) affichée(s) sur ${filteredEntryCount} fiche(s) filtrée(s), ${totalEntryCount} fiche(s) référencée(s) au total. Tri actuel : ${sortLabel}.`
}

function createClientVoterId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `voter_${crypto.randomUUID().replace(/-/g, '_')}`
  }

  const randomPart = Math.random().toString(36).slice(2)
  const timestampPart = Date.now().toString(36)
  return `voter_${timestampPart}_${randomPart}`.slice(0, 80)
}

function isShowcaseEntry(payload: unknown): payload is ShowcaseEntry {
  if (!payload || typeof payload !== 'object') {
    return false
  }

  const candidate = payload as Record<string, unknown>
  return (
    typeof candidate.normalizedUrl === 'string' &&
    typeof candidate.siteTitle === 'string' &&
    typeof candidate.updatedAt === 'string' &&
    typeof candidate.category === 'string'
  )
}

function readSubmissionStatus(payload: Record<string, unknown>) {
  const rawStatus = payload.submissionStatus
  if (rawStatus === 'approved' || rawStatus === 'duplicate' || rawStatus === 'pending') {
    return rawStatus as SubmissionStatus
  }
  return null
}

function readSubmissionMessage(payload: Record<string, unknown>) {
  return typeof payload.message === 'string' ? payload.message : null
}

function readAlreadySubmittedFlag(payload: Record<string, unknown>) {
  return payload.alreadySubmitted === true
}

function readPreviewToken(payload: Record<string, unknown>) {
  return typeof payload.previewToken === 'string' && /^[a-zA-Z0-9_-]{16,120}$/.test(payload.previewToken)
    ? payload.previewToken
    : null
}

function buildSubmitErrorState(rawMessage: string, phase: SubmitErrorPhase): Omit<SubmitErrorState, 'id'> {
  const fallbackMessage = phase === 'preview' ? 'Pré-analyse impossible.' : 'Ajout impossible.'
  const message = typeof rawMessage === 'string' && rawMessage.trim() ? rawMessage.trim() : fallbackMessage
  const normalized = normalizeText(message)

  if (
    normalized.includes('function_invocation_timeout') ||
    normalized.includes('a expire') ||
    normalized.includes('timeout') ||
    normalized.includes('timed out')
  ) {
    return {
      summary:
        phase === 'preview'
          ? 'La pré-analyse du site prend plus de temps que prévu.'
          : "L'ajout du site prend plus de temps que prévu.",
      guidance:
        "Réessayez dans quelques instants. Si le problème persiste, contactez la modération avec l'URL concernée.",
      detail: message,
    }
  }

  if (
    normalized.includes('reponse html recue') ||
    normalized.includes('reponse json invalide du serveur') ||
    normalized.includes('reponse serveur non json')
  ) {
    return {
      summary: "Le service d'ajout a renvoyé une réponse inattendue.",
      guidance:
        "Réessayez plus tard. Si le problème continue, transmettez les détails techniques à la modération.",
      detail: message,
    }
  }

  if (
    normalized.includes('erreur reseau') ||
    normalized.includes('networkerror') ||
    normalized.includes('failed to fetch')
  ) {
    return {
      summary: "La connexion avec le service d'ajout a échoué.",
      guidance: "Vérifiez votre connexion puis réessayez. Si besoin, revenez dans quelques minutes.",
      detail: message,
    }
  }

  if (
    normalized.includes('veuillez saisir une url complete') ||
    normalized.includes('format url non reconnu') ||
    normalized.includes('url invalide') ||
    normalized.includes('champ url est obligatoire')
  ) {
    return {
      summary: 'Veuillez saisir une URL complète, par exemple https://www.exemple.fr.',
      guidance: "Corrigez le champ URL puis relancez l'analyse.",
      detail: null,
    }
  }

  if (
    normalized.includes('le site a repondu avec le statut') ||
    normalized.includes("impossible de recuperer les metadonnees de ce site") ||
    normalized.includes("la recuperation du site a expire") ||
    normalized.includes('contenu cible n')
  ) {
    return {
      summary: "Le site n'a pas pu être analysé pour le moment.",
      guidance: "Vérifiez que l'URL est publique et accessible, puis réessayez.",
      detail: message,
    }
  }

  if (
    normalized.includes('pre-analyse impossible') ||
    normalized.includes('ajout impossible') ||
    normalized.includes("erreur interne lors de l'analyse")
  ) {
    return {
      summary:
        phase === 'preview'
          ? "La pré-analyse du site n'a pas abouti."
          : "Le site n'a pas pu être ajouté pour le moment.",
      guidance:
        "Réessayez dans quelques instants. Si le problème persiste, contactez la modération avec l'URL concernée.",
      detail: message,
    }
  }

  return {
    summary: message,
    guidance: "Vous pouvez corriger les informations puis relancer l'analyse.",
    detail: null,
  }
}

async function readApiPayload(response: Response) {
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''
  const rawBody = await response.text()

  if (!rawBody.trim()) {
    return {}
  }

  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(rawBody) as Record<string, unknown>
    } catch {
      return { error: 'Réponse JSON invalide du serveur.' }
    }
  }

  const compactBody = rawBody.trim().replace(/\s+/g, ' ')
  if (/<!doctype html|<html[\s>]/i.test(compactBody)) {
    return {
      error:
        'Réponse HTML reçue à la place de JSON API. Vérifiez le routage des endpoints /api/*.',
    }
  }
  return { error: compactBody.slice(0, 220) || 'Réponse serveur non JSON.' }
}

function App() {
  const [inputUrl, setInputUrl] = useState('')
  const [inputCategory, setInputCategory] = useState(showcaseCategories[0])
  const [websiteField, setWebsiteField] = useState('')
  const [isPreAnalyzing, setIsPreAnalyzing] = useState(false)
  const [isConfirmingSubmission, setIsConfirmingSubmission] = useState(false)
  const [loadingDirectory, setLoadingDirectory] = useState(true)
  const [directoryErrorMessage, setDirectoryErrorMessage] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<SubmitErrorState | null>(null)
  const [submitInfoMessage, setSubmitInfoMessage] = useState<string | null>(null)
  const [submissionFeedback, setSubmissionFeedback] = useState<SubmissionFeedback | null>(null)
  const [isSubmitConfirmationStep, setIsSubmitConfirmationStep] = useState(false)
  const [submissionPreviewEntry, setSubmissionPreviewEntry] = useState<ShowcaseEntry | null>(null)
  const [submissionPreviewStatus, setSubmissionPreviewStatus] = useState<SubmissionStatus | null>(null)
  const [submissionPreviewToken, setSubmissionPreviewToken] = useState<string | null>(null)
  const [lastAddedEntry, setLastAddedEntry] = useState<ShowcaseEntry | null>(null)
  const [showcaseEntries, setShowcaseEntries] = useState<ShowcaseEntry[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<ShowcaseStatusFilter>('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [directorySort, setDirectorySort] = useState<DirectorySortOption>(defaultDirectorySort)
  const [visibleTilesCount, setVisibleTilesCount] = useState(TILE_BATCH_SIZE)
  const [upvotePendingByUrl, setUpvotePendingByUrl] = useState<Record<string, boolean>>({})
  const [politeAnnouncement, setPoliteAnnouncement] = useState({ id: 0, message: '' })
  const [assertiveAnnouncement, setAssertiveAnnouncement] = useState({ id: 0, message: '' })
  const mainContentRef = useRef<HTMLElement | null>(null)
  const primaryNavigationRef = useRef<HTMLElement | null>(null)
  const directorySectionRef = useRef<HTMLElement | null>(null)
  const formSectionRef = useRef<HTMLElement | null>(null)
  const helpSectionRef = useRef<HTMLElement | null>(null)
  const footerRef = useRef<HTMLElement | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const urlInputRef = useRef<HTMLInputElement | null>(null)
  const resultsSummaryRef = useRef<HTMLParagraphElement | null>(null)
  const directoryErrorRef = useRef<HTMLParagraphElement | null>(null)
  const submitErrorRef = useRef<HTMLParagraphElement | null>(null)
  const submitInfoRef = useRef<HTMLParagraphElement | null>(null)
  const duplicateFeedbackRef = useRef<HTMLElement | null>(null)
  const submitConfirmationRef = useRef<HTMLElement | null>(null)
  const confirmSubmissionButtonRef = useRef<HTMLButtonElement | null>(null)
  const lastAddedRef = useRef<HTMLElement | null>(null)
  const loadMoreButtonRef = useRef<HTMLButtonElement | null>(null)
  const tilesSentinelRef = useRef<HTMLDivElement | null>(null)
  const clientVoterIdRef = useRef<string>('')
  const shouldFocusResultsAfterQueryInitRef = useRef(false)
  const shouldSyncVoteStateAfterDirectoryLoadRef = useRef(false)

  const announcePolite = useCallback((message: string) => {
    setPoliteAnnouncement((current) => ({ id: current.id + 1, message }))
  }, [])

  const announceAssertive = useCallback((message: string) => {
    setAssertiveAnnouncement((current) => ({ id: current.id + 1, message }))
  }, [])

  const getClientVoterId = useCallback(() => {
    if (clientVoterIdRef.current) {
      return clientVoterIdRef.current
    }

    try {
      const stored = window.localStorage.getItem(CLIENT_VOTER_ID_STORAGE_KEY)
      if (stored && /^[a-zA-Z0-9_-]{16,120}$/.test(stored)) {
        clientVoterIdRef.current = stored
        return stored
      }
    } catch {
      // Fall through to a fresh in-memory identifier.
    }

    const voterId = createClientVoterId()

    try {
      window.localStorage.setItem(CLIENT_VOTER_ID_STORAGE_KEY, voterId)
    } catch {
      // Keep the generated identifier for the current session even if persistence fails.
    }

    clientVoterIdRef.current = voterId
    return voterId
  }, [])

  const focusElement = useCallback((element: HTMLElement | null) => {
    focusElementWithScroll(element)
  }, [])

  const handleSkipLinkClick = useCallback(
    (event: ReactMouseEvent<HTMLAnchorElement>, ref: RefObject<HTMLElement | null>) => {
      const href = event.currentTarget.getAttribute('href')
      if (!href || !href.startsWith('#')) {
        return
      }

      window.setTimeout(() => {
        const fallbackTarget = document.getElementById(href.slice(1))
        focusElement(ref.current ?? fallbackTarget)
      }, 0)
    },
    [focusElement],
  )
  const resolveHashTarget = useCallback(
    (targetId: string) => {
      if (targetId === 'moteur-recherche-global') {
        return searchInputRef.current
      }

      if (targetId === 'ajout-site') {
        return urlInputRef.current
      }

      return document.getElementById(targetId)
    },
    [],
  )
  useHashTargetFocus(focusElement, resolveHashTarget)

  const syncFiltersInUrl = useCallback((filters: {
    query: string
    status: ShowcaseStatusFilter
    category: string
    sort: DirectorySortOption
  }) => {
    if (typeof window === 'undefined') {
      return
    }

    const trimmedQuery = filters.query.trim()
    const currentUrl = new URL(window.location.href)
    if (trimmedQuery) {
      currentUrl.searchParams.set('recherche', trimmedQuery)
    } else {
      currentUrl.searchParams.delete('recherche')
    }
    if (filters.status === 'all') {
      currentUrl.searchParams.delete('statut')
    } else {
      currentUrl.searchParams.set('statut', filters.status)
    }
    if (filters.category === 'all') {
      currentUrl.searchParams.delete('categorie')
    } else {
      currentUrl.searchParams.set('categorie', filters.category)
    }
    if (filters.sort === defaultDirectorySort) {
      currentUrl.searchParams.delete('tri')
    } else {
      currentUrl.searchParams.set('tri', filters.sort)
    }

    const nextRelativeUrl = `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`
    const currentRelativeUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`
    if (nextRelativeUrl !== currentRelativeUrl) {
      window.history.replaceState({}, '', nextRelativeUrl)
    }
  }, [])

  const handleResetFilters = useCallback(() => {
    setSearchQuery('')
    setStatusFilter('all')
    setCategoryFilter('all')
    syncFiltersInUrl({ query: '', status: 'all', category: 'all', sort: directorySort })
    announcePolite('Filtres réinitialisés.')
    searchInputRef.current?.focus()
  }, [announcePolite, directorySort, syncFiltersInUrl])

  const filteredShowcaseEntries = useMemo(() => {
    const normalizedQuery = normalizeText(searchQuery.trim())

    return showcaseEntries.filter((entry) => {
      const statusMatch = statusFilter === 'all' || entry.complianceStatus === statusFilter
      const categoryMatch = categoryFilter === 'all' || entry.category === categoryFilter

      if (!statusMatch || !categoryMatch) {
        return false
      }

      if (!normalizedQuery) {
        return true
      }

      const searchable = normalizeText(
        `${entry.siteTitle} ${entry.normalizedUrl} ${entry.category} ${entry.complianceStatusLabel ?? ''}`,
      )
      return searchable.includes(normalizedQuery)
    })
  }, [categoryFilter, searchQuery, showcaseEntries, statusFilter])

  const activeDirectorySort =
    directorySortOptions.find((option) => option.value === directorySort) ?? directorySortOptions[0]

  const filteredDirectoryItems = useMemo(
    () => sortDirectoryItems(buildDirectoryItems(filteredShowcaseEntries), directorySort),
    [directorySort, filteredShowcaseEntries],
  )

  const availableCategoryOptions = useMemo(() => {
    const options = new Set(showcaseCategories)
    for (const entry of showcaseEntries) {
      const normalized = normalizeCategoryInput(entry.category)
      if (normalized) {
        options.add(normalized)
      }
    }

    return Array.from(options).sort((left, right) => left.localeCompare(right, 'fr'))
  }, [showcaseEntries])

  const categoryFilterOptions = useMemo(
    () =>
      availableCategoryOptions.map((category) => ({
        value: category,
        label: formatCategory(category),
      })),
    [availableCategoryOptions],
  )

  const visibleDirectoryItems = useMemo(
    () => filteredDirectoryItems.slice(0, visibleTilesCount),
    [filteredDirectoryItems, visibleTilesCount],
  )

  const hasMoreTiles = visibleTilesCount < filteredDirectoryItems.length
  const directorySummaryText = useMemo(
    () =>
      buildDirectorySummaryText({
        visibleCardCount: visibleDirectoryItems.length,
        totalCardCount: filteredDirectoryItems.length,
        filteredEntryCount: filteredShowcaseEntries.length,
        totalEntryCount: showcaseEntries.length,
        sortLabel: activeDirectorySort.summaryLabel,
      }),
    [
      activeDirectorySort.summaryLabel,
      filteredDirectoryItems.length,
      filteredShowcaseEntries.length,
      showcaseEntries.length,
      visibleDirectoryItems.length,
    ],
  )

  const handleSearchSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      syncFiltersInUrl({ query: searchQuery, status: statusFilter, category: categoryFilter, sort: directorySort })
      const nextVisibleCardCount = Math.min(filteredDirectoryItems.length, TILE_BATCH_SIZE)
      announcePolite(
        `Recherche appliquée. ${buildDirectorySummaryText({
          visibleCardCount: nextVisibleCardCount,
          totalCardCount: filteredDirectoryItems.length,
          filteredEntryCount: filteredShowcaseEntries.length,
          totalEntryCount: showcaseEntries.length,
          sortLabel: activeDirectorySort.summaryLabel,
        })}`,
      )
      focusElement(resultsSummaryRef.current)
    },
    [
      activeDirectorySort.summaryLabel,
      announcePolite,
      categoryFilter,
      directorySort,
      filteredDirectoryItems.length,
      filteredShowcaseEntries.length,
      focusElement,
      searchQuery,
      showcaseEntries.length,
      statusFilter,
      syncFiltersInUrl,
    ],
  )

  const handleDirectorySortChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      const nextSort = readDirectorySortFromQuery(event.target.value)
      setDirectorySort(nextSort)
      syncFiltersInUrl({
        query: searchQuery,
        status: statusFilter,
        category: categoryFilter,
        sort: nextSort,
      })
    },
    [categoryFilter, searchQuery, statusFilter, syncFiltersInUrl],
  )

  const directoryStats = useMemo(() => {
    const full = showcaseEntries.filter((entry) => entry.complianceStatus === 'full').length
    const partial = showcaseEntries.filter((entry) => entry.complianceStatus === 'partial').length
    const none = showcaseEntries.filter((entry) => entry.complianceStatus === 'none').length

    return {
      total: showcaseEntries.length,
      full,
      partial,
      none,
    }
  }, [showcaseEntries])
  const submissionDomainDescription = describeDomainContext(submissionPreviewEntry?.domainContext)
  const lastAddedDomainDescription = describeDomainContext(lastAddedEntry?.domainContext)

  const homeStructuredData = useMemo(() => {
    const latestUpdatedTimestamp = showcaseEntries.reduce((currentLatest, entry) => {
      const parsed = Date.parse(entry.updatedAt)
      if (Number.isNaN(parsed)) {
        return currentLatest
      }
      return Math.max(currentLatest, parsed)
    }, 0)
    const latestUpdatedAt =
      latestUpdatedTimestamp > 0 ? new Date(latestUpdatedTimestamp).toISOString() : new Date().toISOString()

    const itemListElements = showcaseEntries.slice(0, 12).map((entry, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: entry.siteTitle,
      item: createAbsoluteUrl(resolveShowcaseProfilePath(entry.normalizedUrl, entry.slug)),
    }))
    const websiteId = createAbsoluteUrl('/#website')
    const organizationId = createAbsoluteUrl('/#organization')
    const creatorId = createAbsoluteUrl('/#creator')
    const collectionId = createAbsoluteUrl('/#collection')
    const homePageId = createAbsoluteUrl('/#webpage')
    const webApplicationId = createAbsoluteUrl('/#webapplication')
    const dataCatalogId = createAbsoluteUrl('/#data-catalog')
    const showcaseDatasetId = createAbsoluteUrl('/#dataset-showcase')

    return {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebSite',
          '@id': websiteId,
          url: createAbsoluteUrl('/'),
          name: 'Annuaire RGAA',
          inLanguage: 'fr-FR',
          description:
            'Annuaire français pour valoriser les sites engagés dans la conformité RGAA et l’accessibilité numérique.',
          publisher: {
            '@id': organizationId,
          },
          potentialAction: {
            '@type': 'SearchAction',
            target: `${createAbsoluteUrl('/')}?recherche={search_term_string}`,
            'query-input': 'required name=search_term_string',
          },
        },
        {
          '@type': 'WebPage',
          '@id': homePageId,
          url: createAbsoluteUrl('/'),
          name: 'Annuaire RGAA | Vitrine française de conformité accessibilité',
          inLanguage: 'fr-FR',
          description:
            'Page d’accueil de l’annuaire RGAA avec recherche, filtres, soumission de site et accès au jeu de données public.',
          isPartOf: {
            '@id': websiteId,
          },
          mainEntity: {
            '@id': collectionId,
          },
          about: [
            {
              '@id': webApplicationId,
            },
            {
              '@id': showcaseDatasetId,
            },
          ],
        },
        {
          '@type': 'WebApplication',
          '@id': webApplicationId,
          name: 'Annuaire RGAA',
          url: createAbsoluteUrl('/'),
          applicationCategory: 'AccessibilityApplication',
          operatingSystem: 'Any',
          browserRequirements: 'Navigateur web moderne avec JavaScript activé pour l’interface complète.',
          inLanguage: 'fr-FR',
          isAccessibleForFree: true,
          offers: {
            '@type': 'Offer',
            price: '0',
            priceCurrency: 'EUR',
          },
          publisher: {
            '@id': organizationId,
          },
          featureList: [
            'Recherche et filtres de sites référencés',
            'Fiches publiques par site avec URL partageable',
            'Téléchargement JSON des données publiques',
            'Repères RGAA et WCAG 2.2',
          ],
        },
        {
          '@type': 'Organization',
          '@id': organizationId,
          name: 'Annuaire RGAA',
          url: createAbsoluteUrl('/'),
          logo: createAbsoluteUrl('/logo-rgaa-vitrine.svg'),
          sameAs: [githubProfile.profileUrl],
        },
        {
          '@type': 'Person',
          '@id': creatorId,
          name: githubProfile.name,
          url: githubProfile.profileUrl,
        },
        {
          '@type': 'CollectionPage',
          '@id': collectionId,
          url: createAbsoluteUrl('/'),
          name: 'Annuaire RGAA',
          inLanguage: 'fr-FR',
          isPartOf: {
            '@id': websiteId,
          },
          mainEntity: {
            '@type': 'ItemList',
            numberOfItems: showcaseEntries.length,
            itemListOrder: 'https://schema.org/ItemListOrderDescending',
            itemListElement: itemListElements,
          },
        },
        {
          '@type': 'DataCatalog',
          '@id': dataCatalogId,
          name: 'Catalogue de données Annuaire RGAA',
          description:
            'Catalogue public des données éditoriales et techniques publiées par Annuaire RGAA pour l’indexation et la réutilisation.',
          url: createAbsoluteUrl('/api/showcase'),
          inLanguage: 'fr-FR',
          creator: {
            '@id': organizationId,
          },
          dataset: [
            {
              '@id': showcaseDatasetId,
            },
          ],
        },
        {
          '@type': 'Dataset',
          '@id': showcaseDatasetId,
          name: 'Vitrine RGAA - données publiques',
          description:
            'Jeu de données public des sites référencés dans l’annuaire RGAA, incluant catégorie et indicateurs de conformité.',
          inLanguage: 'fr-FR',
          isAccessibleForFree: true,
          license: 'https://opensource.org/license/mit/',
          url: createAbsoluteUrl('/api/showcase'),
          dateModified: latestUpdatedAt,
          includedInDataCatalog: {
            '@id': dataCatalogId,
          },
          creator: {
            '@id': organizationId,
          },
          publisher: {
            '@id': organizationId,
          },
          measurementTechnique: [
            'Analyse automatisée de métadonnées publiques',
            'Détection de déclaration d’accessibilité',
            'Revue éditoriale des soumissions publiées',
          ],
          variableMeasured: [
            { '@type': 'PropertyValue', name: 'URL canonique du site référencé' },
            { '@type': 'PropertyValue', name: 'Catégorie éditoriale' },
            { '@type': 'PropertyValue', name: 'Statut de conformité RGAA détecté' },
            { '@type': 'PropertyValue', name: 'Score de conformité détecté' },
            { '@type': 'PropertyValue', name: 'Baseline RGAA appliquée' },
            { '@type': 'PropertyValue', name: 'Date de dernière mise à jour' },
          ],
          keywords: [
            'RGAA',
            'accessibilité numérique',
            'jeu de données public',
            'conformité web',
            'annuaire',
          ],
          distribution: [
            {
              '@type': 'DataDownload',
              contentUrl: createAbsoluteUrl('/api/showcase'),
              encodingFormat: 'application/json',
            },
            {
              '@type': 'DataDownload',
              contentUrl: createAbsoluteUrl('/ai-context.json'),
              encodingFormat: 'application/json',
            },
          ],
        },
      ],
    }
  }, [showcaseEntries])

  useEffect(() => {
    applySeo({
      title: 'Annuaire RGAA | Vitrine française de conformité accessibilité',
      description:
        'Référencez et découvrez des sites engagés en accessibilité numérique avec statut de conformité RGAA et ressources officielles.',
      path: '/',
      structuredData: homeStructuredData,
    })
  }, [homeStructuredData])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const params = new URLSearchParams(window.location.search)
    const initialQuery = params.get('recherche')
    const initialStatus = readStatusFilterFromQuery(params.get('statut'))
    const initialCategory = params.get('categorie') ?? 'all'
    const initialSort = readDirectorySortFromQuery(params.get('tri'))
    shouldFocusResultsAfterQueryInitRef.current =
      Boolean(initialQuery?.trim()) || initialStatus !== 'all' || initialCategory !== 'all' || initialSort !== defaultDirectorySort

    if (initialQuery) {
      setSearchQuery(initialQuery.slice(0, 120))
    }

    setStatusFilter(initialStatus)
    setDirectorySort(initialSort)
    if (initialCategory === 'all' || initialCategory.trim()) {
      setCategoryFilter(initialCategory === 'all' ? 'all' : initialCategory.slice(0, 60))
    }
  }, [])

  useEffect(() => {
    if (loadingDirectory || directoryErrorMessage || !shouldFocusResultsAfterQueryInitRef.current) {
      return
    }

    shouldFocusResultsAfterQueryInitRef.current = false
    window.setTimeout(() => {
      focusElement(resultsSummaryRef.current)
      announcePolite('Paramètres de résultats appliqués depuis l’URL.')
    }, 0)
  }, [announcePolite, directoryErrorMessage, focusElement, loadingDirectory])

  useEffect(() => {
    setVisibleTilesCount(Math.min(TILE_BATCH_SIZE, filteredDirectoryItems.length))
  }, [categoryFilter, directorySort, filteredDirectoryItems.length, searchQuery, statusFilter])

  const handleLoadMoreTiles = useCallback(
    (source: 'button' | 'auto') => {
      if (!hasMoreTiles) {
        return
      }

      setVisibleTilesCount((current) => {
        const next = Math.min(current + TILE_BATCH_SIZE, filteredDirectoryItems.length)
        if (next > current && source === 'button') {
          announcePolite(
            buildDirectorySummaryText({
              visibleCardCount: next,
              totalCardCount: filteredDirectoryItems.length,
              filteredEntryCount: filteredShowcaseEntries.length,
              totalEntryCount: showcaseEntries.length,
              sortLabel: activeDirectorySort.summaryLabel,
            }),
          )
          if (next >= filteredDirectoryItems.length) {
            window.setTimeout(() => {
              focusElement(resultsSummaryRef.current)
            }, 0)
          }
        }
        return next
      })
    },
    [
      activeDirectorySort.summaryLabel,
      announcePolite,
      filteredDirectoryItems.length,
      filteredShowcaseEntries.length,
      focusElement,
      hasMoreTiles,
      showcaseEntries.length,
    ],
  )

  useEffect(() => {
    if (!hasMoreTiles || loadingDirectory || !tilesSentinelRef.current) {
      return
    }

    if (typeof window.IntersectionObserver !== 'function') {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries
        if (entry?.isIntersecting) {
          handleLoadMoreTiles('auto')
        }
      },
      {
        root: null,
        rootMargin: '300px 0px',
        threshold: 0.01,
      },
    )

    observer.observe(tilesSentinelRef.current)

    return () => {
      observer.disconnect()
    }
  }, [handleLoadMoreTiles, hasMoreTiles, loadingDirectory])

  useEffect(() => {
    setPoliteAnnouncement((current) => ({
      id: current.id + 1,
      message: directorySummaryText,
    }))
  }, [directorySummaryText])

  const loadShowcaseEntries = useCallback(async () => {
    setDirectoryErrorMessage(null)
    setLoadingDirectory(true)
    announcePolite('Chargement de l’annuaire en cours.')

    try {
      const response = await fetch('/api/showcase', { credentials: 'omit' })
      const payload = await readApiPayload(response)

      if (!response.ok) {
        throw new Error(typeof payload?.error === 'string' ? payload.error : 'Chargement d’annuaire impossible.')
      }

      if (typeof payload.error === 'string') {
        throw new Error(payload.error)
      }

      const responseEntries = Array.isArray(payload.entries)
        ? payload.entries
        : Array.isArray(payload)
          ? payload
          : Array.isArray((payload as { data?: { entries?: unknown } }).data?.entries)
            ? (payload as { data: { entries: unknown[] } }).data.entries
            : null

      if (!responseEntries) {
        throw new Error('Liste d’annuaire invalide.')
      }

      const parsedEntries = responseEntries.filter(isShowcaseEntry).map((entry) => normalizeShowcaseEntry(entry))
      setShowcaseEntries(parsedEntries)
      shouldSyncVoteStateAfterDirectoryLoadRef.current = parsedEntries.length > 0
      announcePolite(`${parsedEntries.length} fiche(s) chargée(s) dans l’annuaire.`)
    } catch (error) {
      shouldSyncVoteStateAfterDirectoryLoadRef.current = false
      console.error('Unable to load showcase entries', error)
      const localizedMessage = error instanceof Error ? error.message : 'Erreur de chargement de l’annuaire.'
      setDirectoryErrorMessage(localizedMessage)
      announceAssertive(localizedMessage)
    } finally {
      setLoadingDirectory(false)
    }
  }, [announceAssertive, announcePolite])

  useEffect(() => {
    void loadShowcaseEntries()
  }, [loadShowcaseEntries])

  const loadClientVoteState = useCallback(async () => {
    try {
      const voterId = getClientVoterId()
      const response = await fetch(`/api/showcase/vote-state?clientVoterId=${encodeURIComponent(voterId)}`, {
        credentials: 'omit',
      })
      const payload = await readApiPayload(response)

      if (!response.ok) {
        throw new Error(typeof payload?.error === 'string' ? payload.error : 'Chargement des votes impossible.')
      }

      if (typeof payload.error === 'string') {
        throw new Error(payload.error)
      }

      const votedUrls = Array.isArray((payload as { votedUrls?: unknown }).votedUrls)
        ? (payload as { votedUrls: unknown[] }).votedUrls.filter(
            (value): value is string => typeof value === 'string' && value.trim().length > 0,
          )
        : null

      if (!votedUrls) {
        throw new Error('État des votes invalide.')
      }

      const votedUrlSet = new Set(votedUrls)
      setShowcaseEntries((current) =>
        current.map((entry) =>
          ({
            ...entry,
            hasUpvoted: votedUrlSet.has(entry.normalizedUrl),
          }),
        ),
      )
    } catch (error) {
      console.error('Unable to load client vote state', error)
    }
  }, [getClientVoterId])

  useEffect(() => {
    if (loadingDirectory || directoryErrorMessage || !shouldSyncVoteStateAfterDirectoryLoadRef.current) {
      return
    }

    shouldSyncVoteStateAfterDirectoryLoadRef.current = false
    let timeoutId: number | null = null
    let idleId: number | null = null
    let cancelled = false
    const syncVoteState = () => {
      if (cancelled) {
        return
      }
      void loadClientVoteState()
    }

    if (typeof window.requestIdleCallback === 'function') {
      idleId = window.requestIdleCallback(syncVoteState, { timeout: 1800 })
    } else {
      timeoutId = window.setTimeout(syncVoteState, 450)
    }

    return () => {
      cancelled = true
      if (idleId !== null && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(idleId)
      }
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId)
      }
    }
  }, [directoryErrorMessage, loadClientVoteState, loadingDirectory])

  useEffect(() => {
    if (directoryErrorMessage) {
      focusElement(directoryErrorRef.current)
    }
  }, [directoryErrorMessage, focusElement])

  useEffect(() => {
    if (submitError) {
      focusElement(submitErrorRef.current)
    }
  }, [submitError, focusElement])

  useEffect(() => {
    if (submissionFeedback && !submitError) {
      focusElement(duplicateFeedbackRef.current)
    }
  }, [submissionFeedback, focusElement, submitError])

  const isSubmissionBusy = isPreAnalyzing || isConfirmingSubmission

  useEffect(() => {
    if (submitInfoMessage) {
      if (!isSubmitConfirmationStep && !isSubmissionBusy) {
        focusElement(submitInfoRef.current)
      }
    }
  }, [submitInfoMessage, focusElement, isSubmitConfirmationStep, isSubmissionBusy])

  useEffect(() => {
    if (lastAddedEntry) {
      focusElement(lastAddedRef.current)
    }
  }, [focusElement, lastAddedEntry])

  const showSubmitError = useCallback((rawMessage: string, phase: SubmitErrorPhase) => {
    const nextError = buildSubmitErrorState(rawMessage, phase)
    setSubmitError((current) => ({
      id: (current?.id ?? 0) + 1,
      ...nextError,
    }))
  }, [])

  const handleDismissSubmissionFeedback = useCallback(() => {
    const closedMessage =
      submissionFeedback?.kind === 'already-pending'
        ? 'Message “site déjà soumis et en cours de revue” fermé.'
        : 'Message “site déjà référencé” fermé.'
    setSubmissionFeedback(null)
    announcePolite(closedMessage)
    window.setTimeout(() => {
      urlInputRef.current?.focus()
    }, 0)
  }, [announcePolite, submissionFeedback?.kind])

  const handleDismissSubmitError = useCallback(() => {
    setSubmitError(null)
    announcePolite("Message d'erreur fermé. Retour au champ URL.")
    window.setTimeout(() => {
      urlInputRef.current?.focus()
    }, 0)
  }, [announcePolite])

  const handleSubmissionFeedback = useCallback(
    (kind: SubmissionFeedbackKind, entry: ShowcaseEntry, message: string) => {
      setIsSubmitConfirmationStep(false)
      setSubmissionPreviewEntry(null)
      setSubmissionPreviewStatus(null)
      setSubmissionPreviewToken(null)
      setLastAddedEntry(null)
      setSubmitInfoMessage(null)
      setSubmissionFeedback((current) => ({
        id: (current?.id ?? 0) + 1,
        entry,
        message,
        kind,
      }))
      announcePolite(message)
    },
    [announcePolite],
  )

  const handleCancelSubmissionConfirmation = useCallback(() => {
    setIsSubmitConfirmationStep(false)
    setSubmissionPreviewEntry(null)
    setSubmissionPreviewStatus(null)
    setSubmissionPreviewToken(null)
    setSubmitInfoMessage('Vous pouvez modifier les informations avant de confirmer l’envoi.')
    announcePolite('Étape de confirmation annulée. Modifiez les champs puis continuez.')
    window.setTimeout(() => {
      urlInputRef.current?.focus()
    }, 0)
  }, [announcePolite])

  const handleRefreshAfterSuccess = useCallback(() => {
    window.location.reload()
  }, [])

  const handleUpvote = useCallback(
    async (entry: ShowcaseEntry) => {
      if (entry.votesBlocked) {
        announcePolite(`Votes temporairement indisponibles pour ${entry.siteTitle}.`)
        return
      }

      if (upvotePendingByUrl[entry.normalizedUrl]) {
        return
      }

      setUpvotePendingByUrl((current) => ({
        ...current,
        [entry.normalizedUrl]: true,
      }))

      try {
        const response = await fetch('/api/showcase/upvote', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            action: entry.hasUpvoted ? 'remove' : 'upvote',
            normalizedUrl: entry.normalizedUrl,
            clientVoterId: getClientVoterId(),
          }),
        })

        const payload = await readApiPayload(response)
        const apiPayload = payload as Record<string, unknown>
        if (!response.ok) {
          throw new Error(typeof apiPayload.error === 'string' ? apiPayload.error : 'Vote impossible.')
        }

        if (!isShowcaseEntry(payload)) {
          throw new Error('Réponse vote invalide du serveur.')
        }

        const normalizedEntry = normalizeShowcaseEntry(payload)
        setShowcaseEntries((current) =>
          current.map((candidate) =>
            candidate.normalizedUrl === normalizedEntry.normalizedUrl
              ? {
                  ...candidate,
                  ...normalizedEntry,
                }
              : candidate,
          ),
        )

        const responseMessage =
          typeof apiPayload.message === 'string'
            ? apiPayload.message
            : normalizedEntry.hasUpvoted
              ? 'Vote enregistré.'
              : 'Vote retiré pour cette session.'
        announcePolite(`${responseMessage} ${normalizedEntry.upvoteCount} vote(s) au total.`)
      } catch (error) {
        console.error('Unable to register upvote', error)
        const fallback = error instanceof Error ? error.message : 'Erreur réseau lors du vote.'
        announceAssertive(`Impossible d’enregistrer le vote pour ${entry.siteTitle}: ${fallback}`)
      } finally {
        setUpvotePendingByUrl((current) => {
          const next = { ...current }
          delete next[entry.normalizedUrl]
          return next
        })
      }
    },
    [announceAssertive, announcePolite, getClientVoterId, upvotePendingByUrl],
  )

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setSubmitError(null)
    setSubmitInfoMessage(null)
    setLastAddedEntry(null)
    setSubmissionFeedback(null)
    const categoryForSubmission = normalizePublicSubmissionCategory(inputCategory)

    if (!inputUrl.trim()) {
      const message =
        'Veuillez saisir une URL complète, par exemple https://www.exemple.fr, avant de continuer.'
      showSubmitError(message, 'preview')
      return
    }

    setIsPreAnalyzing(true)
    setSubmitInfoMessage('Pré-analyse du site en cours. Merci de patienter.')
    announcePolite('Pré-analyse du site en cours.')

    try {
      const response = await fetch('/api/site-insight?preview=1', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({ url: inputUrl, category: categoryForSubmission, website: websiteField }),
      })

      const payload = await readApiPayload(response)
      const submissionStatus = readSubmissionStatus(payload)
      const submissionMessage = readSubmissionMessage(payload)

      if (!response.ok) {
        throw new Error(typeof payload?.error === 'string' ? payload.error : 'Pré-analyse impossible.')
      }

      if (typeof payload.error === 'string') {
        throw new Error(payload.error)
      }

      if (submissionStatus === 'duplicate') {
        if (!isShowcaseEntry(payload)) {
          throw new Error('Pré-analyse invalide du serveur.')
        }

        const duplicateMessage =
          submissionMessage ??
          'Ce site est déjà référencé. Contactez la modération pour demander le retrait avant une nouvelle soumission.'
        setSubmissionPreviewToken(null)
        handleSubmissionFeedback('duplicate', normalizeShowcaseEntry(payload), duplicateMessage)
        return
      }

      if (submissionStatus === 'pending' && readAlreadySubmittedFlag(payload)) {
        if (!isShowcaseEntry(payload)) {
          throw new Error('Pré-analyse invalide du serveur.')
        }

        const alreadyPendingMessage =
          submissionMessage ??
          'Ce site a déjà été soumis et reste en cours de validation manuelle. Inutile de le renvoyer.'
        setSubmissionPreviewToken(null)
        handleSubmissionFeedback('already-pending', normalizeShowcaseEntry(payload), alreadyPendingMessage)
        return
      }

      if (!submissionStatus || !isShowcaseEntry(payload)) {
        throw new Error('Pré-analyse invalide du serveur.')
      }

      setSubmissionPreviewEntry(normalizeShowcaseEntry(payload))
      setSubmissionPreviewStatus(submissionStatus)
      setSubmissionPreviewToken(readPreviewToken(payload))
      setIsSubmitConfirmationStep(true)

      const reviewMessage =
        submissionMessage ??
        'Pré-analyse terminée. Vérifiez les informations détectées puis confirmez l’envoi.'
      setSubmitInfoMessage(reviewMessage)
      announcePolite(reviewMessage)
      window.setTimeout(() => {
        focusElement(submitConfirmationRef.current)
      }, 0)
    } catch (error) {
      setSubmissionPreviewEntry(null)
      setSubmissionPreviewStatus(null)
      setSubmissionPreviewToken(null)
      const localizedMessage = error instanceof Error ? error.message : 'Erreur réseau.'
      showSubmitError(localizedMessage, 'preview')
    } finally {
      setIsPreAnalyzing(false)
    }
  }

  const handleConfirmSubmission = useCallback(async () => {
    if (!isSubmitConfirmationStep || !submissionPreviewEntry) {
      const message = 'Veuillez lancer la pré-analyse avant de confirmer.'
      showSubmitError(message, 'submit')
      setSubmitInfoMessage(null)
      focusElement(urlInputRef.current)
      return
    }

    setSubmitError(null)
    setSubmitInfoMessage(null)
    setLastAddedEntry(null)
    setSubmissionFeedback(null)
    const categoryForSubmission = normalizePublicSubmissionCategory(inputCategory)

    setIsConfirmingSubmission(true)
    setSubmitInfoMessage('Analyse du site en cours. Merci de patienter.')
    announcePolite("Analyse du site en cours.")

    try {
      const response = await fetch('/api/site-insight', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          url: inputUrl,
          category: categoryForSubmission,
          website: websiteField,
          previewToken: submissionPreviewToken ?? undefined,
        }),
      })

      const payload = await readApiPayload(response)
      const submissionStatus = readSubmissionStatus(payload)
      const submissionMessage = readSubmissionMessage(payload)

      if (!response.ok) {
        throw new Error(typeof payload?.error === 'string' ? payload.error : 'Ajout impossible.')
      }

      if (typeof payload.error === 'string') {
        throw new Error(payload.error)
      }

      if ((submissionStatus === 'pending' || response.status === 202) && readAlreadySubmittedFlag(payload)) {
        if (!isShowcaseEntry(payload)) {
          throw new Error('Réponse serveur invalide.')
        }

        const alreadyPendingMessage =
          submissionMessage ??
          'Ce site a déjà été soumis et reste en cours de validation manuelle. Inutile de le renvoyer.'
        setSubmissionPreviewToken(null)
        handleSubmissionFeedback('already-pending', normalizeShowcaseEntry(payload), alreadyPendingMessage)
        return
      }

      if (submissionStatus === 'pending' || response.status === 202) {
        const pendingMessage =
          submissionMessage ??
          "Soumission reçue, en attente de vérification humaine avant publication dans la vitrine."
        setIsSubmitConfirmationStep(false)
        setSubmissionPreviewEntry(null)
        setSubmissionPreviewStatus(null)
        setSubmissionPreviewToken(null)
        setInputUrl('')
        setWebsiteField('')
        setSubmitInfoMessage(pendingMessage)
        announcePolite(pendingMessage)
        return
      }

      if (submissionStatus === 'duplicate') {
        if (!isShowcaseEntry(payload)) {
          throw new Error('Réponse serveur invalide.')
        }

        const duplicateMessage =
          submissionMessage ??
          'Ce site est déjà référencé. Contactez la modération pour demander le retrait avant une nouvelle soumission.'
        setSubmissionPreviewToken(null)
        handleSubmissionFeedback('duplicate', normalizeShowcaseEntry(payload), duplicateMessage)
        return
      }

      if (!isShowcaseEntry(payload)) {
        throw new Error('Réponse serveur invalide.')
      }

      setIsSubmitConfirmationStep(false)
      setSubmissionPreviewEntry(null)
      setSubmissionPreviewStatus(null)
      setSubmissionPreviewToken(null)
      setLastAddedEntry(normalizeShowcaseEntry(payload))
      setInputUrl('')
      setWebsiteField('')

      const successMessage = submissionMessage ?? `Site ajouté : ${payload.siteTitle}.`
      announcePolite(successMessage)
      setSubmitInfoMessage(null)

      await loadShowcaseEntries()
    } catch (error) {
      setLastAddedEntry(null)
      const localizedMessage = error instanceof Error ? error.message : 'Erreur réseau.'
      showSubmitError(localizedMessage, 'submit')
    } finally {
      setIsConfirmingSubmission(false)
    }
  }, [
    announcePolite,
    focusElement,
    handleSubmissionFeedback,
    inputCategory,
    inputUrl,
    isSubmitConfirmationStep,
    loadShowcaseEntries,
    showSubmitError,
    submissionPreviewEntry,
    submissionPreviewToken,
    websiteField,
  ])

  return (
    <>
      <div
        className={skipLinksContainerClass}
        aria-label="Liens d’évitement"
      >
        <a href="#contenu" className={skipLinkClass} onClick={(event) => handleSkipLinkClick(event, mainContentRef)}>
          Aller au contenu
        </a>
        <a href="#navigation-principale" className={skipLinkClass} onClick={(event) => handleSkipLinkClick(event, primaryNavigationRef)}>
          Aller à la navigation principale
        </a>
        <a href="#moteur-recherche-global" className={skipLinkClass}>
          Aller à la recherche annuaire
        </a>
        <a href="#resultats-annuaire" className={skipLinkClass} onClick={(event) => handleSkipLinkClick(event, directorySectionRef)}>
          Aller aux résultats annuaire
        </a>
        <a href="#ajout-site" className={skipLinkClass} onClick={(event) => handleSkipLinkClick(event, urlInputRef)}>
          Aller au formulaire d’ajout
        </a>
        <a href="#aide-accessibilite" className={skipLinkClass} onClick={(event) => handleSkipLinkClick(event, helpSectionRef)}>
          Aller à l’aide accessibilité
        </a>
        <a href="#pied-page" className={skipLinkClass} onClick={(event) => handleSkipLinkClick(event, footerRef)}>
          Aller au pied de page
        </a>
      </div>

      <div className="sr-only" style={visuallyHiddenStyle} role="status" aria-live="polite" aria-atomic="true" lang="fr">
        {politeAnnouncement.message}
        <span aria-hidden="true">{politeAnnouncement.id}</span>
      </div>
      <div className="sr-only" style={visuallyHiddenStyle} role="alert" aria-live="assertive" aria-atomic="true" lang="fr">
        {assertiveAnnouncement.message}
        <span aria-hidden="true">{assertiveAnnouncement.id}</span>
      </div>

      <div className="min-h-screen bg-brand-surface text-brand-ink">
        <header className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
          <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">Annuaire public RGAA</p>
              <ThemeToggle
                className={`inline-flex min-h-11 items-center rounded-xl border border-slate-600 dark:border-slate-600 bg-transparent px-4 py-2 text-sm font-semibold text-slate-900 dark:text-slate-50 ${focusRingClass}`}
              />
            </div>
            <PrimaryNavigation
              currentPath="/"
              navId="navigation-principale"
              navRef={primaryNavigationRef}
              className="mt-4"
              listClassName="flex flex-wrap items-center gap-2"
              linkClassName={`inline-flex min-h-11 items-center rounded-xl px-4 py-2 text-sm font-semibold ${ctaNeutralClass} ${focusRingClass}`}
            />
            <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
              <img
                src="/logo-rgaa-vitrine.svg"
                alt="Icône Annuaire RGAA"
                width={112}
                height={112}
                fetchPriority="high"
                className="h-28 w-28 flex-none rounded-2xl border-2 border-slate-800 dark:border-slate-200 bg-slate-900 dark:bg-slate-100 p-2"
                loading="eager"
              />
              <div className="min-w-0">
                <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50">
                  Annuaire RGAA
                </h1>
                <p className="mt-1 text-lg font-semibold text-slate-800 dark:text-slate-100">
                  Le Référentiel général d’amélioration de l’accessibilité (RGAA), visible avec fierté.
                </p>
                <span className="mt-3 inline-flex min-h-10 items-center rounded-full border border-sky-300 dark:border-sky-600 bg-sky-50 dark:bg-sky-950 px-4 py-1 text-sm font-bold text-sky-900 dark:text-sky-100">
                  Annuaire RGAA conforme
                </span>
              </div>
            </div>
            <p className="mt-4 max-w-4xl text-base text-slate-700 dark:text-slate-300">
              Une vitrine simple pour référencer et découvrir les sites qui affichent leur conformité RGAA, avec
              filtres et recherche accessibles à tous, alignés sur les WCAG (Web Content Accessibility Guidelines) 2.2.
            </p>
            <GlobalSearchForm
              inputId="accueil-recherche-annuaire"
              className="mt-6"
              searchValue={searchQuery}
              statusValue={statusFilter}
              categoryValue={categoryFilter}
              categoryOptions={categoryFilterOptions}
              searchInputRef={searchInputRef}
              resultsTargetId="liste-vitrines"
              helperTextId="recherche-aide"
              helperText="Astuce clavier: appuyez sur Échap dans le champ recherche pour effacer la saisie."
              onSearchChange={setSearchQuery}
              onStatusChange={setStatusFilter}
              onCategoryChange={setCategoryFilter}
              onSubmit={handleSearchSubmit}
              onEscapeClear={() => {
                if (searchQuery) {
                  setSearchQuery('')
                  announcePolite('Recherche effacée.')
                }
              }}
              onReset={handleResetFilters}
            />
          </div>
        </header>

        <main id="contenu" ref={mainContentRef} tabIndex={-1} className={`mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 ${focusTargetScrollMarginClass} ${focusTargetClass}`}>
          <section aria-labelledby="annuaire-titre" className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm">
            <h2 id="annuaire-titre" className="text-xl font-semibold">
              Annuaire
            </h2>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl bg-slate-100 dark:bg-slate-800 px-4 py-3">
                <dt className="text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">Fiches référencées</dt>
                <dd className={`${statsValueClass} text-slate-900 dark:text-slate-50`}>{directoryStats.total}</dd>
              </div>
              <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950 px-4 py-3">
                <dt className="text-sm font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-100">Totalement conformes</dt>
                <dd className={`${statsValueClass} text-emerald-900 dark:text-emerald-100`}>{directoryStats.full}</dd>
              </div>
              <div className="rounded-xl bg-amber-50 dark:bg-amber-950 px-4 py-3">
                <dt className="text-sm font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-100">Partiellement conformes</dt>
                <dd className={`${statsValueClass} text-amber-900 dark:text-amber-100`}>{directoryStats.partial}</dd>
              </div>
              <div className="rounded-xl bg-rose-50 dark:bg-rose-950 px-4 py-3">
                <dt className="text-sm font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-100">Non conformes</dt>
                <dd className={`${statsValueClass} text-rose-900 dark:text-rose-100`}>{directoryStats.none}</dd>
              </div>
            </dl>
            <p className="mt-4 rounded-xl border border-sky-200 dark:border-sky-700 bg-sky-50 dark:bg-sky-950 p-3 text-sm font-medium text-sky-900 dark:text-sky-100">
              Le score indique une direction. La vraie mesure, c’est un parcours client débloqué et une expérience
              utilisateur (UX) qui laisse passer chaque personne.
            </p>
          </section>

          <section
            id="resultats-annuaire"
            ref={directorySectionRef}
            tabIndex={-1}
            className={`mt-8 ${focusTargetScrollMarginClass} ${focusTargetClass}`}
            aria-labelledby="galerie-titre"
            aria-busy={loadingDirectory}
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-1 lg:grid-cols-[minmax(0,7fr)_minmax(18rem,3fr)] lg:items-start">
              <div className="space-y-3">
                <h2 id="galerie-titre" className="text-xl font-semibold">
                  Résultats annuaire
                </h2>
                <p className="text-slate-700 dark:text-slate-300">
                  La recherche et les filtres sont disponibles dans l’en-tête de page, puis les résultats sont listés ici.
                </p>
                {showcaseEntries.length > 0 && (
                  <p className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-3 text-sm text-slate-700 dark:text-slate-300">
                    Les scores affichés sont déclarés par les organismes qui soumettent leur site et sont publiés à titre
                    informatif. Ils n’engagent pas la responsabilité éditoriale d’Annuaire RGAA. En cas de réévaluation
                    documentée, vous pouvez{' '}
                    <a href={moderationContactPath} className={`font-semibold underline ${focusRingClass}`}>
                      contacter la modération
                    </a>{' '}
                    pour demander une mise à jour.
                  </p>
                )}
              </div>

              <div className="w-full rounded-2xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 p-4 lg:justify-self-end">
                <label
                  htmlFor="annuaire-tri-resultats"
                  className="block text-sm font-semibold text-slate-900 dark:text-slate-50"
                >
                  Trier les résultats
                </label>
                <select
                  id="annuaire-tri-resultats"
                  value={directorySort}
                  onChange={handleDirectorySortChange}
                  aria-describedby="annuaire-tri-resultats-aide"
                  className={`mt-1 min-h-11 w-full rounded-xl border border-slate-700 dark:border-slate-400 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-50 shadow-sm ${focusRingClass}`}
                >
                  {directorySortOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p id="annuaire-tri-resultats-aide" className="mt-2 text-sm text-slate-700 dark:text-slate-300">
                  Le tri met à jour immédiatement les cartes ci-dessous sans déplacer le focus clavier.
                </p>
              </div>
            </div>

            <p
              id="annuaire-resultats-resume"
              ref={resultsSummaryRef}
              tabIndex={-1}
              className="mt-3 min-h-[3rem] text-sm text-slate-700 dark:text-slate-300 [font-variant-numeric:tabular-nums] sm:min-h-6"
            >
              {directorySummaryText}
            </p>

            {loadingDirectory && (
              <section
                className="mt-4 rounded-2xl border border-sky-200 dark:border-sky-700 bg-sky-50 dark:bg-sky-950 p-4 shadow-sm"
                aria-labelledby="annuaire-chargement-titre"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h3
                      id="annuaire-chargement-titre"
                      className="text-base font-semibold text-sky-900 dark:text-sky-100"
                    >
                      Chargement de l’annuaire en cours
                    </h3>
                    <p className="text-sm text-sky-900 dark:text-sky-100">
                      Les fiches publiques arrivent. Cela peut prendre quelques secondes sur une connexion lente.
                    </p>
                  </div>
                  <span
                    className="inline-flex min-h-10 items-center rounded-full border border-sky-300 dark:border-sky-600 bg-white/70 dark:bg-slate-900/50 px-4 py-1 text-sm font-semibold text-sky-900 dark:text-sky-100"
                  >
                    Patientez…
                  </span>
                </div>

                <div aria-hidden="true" className="mt-4 grid gap-4 md:grid-cols-2">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div
                      key={`loading-directory-card-${index}`}
                      className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4"
                    >
                      <div className="flex flex-wrap gap-2">
                        <div className="h-8 w-28 rounded-full bg-slate-200 dark:bg-slate-700" />
                        <div className="h-8 w-24 rounded-full bg-slate-200 dark:bg-slate-700" />
                        <div className="h-8 w-32 rounded-full bg-slate-200 dark:bg-slate-700" />
                      </div>
                      <div className="mt-4 h-7 w-48 max-w-full rounded bg-slate-200 dark:bg-slate-700" />
                      <div className="mt-3 h-5 w-full rounded bg-slate-200 dark:bg-slate-700" />
                      <div className="mt-2 h-5 w-40 max-w-full rounded bg-slate-200 dark:bg-slate-700" />
                      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <div className="h-11 rounded-xl bg-slate-200 dark:bg-slate-700" />
                        <div className="h-11 rounded-xl bg-slate-200 dark:bg-slate-700" />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {!loadingDirectory && showcaseEntries.length === 0 && (
              <p className="mt-3 text-slate-700 dark:text-slate-300">Aucun site référencé pour le moment.</p>
            )}

            {!loadingDirectory && showcaseEntries.length > 0 && filteredDirectoryItems.length === 0 && (
              <p className="mt-3 text-slate-700 dark:text-slate-300">Aucun site ne correspond aux filtres actuels.</p>
            )}

            {directoryErrorMessage && (
              <p
                ref={directoryErrorRef}
                tabIndex={-1}
                className="mt-4 rounded-lg border border-rose-300 dark:border-rose-700 bg-rose-50 dark:bg-rose-950 p-3 text-sm text-rose-800 dark:text-rose-100"
                role="alert"
              >
                {directoryErrorMessage}
              </p>
            )}

            {filteredDirectoryItems.length > 0 && (
              <ul id="liste-vitrines" tabIndex={-1} className={`mt-4 grid gap-5 md:grid-cols-2 ${focusTargetScrollMarginClass} ${focusTargetClass}`}>
                {visibleDirectoryItems.map((item) => {
                  if (item.kind === 'group') {
                    const primaryEntry = item.primaryEntry ?? item.children[0] ?? null
                    if (!primaryEntry) {
                      return null
                    }

                    const rgaaBadge = getRgaaBadgePresentation(primaryEntry.rgaaBaseline)
                    const domId = toDomSafeIdSegment(`group-${item.groupSlug}`)
                    const badgeDescriptionId = `rgaa-badge-description-${domId}`
                    const summaryId = `resume-domaine-${item.groupSlug}`

                    return (
                      <li
                        key={`group-${item.groupSlug}`}
                        className="@container overflow-hidden rounded-3xl border-2 border-sky-300 dark:border-sky-700 bg-white dark:bg-slate-900 shadow-sm shadow-slate-950/5"
                      >
                      <article className="flex h-full flex-col">
                        <div className="site-thumbnail-frame h-44 overflow-hidden border-b border-slate-200 dark:border-slate-700">
                          {primaryEntry.thumbnailUrl ? (
                            <div className="site-thumbnail-canvas">
                              <img
                                src={primaryEntry.thumbnailUrl}
                                alt=""
                                aria-hidden="true"
                                className="site-thumbnail-image h-full w-full"
                                loading="lazy"
                                decoding="async"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                          ) : (
                            <div className="site-thumbnail-canvas flex items-center justify-center bg-linear-to-br from-sky-50 via-white to-emerald-50 px-3 text-center text-sm font-medium text-slate-800 dark:from-sky-950 dark:via-slate-900 dark:to-emerald-950 dark:text-slate-100">
                              Aucune vignette disponible
                            </div>
                          )}
                        </div>

                        <div className="flex flex-1 flex-col gap-4 p-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex min-h-8 items-center rounded-full border border-sky-700 dark:border-sky-300 bg-sky-100 dark:bg-sky-950 px-3 py-1 text-sm font-semibold text-sky-900 dark:text-sky-100">
                              Domaine multi-sites
                            </span>
                            {primaryEntry.complianceStatus ? (
                              <span
                                className={`inline-flex min-h-8 items-center rounded-full px-3 py-1 text-sm font-semibold ${statusClassByValue[primaryEntry.complianceStatus]}`}
                              >
                                {primaryEntry.complianceStatusLabel}
                              </span>
                            ) : (
                              <span className="inline-flex min-h-8 items-center rounded-full border border-slate-500 dark:border-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 text-sm font-semibold text-slate-800 dark:text-slate-50">
                                Niveau inconnu
                              </span>
                            )}
                            <span
                              className={`inline-flex min-h-8 items-center rounded-full px-3 py-1 text-sm font-semibold ${rgaaBadge.className}`}
                              aria-label={rgaaBadge.ariaLabel}
                              aria-describedby={badgeDescriptionId}
                            >
                              {rgaaBadge.shortLabel}
                            </span>
                            <span className="inline-flex min-h-8 items-center rounded-full border border-slate-500 dark:border-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 text-sm font-semibold text-slate-800 dark:text-slate-200">
                              Score {formatScore(primaryEntry.complianceScore)}
                            </span>
                            <span className="inline-flex min-h-8 items-center rounded-full border border-slate-500 dark:border-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 text-sm font-semibold text-slate-800 dark:text-slate-200">
                              {item.totalSiteCount} fiche(s) publiées
                            </span>
                          </div>

                          <header className="space-y-2">
                            <h3 className="text-lg font-bold leading-tight text-slate-900 dark:text-slate-50">
                              {primaryEntry.siteTitle}
                            </h3>
                            <p className="wrap-anywhere rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-700 dark:text-slate-200">
                              {primaryEntry.normalizedUrl}
                            </p>
                            <p id={summaryId} className="text-sm text-slate-700 dark:text-slate-300">
                              Domaine racine: <strong>{item.registrableDomain}</strong>. {item.totalSiteCount} fiche(s)
                              publiée(s) pour ce domaine. Dernière mise à jour: {formatDate(item.updatedAt)}.
                            </p>
                            {item.matchingSiteCount < item.totalSiteCount ? (
                              <p className="text-sm text-slate-700 dark:text-slate-300">
                                {item.matchingSiteCount} fiche(s) de ce domaine correspondent aux filtres actuels.
                              </p>
                            ) : null}
                          </header>

                          <dl className="grid grid-cols-1 gap-2 @md:grid-cols-2">
                            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2">
                              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                                Catégorie
                              </dt>
                              <dd className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-50">
                                {formatCategory(primaryEntry.category)}
                              </dd>
                            </div>
                            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2">
                              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                                Mise à jour
                              </dt>
                              <dd className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-50">
                                {formatDate(primaryEntry.updatedAt)}
                              </dd>
                            </div>
                          </dl>

                          <p id={badgeDescriptionId} className="text-sm text-slate-700 dark:text-slate-300">
                            {rgaaBadge.description}
                          </p>

                          <div className="mt-auto">
                            <a
                              href={item.groupPath}
                              aria-label={`Voir les ${item.totalSiteCount} fiches du domaine ${item.registrableDomain}`}
                              aria-describedby={summaryId}
                              className={`inline-flex min-h-11 w-full items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold ${ctaSkyClass} ${focusRingClass}`}
                            >
                              Voir les {item.totalSiteCount} fiches du domaine
                            </a>
                          </div>
                        </div>
                        </article>
                      </li>
                    )
                  }

                  const entry = item.entry
                  const rgaaBadge = getRgaaBadgePresentation(entry.rgaaBaseline)
                  const domId = toDomSafeIdSegment(entry.normalizedUrl)
                  const badgeDescriptionId = `rgaa-badge-description-${domId}`
                  const votesDescriptionId = `votes-${domId}`

                  return (
                    <li
                      key={entry.normalizedUrl}
                      className="@container overflow-hidden rounded-3xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm shadow-slate-950/5"
                    >
                      <article className="flex h-full flex-col">
                        <div className="site-thumbnail-frame h-44 overflow-hidden border-b border-slate-200 dark:border-slate-700">
                          {entry.thumbnailUrl ? (
                            <div className="site-thumbnail-canvas">
                              <img
                                src={entry.thumbnailUrl}
                                alt=""
                                aria-hidden="true"
                                className="site-thumbnail-image h-full w-full"
                                loading="lazy"
                                decoding="async"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                          ) : (
                            <div className="site-thumbnail-canvas flex items-center justify-center px-3 text-center text-sm font-medium text-slate-800 dark:text-slate-800">
                              Aucune vignette disponible
                            </div>
                          )}
                        </div>

                        <div className="flex flex-1 flex-col gap-4 p-4">
                          <div className="flex flex-wrap items-center gap-2">
                            {entry.complianceStatus ? (
                              <span
                                className={`inline-flex min-h-8 items-center rounded-full px-3 py-1 text-sm font-semibold ${statusClassByValue[entry.complianceStatus]}`}
                              >
                                {entry.complianceStatusLabel}
                              </span>
                            ) : (
                              <span className="inline-flex min-h-8 items-center rounded-full border border-slate-500 dark:border-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 text-sm font-semibold text-slate-800 dark:text-slate-50">
                                Niveau inconnu
                              </span>
                            )}
                            <span
                              className={`inline-flex min-h-8 items-center rounded-full px-3 py-1 text-sm font-semibold ${rgaaBadge.className}`}
                              aria-label={rgaaBadge.ariaLabel}
                              aria-describedby={badgeDescriptionId}
                            >
                              {rgaaBadge.shortLabel}
                            </span>
                            <span className="inline-flex min-h-8 items-center rounded-full border border-slate-500 dark:border-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 text-sm font-semibold text-slate-800 dark:text-slate-200">
                              Score {formatScore(entry.complianceScore)}
                            </span>
                          </div>

                          <header className="space-y-2">
                            <h3 className="text-lg font-bold leading-tight text-slate-900 dark:text-slate-50">
                              {entry.siteTitle}
                            </h3>
                            <p className="wrap-anywhere rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-700 dark:text-slate-200">
                              {entry.normalizedUrl}
                            </p>
                          </header>

                          <dl className="grid grid-cols-1 gap-2 @md:grid-cols-2">
                            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2">
                              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                                Catégorie
                              </dt>
                              <dd className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-50">
                                {formatCategory(entry.category)}
                              </dd>
                            </div>
                            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2">
                              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                                Mise à jour
                              </dt>
                              <dd className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-50">
                                {formatDate(entry.updatedAt)}
                              </dd>
                            </div>
                          </dl>

                          <p
                            id={badgeDescriptionId}
                            className="text-sm text-slate-700 dark:text-slate-300"
                          >
                            {rgaaBadge.description}
                          </p>

                          <div className="mt-auto space-y-3">
                            <div className="@container grid grid-cols-1 gap-2 @sm:grid-cols-2">
                              <a
                                href={entry.profilePath ?? resolveShowcaseProfilePath(entry.normalizedUrl, entry.slug)}
                                aria-label={`Ouvrir la fiche annuaire de ${entry.siteTitle}`}
                                className={`inline-flex min-h-11 w-full items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold ${ctaSkyClass} ${focusRingClass}`}
                              >
                                Voir la fiche annuaire
                              </a>
                              <a
                                href={entry.normalizedUrl}
                                target="_blank"
                                rel="noopener external"
                                referrerPolicy="strict-origin-when-cross-origin"
                                aria-label={`Visiter le site ${entry.siteTitle}`}
                                className={`inline-flex min-h-11 w-full items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold ${ctaNeutralClass} ${focusRingClass}`}
                              >
                                Visiter le site
                              </a>
                              {entry.accessibilityPageUrl ? (
                                <a
                                  href={entry.accessibilityPageUrl}
                                  target="_blank"
                                  rel="noopener external"
                                  referrerPolicy="strict-origin-when-cross-origin"
                                  aria-label={`Ouvrir la déclaration d’accessibilité de ${entry.siteTitle}`}
                                  className={`@sm:col-span-2 inline-flex min-h-11 w-full items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold ${ctaEmeraldClass} ${focusRingClass}`}
                                >
                                  Déclaration d’accessibilité
                                </a>
                              ) : (
                                <span className="@sm:col-span-2 inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-600 dark:border-slate-500 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                                  Déclaration non détectée
                                </span>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2">
                              <button
                                type="button"
                                onClick={() => void handleUpvote(entry)}
                                disabled={entry.votesBlocked || upvotePendingByUrl[entry.normalizedUrl]}
                                aria-pressed={entry.hasUpvoted}
                                aria-describedby={votesDescriptionId}
                                aria-label={`${
                                  entry.votesBlocked
                                    ? 'Votes indisponibles pour'
                                    : entry.hasUpvoted
                                      ? 'Retirer mon vote pour'
                                      : 'Voter pour'
                                } ${entry.siteTitle}. ${entry.upvoteCount} vote(s).`}
                                className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold ${
                                  entry.votesBlocked
                                    ? 'border-slate-400 dark:border-slate-600 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                                    : entry.hasUpvoted
                                      ? 'border-emerald-500 dark:border-emerald-600 bg-emerald-100 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-100'
                                      : 'border-slate-700 dark:border-slate-300 bg-transparent text-slate-900 dark:text-slate-50'
                                } disabled:cursor-not-allowed disabled:opacity-100 ${focusRingClass}`}
                              >
                                <span aria-hidden="true">{entry.votesBlocked ? '◌' : entry.hasUpvoted ? '▲' : '△'}</span>
                                <span>
                                  {entry.votesBlocked
                                    ? 'Votes indisponibles'
                                    : entry.hasUpvoted
                                      ? 'Retirer mon vote'
                                      : 'Soutenir ce site'}
                                </span>
                              </button>
                              <span
                                id={votesDescriptionId}
                                className="inline-flex min-h-8 items-center rounded-full border border-slate-400 dark:border-slate-500 bg-white dark:bg-slate-900 px-3 py-1 text-sm font-semibold text-slate-800 dark:text-slate-200"
                              >
                                {entry.upvoteCount} vote(s)
                              </span>
                            </div>
                          </div>
                        </div>
                      </article>
                    </li>
                  )
                })}
              </ul>
            )}

            {filteredDirectoryItems.length > 0 && hasMoreTiles && (
              <div className="mt-4 flex flex-col items-start gap-3">
                <button
                  ref={loadMoreButtonRef}
                  type="button"
                  onClick={() => handleLoadMoreTiles('button')}
                  className={`inline-flex min-h-11 items-center rounded-xl px-4 py-2 text-sm font-semibold ${ctaNeutralClass} ${focusRingClass}`}
                >
                  Charger {Math.min(TILE_BATCH_SIZE, filteredDirectoryItems.length - visibleDirectoryItems.length)} carte(s) de plus
                </button>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Chargement progressif actif pour alléger le rendu initial.
                </p>
              </div>
            )}

            {filteredDirectoryItems.length > 0 && (
              <div ref={tilesSentinelRef} className="h-1 w-full" aria-hidden="true" />
            )}
          </section>

          <section
            id="aide-accessibilite"
            ref={helpSectionRef}
            tabIndex={-1}
            className={`mt-8 rounded-2xl border border-sky-200 dark:border-sky-700 bg-sky-50 dark:bg-sky-950 p-6 ${focusTargetScrollMarginClass} ${focusTargetClass}`}
            aria-labelledby="aide-titre"
          >
            <h2 id="aide-titre" className="text-xl font-semibold text-sky-900 dark:text-sky-100">
              Aide accessibilité et repères WCAG 2.2
            </h2>
            <p className="mt-2 text-sky-900 dark:text-sky-100">
              Cette vitrine suit les recommandations WCAG 2.2 pour un usage clavier, des cibles interactives plus
              confortables et des retours clairs pour toutes et tous.
            </p>
            <ul className="mt-3 list-disc space-y-1 ps-5 text-sm text-sky-900 dark:text-sky-100">
              <li>Focus clavier visible et non masqué sur les contrôles interactifs.</li>
              <li>Cibles pointeur suffisantes pour limiter les erreurs de sélection.</li>
              <li>Point d’aide cohérent et retrouvé au même endroit dans l’interface.</li>
            </ul>
            <div className="mt-4 grid gap-3">
              {wcagResources.map((resource) => (
                <a
                  key={resource.url}
                  href={resource.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className={`inline-flex min-h-11 items-center rounded-xl px-4 py-2 font-semibold ${ctaSkyClass} ${focusRingClass}`}
                >
                  {resource.label}
                </a>
              ))}
            </div>
          </section>

          <section
            id="ajout-site"
            ref={formSectionRef}
            tabIndex={-1}
            className={`mt-8 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm ${focusTargetScrollMarginClass} ${focusTargetClass}`}
            aria-labelledby="formulaire-titre"
          >
            <h2 id="formulaire-titre" className="text-xl font-semibold">
              Ajouter un site
            </h2>
            <p id="url-help" className="mt-2 text-sm text-slate-700 dark:text-slate-300">
              Ajoutez une URL pour enrichir l’annuaire. Les métadonnées publiques seront récupérées automatiquement.
            </p>
            <p id="url-format-help" className="mt-1 text-sm text-slate-700 dark:text-slate-300">
              Format recommandé: <strong>https://www.exemple.fr</strong>
            </p>

            <form className="mt-4 grid gap-4 md:grid-cols-[2fr_1fr_auto]" onSubmit={handleSubmit}>
              <div className="absolute -start-[9999px] top-auto h-px w-px overflow-hidden">
                <label htmlFor="website" className="block text-sm font-medium">
                  Site web
                </label>
                <input
                  id="website"
                  name="website"
                  type="text"
                  value={websiteField}
                  onChange={(event) => setWebsiteField(event.target.value)}
                  autoComplete="off"
                  tabIndex={-1}
                  aria-hidden="true"
                />
              </div>

              <div>
                <label htmlFor="url" className="block text-sm font-medium">
                  URL du site
                </label>
                <input
                  ref={urlInputRef}
                  id="url"
                  name="url"
                  type="url"
                  autoComplete="url"
                  required
                  aria-invalid={Boolean(submitError)}
                  aria-describedby={submitError ? 'url-help url-format-help url-error-message' : 'url-help url-format-help'}
                  value={inputUrl}
                  onChange={(event) => {
                    setInputUrl(event.target.value)
                    setSubmitError(null)
                    setSubmissionFeedback(null)
                    setIsSubmitConfirmationStep(false)
                    setSubmissionPreviewEntry(null)
                    setSubmissionPreviewStatus(null)
                    setSubmissionPreviewToken(null)
                  }}
                  onInvalid={(event) => {
                    event.currentTarget.setCustomValidity(
                      'Veuillez saisir une URL complète, par exemple https://www.exemple.fr.',
                    )
                  }}
                  onInput={(event) => {
                    event.currentTarget.setCustomValidity('')
                  }}
                  className={`mt-1 min-h-11 w-full rounded-xl border border-slate-600 dark:border-slate-600 user-invalid:border-rose-700 dark:user-invalid:border-rose-500 user-valid:border-emerald-700 dark:user-valid:border-emerald-500 bg-transparent px-3 py-2 text-base text-slate-900 dark:text-slate-50 shadow-sm ${focusRingClass}`}
                />
              </div>

              <div>
                <label htmlFor="categorie-site-select" className="block text-sm font-medium">
                  Catégorie
                </label>
                <select
                  id="categorie-site-select"
                  name="categorie"
                  value={inputCategory}
                  onChange={(event) => {
                    setInputCategory(event.target.value)
                    setSubmitError(null)
                    setSubmissionFeedback(null)
                    setIsSubmitConfirmationStep(false)
                    setSubmissionPreviewEntry(null)
                    setSubmissionPreviewStatus(null)
                    setSubmissionPreviewToken(null)
                  }}
                  className={`mt-1 min-h-11 w-full rounded-xl border border-slate-600 dark:border-slate-600 bg-transparent px-3 py-2 text-base text-slate-900 dark:text-slate-50 shadow-sm ${focusRingClass}`}
                >
                  {showcaseCategories.map((category) => (
                    <option key={category} value={category}>
                      {formatCategory(category)}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={isSubmissionBusy}
                aria-describedby="preanalyse-help"
                className={`min-h-11 rounded-xl px-5 py-2.5 font-semibold disabled:cursor-not-allowed disabled:border-slate-600 disabled:bg-slate-600 disabled:text-slate-100 disabled:opacity-100 md:self-end ${ctaPrimaryClass} ${focusRingClass}`}
              >
                {isPreAnalyzing ? 'Pré-analyse...' : isSubmitConfirmationStep ? 'Relancer la pré-analyse' : 'Lancer la pré-analyse'}
              </button>

              <p id="preanalyse-help" className="md:col-span-3 text-sm text-slate-700 dark:text-slate-300">
                {isSubmitConfirmationStep
                  ? 'Pré-analyse terminée. Les actions de confirmation sont disponibles dans le bloc Vérification avant envoi.'
                  : 'Lancez la pré-analyse pour afficher le récapitulatif avant confirmation.'}
              </p>
            </form>

            {isSubmitConfirmationStep && (
              <section
                ref={submitConfirmationRef}
                tabIndex={-1}
                className={`mt-4 rounded-xl border border-sky-300 dark:border-sky-700 bg-sky-50 dark:bg-sky-950 p-4 ${focusRingClass}`}
                aria-labelledby="verification-envoi-titre"
                aria-describedby="verification-envoi-help"
                aria-busy={isConfirmingSubmission}
              >
                <h3 id="verification-envoi-titre" className="text-base font-semibold text-sky-900 dark:text-sky-100">
                  Vérification avant envoi
                </h3>
                <p id="verification-envoi-help" className="mt-2 text-sm text-sky-900 dark:text-sky-100">
                  Les informations restent modifiables tant que vous n’avez pas confirmé l’envoi.
                </p>
                {submissionDomainDescription ? (
                  <p className="mt-3 rounded-xl border border-sky-300 dark:border-sky-700 bg-white/80 dark:bg-slate-900/80 p-3 text-sm text-sky-900 dark:text-sky-100">
                    {submissionDomainDescription} Cette URL sera traitée comme un sous-site distinct si vous continuez.
                  </p>
                ) : null}
                <dl className="mt-3 grid gap-2 text-sm text-sky-900 dark:text-sky-100">
                  <div>
                    <dt className="font-semibold">URL</dt>
                    <dd className="wrap-anywhere">{inputUrl}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold">Catégorie</dt>
                    <dd>{formatCategory(normalizePublicSubmissionCategory(inputCategory))}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold">Résultat estimé</dt>
                    <dd>{formatSubmissionStatusLabel(submissionPreviewStatus)}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold">Titre détecté</dt>
                    <dd>{submissionPreviewEntry?.siteTitle ?? 'N/A'}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold">Niveau détecté</dt>
                    <dd>{submissionPreviewEntry?.complianceStatusLabel ?? 'N/A'}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold">Score détecté</dt>
                    <dd>{formatScore(submissionPreviewEntry?.complianceScore ?? null)}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold">Référentiel RGAA détecté</dt>
                    <dd>{getRgaaBadgePresentation(normalizeRgaaBaseline(submissionPreviewEntry?.rgaaBaseline)).shortLabel}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold">Déclaration d’accessibilité</dt>
                    <dd className="wrap-anywhere">{submissionPreviewEntry?.accessibilityPageUrl ?? 'Non détectée'}</dd>
                  </div>
                  {submissionPreviewEntry?.domainContext ? (
                    <div>
                      <dt className="font-semibold">Domaine rapproché</dt>
                      <dd>
                        {submissionPreviewEntry.domainContext.registrableDomain}
                        {submissionPreviewEntry.domainContext.groupPath ? (
                          <>
                            {' '}
                            ·{' '}
                            <a
                              href={submissionPreviewEntry.domainContext.groupPath}
                              className={`font-semibold underline ${focusRingClass}`}
                            >
                              Voir la page domaine
                            </a>
                          </>
                        ) : null}
                      </dd>
                    </div>
                  ) : null}
                </dl>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    ref={confirmSubmissionButtonRef}
                    type="button"
                    onClick={() => {
                      void handleConfirmSubmission()
                    }}
                    disabled={isSubmissionBusy}
                    className={`min-h-11 rounded-xl px-5 py-2.5 font-semibold disabled:cursor-not-allowed disabled:border-slate-600 disabled:bg-slate-600 disabled:text-slate-100 disabled:opacity-100 ${ctaConfirmClass} ${focusRingClass}`}
                  >
                    {isConfirmingSubmission ? 'Envoi...' : 'Confirmer l’envoi'}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelSubmissionConfirmation}
                    disabled={isSubmissionBusy}
                    className={`min-h-11 rounded-xl px-5 py-2.5 font-semibold disabled:cursor-not-allowed disabled:border-slate-600 disabled:bg-slate-600 disabled:text-slate-100 disabled:opacity-100 ${ctaNeutralClass} ${focusRingClass}`}
                  >
                    Modifier les informations
                  </button>
                </div>
              </section>
            )}

            {submissionFeedback && !submitError && (
              <section
                key={submissionFeedback.id}
                ref={duplicateFeedbackRef}
                tabIndex={-1}
                className="mt-4 rounded-xl border border-amber-400 dark:border-amber-600 bg-amber-50 dark:bg-amber-950 p-4 text-amber-950 dark:text-amber-100 focus:outline-3 focus:outline-offset-3 focus:outline-brand-focus"
                role="status"
                aria-live="polite"
                aria-atomic="true"
                aria-labelledby="soumission-deja-presente-titre"
                aria-describedby="soumission-deja-presente-aide soumission-deja-presente-raisons"
              >
                <h3 id="soumission-deja-presente-titre" className="text-base font-semibold">
                  {submissionFeedback.kind === 'already-pending'
                    ? 'Site déjà soumis et en cours de revue'
                    : 'Site déjà référencé'}
                </h3>
                <p id="soumission-deja-presente-aide" className="mt-2 text-sm">
                  {submissionFeedback.message}
                </p>
                <p className="mt-2 text-sm">
                  {submissionFeedback.kind === 'already-pending'
                    ? 'Une demande existe déjà pour cette URL. La modération reviendra vers vous après traitement.'
                    : 'Pour une nouvelle publication, demandez d’abord la suppression de la fiche actuelle auprès de l’administration/modération.'}
                </p>
                <ul id="soumission-deja-presente-raisons" className="mt-2 list-disc space-y-1 ps-5 text-sm">
                  {submissionFeedback.kind === 'already-pending' ? (
                    <>
                      <li>La soumission reste en file de validation manuelle.</li>
                      <li>Évitez les renvois multiples de la même URL.</li>
                      <li>Pour ajouter du contexte, contactez directement la modération.</li>
                    </>
                  ) : (
                    <>
                      <li>Nouvel audit d’accessibilité.</li>
                      <li>Nouveau score RGAA.</li>
                      <li>Améliorations fonctionnelles ou correctifs significatifs.</li>
                    </>
                  )}
                  {describeDomainContext(submissionFeedback.entry.domainContext) ? (
                    <li>{describeDomainContext(submissionFeedback.entry.domainContext)}</li>
                  ) : null}
                </ul>
                <div className="mt-4 flex flex-wrap gap-3">
                  {submissionFeedback.kind === 'duplicate' && (
                    <a
                      href={
                        submissionFeedback.entry.profilePath ??
                        resolveShowcaseProfilePath(
                          submissionFeedback.entry.normalizedUrl,
                          submissionFeedback.entry.slug,
                        )
                      }
                      className={`inline-flex min-h-11 items-center rounded-xl px-4 py-2 text-sm font-semibold ${ctaNeutralClass} ${focusRingClass}`}
                    >
                      Voir la fiche existante
                    </a>
                  )}
                  {submissionFeedback.entry.domainContext?.groupPath ? (
                    <a
                      href={submissionFeedback.entry.domainContext.groupPath}
                      className={`inline-flex min-h-11 items-center rounded-xl px-4 py-2 text-sm font-semibold ${ctaNeutralClass} ${focusRingClass}`}
                    >
                      Voir le domaine multi-sites
                    </a>
                  ) : null}
                  <a
                    href={moderationContactPath}
                    className={`inline-flex min-h-11 items-center rounded-xl px-4 py-2 text-sm font-semibold ${ctaSkyClass} ${focusRingClass}`}
                  >
                    Contacter la modération
                  </a>
                  <a
                    href={moderationContactEmail}
                    className={`inline-flex min-h-11 items-center rounded-xl px-4 py-2 text-sm font-semibold ${ctaSkyClass} ${focusRingClass}`}
                  >
                    Envoyer un e-mail
                  </a>
                  <button
                    type="button"
                    onClick={handleDismissSubmissionFeedback}
                    className={`inline-flex min-h-11 items-center rounded-xl px-4 py-2 text-sm font-semibold ${ctaNeutralClass} ${focusRingClass}`}
                  >
                    Fermer ce message
                  </button>
                </div>
              </section>
            )}

            {submitError && (
              <section
                key={submitError.id}
                ref={submitErrorRef}
                tabIndex={-1}
                className="mt-4 rounded-xl border border-rose-300 dark:border-rose-700 bg-rose-50 dark:bg-rose-950 p-4 text-rose-900 dark:text-rose-100 focus:outline-3 focus:outline-offset-3 focus:outline-brand-focus"
                role="alert"
                aria-atomic="true"
                aria-labelledby="url-error-title"
                aria-describedby="url-error-message url-error-guidance"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 id="url-error-title" className="text-base font-semibold">
                      Analyse interrompue
                    </h3>
                    <p id="url-error-message" className="mt-2 text-sm font-medium">
                      {submitError.summary}
                    </p>
                    <p id="url-error-guidance" className="mt-2 text-sm">
                      {submitError.guidance}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleDismissSubmitError}
                    className={`inline-flex min-h-11 items-center rounded-xl px-4 py-2 text-sm font-semibold ${ctaNeutralClass} ${focusRingClass}`}
                  >
                    Fermer ce message
                  </button>
                </div>
                {submitError.detail && (
                  <details className="mt-4 rounded-lg border border-rose-200 dark:border-rose-800 bg-white/60 dark:bg-slate-950/40 p-3 text-xs text-rose-950 dark:text-rose-50">
                    <summary className={`block min-h-11 cursor-pointer rounded-lg py-2 text-sm font-semibold ${focusRingClass}`}>
                      Afficher les détails techniques
                    </summary>
                    <p className="mt-2 text-xs">
                      Ces détails sont utiles uniquement si vous contactez la modération ou le support.
                    </p>
                    <p className="mt-2 wrap-anywhere font-mono">{submitError.detail}</p>
                  </details>
                )}
              </section>
            )}

            {submitInfoMessage && !submitError && (
              <p
                ref={submitInfoRef}
                tabIndex={-1}
                className="mt-4 rounded-lg border border-sky-300 dark:border-sky-600 bg-sky-50 dark:bg-sky-950 p-3 text-sm text-sky-900 dark:text-sky-100"
                role="status"
                aria-live="polite"
              >
                {submitInfoMessage}
              </p>
            )}

            {lastAddedEntry && !submitError && (
              <section
                ref={lastAddedRef}
                tabIndex={-1}
                className="mt-4 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950 p-3 text-sm text-emerald-800 dark:text-emerald-100"
                aria-labelledby="site-ajoute-titre"
                aria-describedby="site-ajoute-detail"
              >
                <h3 id="site-ajoute-titre" className="text-base font-semibold">
                  Site ajouté
                </h3>
                <p id="site-ajoute-detail" className="mt-1" role="status" aria-live="polite">
                  La fiche <strong>{lastAddedEntry.siteTitle}</strong> a été publiée.
                </p>
                {lastAddedDomainDescription ? (
                  <p className="mt-2 text-sm">
                    {lastAddedDomainDescription}
                    {lastAddedEntry.domainContext?.groupPath ? (
                      <>
                        {' '}
                        <a
                          href={lastAddedEntry.domainContext.groupPath}
                          className={`font-semibold underline ${focusRingClass}`}
                        >
                          Ouvrir la page domaine
                        </a>
                      </>
                    ) : null}
                  </p>
                ) : null}
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={handleRefreshAfterSuccess}
                    className={`inline-flex min-h-11 items-center rounded-xl px-4 py-2 text-sm font-semibold ${ctaNeutralClass} ${focusRingClass}`}
                  >
                    Rafraîchir la page
                  </button>
                </div>
              </section>
            )}
          </section>

          <section id="ressources-officielles" tabIndex={-1} className={`mt-8 ${focusTargetScrollMarginClass} ${focusTargetClass}`} aria-labelledby="sources-titre">
            <h2 id="sources-titre" className="text-xl font-semibold">
              Ressources officielles RGAA
            </h2>
            <p className="mt-2 text-slate-700 dark:text-slate-300">
              Pour les personnes concernées, les équipes produit et les passionnés, voici les références publiques
              utilisées pour guider la qualité du répertoire.
            </p>
            <aside
              className="mt-4 rounded-xl border border-sky-200 dark:border-sky-700 bg-sky-50 dark:bg-sky-950 p-4"
              aria-labelledby="rgaa5-focus-titre"
            >
              <h3 id="rgaa5-focus-titre" className="text-base font-semibold text-sky-900 dark:text-sky-100">
                Point d’attention : cap RGAA 5
              </h3>
              <p className="mt-1 text-sm text-sky-900 dark:text-sky-100">
                L’article officiel du 2 mars 2026 rappelle deux priorités : préparer la transition vers RGAA 5 d’ici
                fin 2026, et maintenir dès maintenant les efforts de conformité RGAA 4.1.2.
              </p>
              <p className="mt-2 text-sm">
                <a
                  href="https://design.numerique.gouv.fr/articles/2026-03-02-rgaa5/"
                  target="_blank"
                  rel="noreferrer noopener"
                  className={`font-semibold text-sky-900 dark:text-sky-100 ${focusRingClass}`}
                >
                  Lire l’article "L’arrivée de RGAA 5 est annoncée"
                </a>
              </p>
            </aside>
            <ul className="mt-4 grid gap-3">
              {officialResources.map((resource) => (
                <li key={resource.url} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm">
                  <a
                    href={resource.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className={`inline-flex min-h-11 items-center font-semibold ${focusRingClass}`}
                  >
                    {resource.label}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        </main>

        <SiteFooter id="pied-page" footerRef={footerRef} helpHref="/#aide-accessibilite" />
      </div>
    </>
  )
}

export default App
