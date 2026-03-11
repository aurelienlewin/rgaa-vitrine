import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { normalizeDomainContext } from './domainGroups'
import {
  focusElementWithScroll,
  focusTargetClass,
  focusTargetScrollMarginClass,
  useHashTargetFocus,
} from './hashNavigation'
import { applySeo } from './seo'
import SecondaryPageHeader from './SecondaryPageHeader'
import SiteFooter from './SiteFooter'
import { visuallyHiddenStyle } from './visuallyHidden'

type ComplianceStatus = 'full' | 'partial' | 'none' | null
type RgaaBaseline = '4.1' | '5.0-ready'

type PendingSubmission = {
  submissionId: string
  normalizedUrl: string
  slug?: string
  profilePath?: string | null
  siteTitle: string
  thumbnailUrl: string | null
  accessibilityPageUrl: string | null
  complianceStatus: ComplianceStatus
  complianceStatusLabel: string | null
  complianceScore: number | null
  rgaaBaseline?: RgaaBaseline
  updatedAt: string
  createdAt: string
  reviewReason: string | null
  category: string
  domainContext?: ReturnType<typeof normalizeDomainContext>
}

type ShowcaseEntry = {
  normalizedUrl: string
  slug?: string
  profilePath?: string | null
  siteTitle: string
  thumbnailUrl: string | null
  accessibilityPageUrl: string | null
  complianceStatus: ComplianceStatus
  complianceStatusLabel: string | null
  complianceScore: number | null
  rgaaBaseline?: RgaaBaseline
  siteBlocked?: boolean
  votesBlocked?: boolean
  updatedAt: string
  category: string
  domainContext?: ReturnType<typeof normalizeDomainContext>
}

type PublishedEntryDraft = {
  siteTitle: string
  category: string
  complianceStatus: '' | 'full' | 'partial' | 'none'
  complianceScore: string
  rgaaBaseline: RgaaBaseline
  thumbnailUrl: string
  accessibilityPageUrl: string
}

type PublishedEntryFeedback = {
  tone: 'info' | 'success' | 'error'
  message: string
}

type ArchiveImportMode = 'merge' | 'replace'
type MaintenanceState = {
  enabled: boolean
  message: string | null
  effectiveMessage: string
  updatedAt: string | null
}

const moderationCategories = [
  'Administration',
  'E-commerce',
  'Media',
  'Sante',
  'Education',
  'Associatif',
  'Coopérative et services',
  'Autre',
]
const complianceStatusOptions: Array<{ value: PublishedEntryDraft['complianceStatus']; label: string }> = [
  { value: '', label: 'Inconnu' },
  { value: 'full', label: 'Totalement conforme' },
  { value: 'partial', label: 'Partiellement conforme' },
  { value: 'none', label: 'Non conforme' },
]
const rgaaBaselineOptions: Array<{ value: RgaaBaseline; label: string }> = [
  { value: '4.1', label: 'RGAA 4.1' },
  { value: '5.0-ready', label: 'RGAA 5.0 prêt' },
]

const focusRingClass =
  'focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-brand-focus'
const ctaHoverClass = 'transition-colors duration-150 enabled:hover:underline'
const ctaDisabledClass =
  'disabled:border-slate-500 disabled:bg-slate-700 disabled:text-white disabled:opacity-100 disabled:shadow-none'
const moderationCtaNeutralClass =
  `border-2 border-slate-800 dark:border-slate-300 bg-white dark:bg-slate-100 text-slate-950 dark:text-slate-950 enabled:hover:bg-slate-100 dark:enabled:hover:bg-white ${ctaHoverClass}`
const moderationCtaPrimaryClass =
  `border-2 border-sky-900 dark:border-sky-300 bg-sky-800 dark:bg-sky-100 text-white dark:text-sky-950 enabled:hover:bg-sky-900 dark:enabled:hover:bg-white ${ctaHoverClass}`
const moderationCtaSuccessClass =
  `border-2 border-emerald-900 dark:border-emerald-300 bg-emerald-700 dark:bg-emerald-100 text-white dark:text-emerald-950 enabled:hover:bg-emerald-800 dark:enabled:hover:bg-white ${ctaHoverClass}`
const moderationCtaSlateClass =
  `border-2 border-slate-950 dark:border-slate-300 bg-slate-800 dark:bg-slate-100 text-white dark:text-slate-950 enabled:hover:bg-slate-900 dark:enabled:hover:bg-white ${ctaHoverClass}`
const moderationCtaWarningClass =
  `border-2 border-amber-900 dark:border-amber-300 bg-amber-700 dark:bg-amber-100 text-white dark:text-amber-950 enabled:hover:bg-amber-800 dark:enabled:hover:bg-white ${ctaHoverClass}`
const moderationCtaDangerClass =
  `border-2 border-rose-950 dark:border-rose-300 bg-rose-700 dark:bg-rose-100 text-white dark:text-rose-950 enabled:hover:bg-rose-800 dark:enabled:hover:bg-white ${ctaHoverClass}`
const moderationCtaDangerStrongClass =
  `border-2 border-rose-950 dark:border-rose-300 bg-rose-900 dark:bg-rose-100 text-white dark:text-rose-950 enabled:hover:bg-rose-950 dark:enabled:hover:bg-white ${ctaHoverClass}`
const moderationCtaOutlineDangerClass =
  `border-2 border-rose-800 dark:border-rose-300 bg-white dark:bg-rose-100 text-rose-900 dark:text-rose-950 enabled:hover:bg-rose-50 dark:enabled:hover:bg-white ${ctaHoverClass}`
const moderationCtaOutlineWarningClass =
  `border-2 border-amber-800 dark:border-amber-300 bg-white dark:bg-amber-100 text-amber-900 dark:text-amber-950 enabled:hover:bg-amber-50 dark:enabled:hover:bg-white ${ctaHoverClass}`
const moderationSurfaceClass =
  'border border-slate-200 dark:border-slate-300 bg-white dark:bg-slate-950 text-slate-950 dark:text-slate-50 shadow-sm'
const moderationSurfaceStrongClass =
  'border border-slate-200 dark:border-slate-300 bg-white dark:bg-slate-900 text-slate-950 dark:text-slate-50 shadow-sm'
const moderationTextMutedClass = 'text-slate-700 dark:text-slate-100'
const moderationTextStrongClass = 'text-slate-800 dark:text-slate-50'
const moderationFieldClass =
  `min-h-11 w-full rounded-xl border border-slate-300 dark:border-slate-300 bg-white dark:bg-slate-950 px-3 py-2 text-base text-slate-950 dark:text-slate-50 placeholder:text-slate-500 dark:placeholder:text-slate-300 ${focusRingClass}`
const moderationValidatedFieldClass =
  `min-h-11 w-full rounded-xl border border-slate-300 dark:border-slate-300 user-invalid:border-rose-700 dark:user-invalid:border-rose-300 user-valid:border-emerald-700 dark:user-valid:border-emerald-300 bg-white dark:bg-slate-950 px-3 py-2 text-base text-slate-950 dark:text-slate-50 placeholder:text-slate-500 dark:placeholder:text-slate-300 ${focusRingClass}`
const moderationValidatedFieldStrongClass =
  `min-h-11 w-full rounded-xl border-2 border-slate-400 dark:border-slate-300 user-invalid:border-rose-700 dark:user-invalid:border-rose-300 user-valid:border-emerald-700 dark:user-valid:border-emerald-300 bg-white dark:bg-slate-950 px-3 py-2 text-base text-slate-950 dark:text-slate-50 placeholder:text-slate-500 dark:placeholder:text-slate-300 shadow-sm ${focusRingClass}`
const moderationFileFieldClass =
  `mt-1 min-h-11 w-full rounded-xl border border-slate-300 dark:border-slate-300 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-950 dark:text-slate-50 file:text-slate-950 dark:file:text-slate-50 ${focusRingClass}`
const moderationDangerPanelClass =
  'border border-rose-300 dark:border-rose-300 bg-rose-50 dark:bg-rose-100 text-rose-950 dark:text-rose-950'
const moderationWarningPanelClass =
  'border border-amber-300 dark:border-amber-300 bg-amber-50 dark:bg-amber-100 text-amber-950 dark:text-amber-950'
const moderationInfoPanelClass =
  'border border-sky-300 dark:border-sky-300 bg-sky-50 dark:bg-sky-100 text-sky-950 dark:text-sky-950'
const moderationSuccessPanelClass =
  'border border-emerald-300 dark:border-emerald-300 bg-emerald-50 dark:bg-emerald-100 text-emerald-950 dark:text-emerald-950'
const moderationNeutralBadgeClass =
  'border border-slate-300 dark:border-slate-300 bg-slate-100 dark:bg-slate-100 text-slate-900 dark:text-slate-950'
const moderationDangerBadgeClass =
  'border border-rose-400 dark:border-rose-300 bg-rose-100 dark:bg-rose-100 text-rose-950 dark:text-rose-950'
const moderationWarningBadgeClass =
  'border border-amber-400 dark:border-amber-300 bg-amber-100 dark:bg-amber-100 text-amber-950 dark:text-amber-950'
const moderationSuccessBadgeClass =
  'border border-emerald-400 dark:border-emerald-300 bg-emerald-100 dark:bg-emerald-100 text-emerald-950 dark:text-emerald-950'
const moderationPendingSectionClass =
  'border-2 border-amber-500 dark:border-amber-300 bg-amber-50 dark:bg-slate-950 shadow-sm'
const moderationPendingCardClass =
  'overflow-hidden rounded-3xl border-2 border-amber-400 dark:border-amber-300 bg-white dark:bg-slate-950 shadow-lg shadow-amber-950/10'
const moderationPendingCardHeaderClass =
  'border-b-2 border-amber-500 dark:border-amber-300 bg-amber-100 dark:bg-slate-900 px-4 py-3 sm:px-5'
const moderationMaintenanceSectionClass =
  'rounded-3xl border-2 border-rose-700 dark:border-rose-300 bg-rose-50 dark:bg-slate-950 p-6 shadow-lg shadow-rose-950/10'
const moderationPanelLinkClass =
  `font-semibold underline text-sky-950 hover:text-slate-950 dark:text-sky-950 dark:hover:text-slate-950 ${focusRingClass}`
const skipLinksContainerClass =
  'fixed start-2 top-2 z-60 flex max-w-[calc(100vw-1rem)] -translate-y-[120%] flex-col items-start gap-2 transition-transform duration-150 motion-reduce:transition-none focus-within:translate-y-0 hover:translate-y-0 sm:start-4 sm:top-4 sm:max-w-none'
const skipLinkClass = `inline-flex min-h-11 items-center rounded-lg border border-slate-900 bg-slate-950 px-3 py-2 text-slate-50 underline decoration-2 underline-offset-2 shadow-lg dark:border-slate-50 dark:bg-slate-50 dark:text-slate-950 ${focusRingClass}`
const MODERATION_SESSION_STORAGE_KEY = 'annuaire-rgaa-moderation-session'
const MODERATION_SESSION_TTL_MS = 12 * 60 * 60 * 1000
const DEFAULT_MAINTENANCE_MESSAGE = 'Nous revenons très vite. Merci de réessayer dans quelques instants.'
const MODERATION_BATCH_SIZE = 24
const MODERATION_PUBLISHED_BATCH_SIZE = 4

type StoredModerationSession = {
  token: string
  expiresAt: number
  source: 'session' | 'local'
}

type ProgressivePaginationOptions = {
  autoLoad?: boolean
  batchSize: number
  enabled: boolean
  isBusy?: boolean
  onButtonReveal?: (nextVisibleCount: number, totalCount: number) => void
  totalCount: number
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(new Date(value))
}

function createDefaultMaintenanceState(): MaintenanceState {
  return {
    enabled: false,
    message: null,
    effectiveMessage: DEFAULT_MAINTENANCE_MESSAGE,
    updatedAt: null,
  }
}

function toNullableString(value: unknown) {
  return typeof value === 'string' ? value : null
}

function toNullableNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function normalizeMaintenanceStatePayload(payload: Record<string, unknown>): MaintenanceState {
  const message = toNullableString(payload.message)
  const effectiveMessage =
    toNullableString(payload.effectiveMessage) ??
    message ??
    DEFAULT_MAINTENANCE_MESSAGE
  const updatedAt = toNullableString(payload.updatedAt)

  return {
    enabled: payload.enabled === true,
    message,
    effectiveMessage,
    updatedAt,
  }
}

function toDomId(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-')
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

function formatRgaaBaseline(value: RgaaBaseline | null | undefined) {
  return value === '5.0-ready' ? 'RGAA 5.0 prêt' : 'RGAA 4.1'
}

function buildProgressiveListSummary(visibleCount: number, totalCount: number, itemLabel: string) {
  return `Affichage de ${visibleCount} sur ${totalCount} ${itemLabel}.`
}

function formatLoadMoreLabel(visibleCount: number, totalCount: number, batchSize: number, itemLabel: string) {
  return `Charger ${Math.min(batchSize, totalCount - visibleCount)} ${itemLabel} de plus`
}

function isPendingSubmission(payload: unknown): payload is PendingSubmission {
  if (!payload || typeof payload !== 'object') {
    return false
  }

  const candidate = payload as Record<string, unknown>
  return (
    typeof candidate.submissionId === 'string' &&
    typeof candidate.normalizedUrl === 'string' &&
    typeof candidate.siteTitle === 'string' &&
    typeof candidate.createdAt === 'string' &&
    typeof candidate.updatedAt === 'string' &&
    typeof candidate.category === 'string'
  )
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

function toPublishedEntryDraft(entry: ShowcaseEntry): PublishedEntryDraft {
  const status = entry.complianceStatus === 'full' || entry.complianceStatus === 'partial' || entry.complianceStatus === 'none'
    ? entry.complianceStatus
    : ''

  return {
    siteTitle: entry.siteTitle,
    category: entry.category || 'Autre',
    complianceStatus: status,
    complianceScore: entry.complianceScore === null ? '' : String(entry.complianceScore),
    rgaaBaseline: entry.rgaaBaseline === '5.0-ready' ? '5.0-ready' : '4.1',
    thumbnailUrl: entry.thumbnailUrl ?? '',
    accessibilityPageUrl: entry.accessibilityPageUrl ?? '',
  }
}

function normalizePendingSubmission(entry: PendingSubmission): PendingSubmission {
  return {
    ...entry,
    slug:
      typeof entry.slug === 'string' && /^[a-z0-9-]{4,120}$/.test(entry.slug)
        ? entry.slug
        : undefined,
    profilePath:
      typeof entry.profilePath === 'string' && entry.profilePath.startsWith('/')
        ? entry.profilePath
        : null,
    domainContext: normalizeDomainContext(entry.domainContext),
  }
}

function normalizePublishedEntry(entry: ShowcaseEntry): ShowcaseEntry {
  return {
    ...entry,
    slug:
      typeof entry.slug === 'string' && /^[a-z0-9-]{4,120}$/.test(entry.slug)
        ? entry.slug
        : undefined,
    profilePath:
      typeof entry.profilePath === 'string' && entry.profilePath.startsWith('/')
        ? entry.profilePath
        : null,
    domainContext: normalizeDomainContext(entry.domainContext),
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
  return { error: compactBody.slice(0, 220) || 'Réponse serveur non JSON.' }
}

function readFilenameFromDisposition(disposition: string | null) {
  if (!disposition) {
    return null
  }

  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]).replace(/[/\\]/g, '_')
    } catch {
      // fallback on standard filename parsing below
    }
  }

  const quotedMatch = disposition.match(/filename="([^"]+)"/i)
  if (quotedMatch?.[1]) {
    return quotedMatch[1].replace(/[/\\]/g, '_')
  }

  const plainMatch = disposition.match(/filename=([^;]+)/i)
  if (plainMatch?.[1]) {
    return plainMatch[1].trim().replace(/[/\\]/g, '_')
  }

  return null
}

function readSessionFromStorage(rawValue: string | null, source: StoredModerationSession['source']) {
  if (!rawValue) {
    return null
  }

  try {
    const parsed = JSON.parse(rawValue) as { token?: unknown; expiresAt?: unknown }
    if (typeof parsed.token !== 'string' || typeof parsed.expiresAt !== 'number') {
      return null
    }
    const token = parsed.token.trim()
    if (!token || !Number.isFinite(parsed.expiresAt) || parsed.expiresAt <= Date.now()) {
      return null
    }

    return {
      token,
      expiresAt: parsed.expiresAt,
      source,
    } satisfies StoredModerationSession
  } catch {
    return null
  }
}

function readStoredModerationSession() {
  if (typeof window === 'undefined') {
    return null
  }

  const localSession = readSessionFromStorage(
    window.localStorage.getItem(MODERATION_SESSION_STORAGE_KEY),
    'local',
  )
  const sessionSession = readSessionFromStorage(
    window.sessionStorage.getItem(MODERATION_SESSION_STORAGE_KEY),
    'session',
  )

  if (!localSession && !sessionSession) {
    return null
  }
  if (!localSession) {
    return sessionSession
  }
  if (!sessionSession) {
    return localSession
  }

  return localSession.expiresAt >= sessionSession.expiresAt ? localSession : sessionSession
}

function clearStoredModerationSession() {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.removeItem(MODERATION_SESSION_STORAGE_KEY)
  window.sessionStorage.removeItem(MODERATION_SESSION_STORAGE_KEY)
}

function persistStoredModerationSession(token: string, rememberAcrossBrowser: boolean) {
  if (typeof window === 'undefined') {
    return
  }

  const normalizedToken = token.trim()
  if (!normalizedToken) {
    clearStoredModerationSession()
    return
  }

  const payload = JSON.stringify({
    token: normalizedToken,
    expiresAt: Date.now() + MODERATION_SESSION_TTL_MS,
  })
  window.sessionStorage.setItem(MODERATION_SESSION_STORAGE_KEY, payload)
  if (rememberAcrossBrowser) {
    window.localStorage.setItem(MODERATION_SESSION_STORAGE_KEY, payload)
  } else {
    window.localStorage.removeItem(MODERATION_SESSION_STORAGE_KEY)
  }
}

function useProgressivePagination({
  autoLoad = true,
  batchSize,
  enabled,
  isBusy = false,
  onButtonReveal,
  totalCount,
}: ProgressivePaginationOptions) {
  const [requestedVisibleCount, setRequestedVisibleCount] = useState(0)
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const visibleCount = useMemo(() => {
    if (!enabled || totalCount <= 0) {
      return 0
    }

    if (requestedVisibleCount <= 0) {
      return Math.min(batchSize, totalCount)
    }

    return Math.min(Math.max(requestedVisibleCount, batchSize), totalCount)
  }, [batchSize, enabled, requestedVisibleCount, totalCount])
  const hasMore = enabled && visibleCount < totalCount

  const handleLoadMore = useCallback(
    (source: 'button' | 'auto') => {
      if (!enabled) {
        return
      }

      setRequestedVisibleCount((current) => {
        const currentVisibleCount =
          current <= 0 ? Math.min(batchSize, totalCount) : Math.min(Math.max(current, batchSize), totalCount)
        if (currentVisibleCount >= totalCount) {
          return current
        }

        const next = Math.min(currentVisibleCount + batchSize, totalCount)
        if (next > currentVisibleCount && source === 'button') {
          onButtonReveal?.(next, totalCount)
        }
        return next
      })
    },
    [batchSize, enabled, onButtonReveal, totalCount],
  )

  useEffect(() => {
    if (!autoLoad || !enabled || isBusy || !hasMore || !sentinelRef.current) {
      return
    }

    if (typeof window === 'undefined' || typeof window.IntersectionObserver !== 'function') {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries
        if (entry?.isIntersecting) {
          handleLoadMore('auto')
        }
      },
      {
        root: null,
        rootMargin: '300px 0px',
        threshold: 0.01,
      },
    )

    observer.observe(sentinelRef.current)

    return () => {
      observer.disconnect()
    }
  }, [autoLoad, enabled, handleLoadMore, hasMore, isBusy])

  return {
    handleLoadMore,
    hasMore,
    sentinelRef,
    visibleCount,
  }
}

function ModerationPage() {
  const [moderationToken, setModerationToken] = useState('')
  const [rememberModerationSession, setRememberModerationSession] = useState(false)
  const [hasStoredModerationSession, setHasStoredModerationSession] = useState(false)
  const [pendingEntries, setPendingEntries] = useState<PendingSubmission[]>([])
  const [publishedEntries, setPublishedEntries] = useState<ShowcaseEntry[]>([])
  const [siteBlocklist, setSiteBlocklist] = useState<string[]>([])
  const [voteBlocklist, setVoteBlocklist] = useState<string[]>([])
  const [siteBlocklistInput, setSiteBlocklistInput] = useState('')
  const [voteBlocklistInput, setVoteBlocklistInput] = useState('')
  const [runningBlocklistSiteUrl, setRunningBlocklistSiteUrl] = useState<string | null>(null)
  const [runningBlocklistVoteUrl, setRunningBlocklistVoteUrl] = useState<string | null>(null)
  const [publishedDrafts, setPublishedDrafts] = useState<Record<string, PublishedEntryDraft>>({})
  const [publishedFeedbackByUrl, setPublishedFeedbackByUrl] = useState<Record<string, PublishedEntryFeedback>>({})
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({})
  const [isLoadingList, setIsLoadingList] = useState(false)
  const [isLoadingPublished, setIsLoadingPublished] = useState(false)
  const [isModerationUnlocked, setIsModerationUnlocked] = useState(false)
  const [runningSubmissionId, setRunningSubmissionId] = useState<string | null>(null)
  const [runningPublishedUrl, setRunningPublishedUrl] = useState<string | null>(null)
  const [deleteConfirmationUrl, setDeleteConfirmationUrl] = useState<string | null>(null)
  const [politeMessage, setPoliteMessage] = useState('')
  const [assertiveMessage, setAssertiveMessage] = useState('')
  const [showToken, setShowToken] = useState(false)
  const [isExportingArchive, setIsExportingArchive] = useState(false)
  const [isImportingArchive, setIsImportingArchive] = useState(false)
  const [isLoadingMaintenance, setIsLoadingMaintenance] = useState(false)
  const [isSavingMaintenance, setIsSavingMaintenance] = useState(false)
  const [archiveImportMode, setArchiveImportMode] = useState<ArchiveImportMode>('merge')
  const [allowArchiveRollbackImport, setAllowArchiveRollbackImport] = useState(false)
  const [archiveImportFile, setArchiveImportFile] = useState<File | null>(null)
  const [archiveImportFileName, setArchiveImportFileName] = useState('')
  const [maintenanceState, setMaintenanceState] = useState<MaintenanceState>(() => createDefaultMaintenanceState())
  const [maintenanceMessageInput, setMaintenanceMessageInput] = useState('')
  const mainRef = useRef<HTMLElement | null>(null)
  const pendingRef = useRef<HTMLElement | null>(null)
  const publishedRef = useRef<HTMLElement | null>(null)
  const archiveRef = useRef<HTMLElement | null>(null)
  const maintenanceSectionRef = useRef<HTMLElement | null>(null)
  const tokenInputRef = useRef<HTMLInputElement | null>(null)
  const messageRef = useRef<HTMLParagraphElement | null>(null)
  const archiveImportInputRef = useRef<HTMLInputElement | null>(null)
  const pendingApproveButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const publishedSaveButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const publishedDeleteButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const publishedDeleteAndBlockButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const publishedScoreInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const publishedFeedbackRefs = useRef<Record<string, HTMLParagraphElement | null>>({})
  const siteBlocklistSectionRef = useRef<HTMLElement | null>(null)
  const voteBlocklistSectionRef = useRef<HTMLElement | null>(null)
  const siteBlocklistInputRef = useRef<HTMLInputElement | null>(null)
  const voteBlocklistInputRef = useRef<HTMLInputElement | null>(null)
  const footerRef = useRef<HTMLElement | null>(null)
  const navigationRef = useRef<HTMLElement | null>(null)

  const hasToken = useMemo(() => moderationToken.trim().length > 0, [moderationToken])
  const availableModerationCategoryOptions = useMemo(() => {
    const options = new Set(moderationCategories)
    for (const entry of publishedEntries) {
      const category = typeof entry.category === 'string' ? entry.category.trim().slice(0, 60) : ''
      if (category) {
        options.add(category)
      }
    }

    return Array.from(options).sort((left, right) => left.localeCompare(right, 'fr'))
  }, [publishedEntries])
  const {
    visibleCount: visiblePendingCount,
    hasMore: hasMorePendingEntries,
    sentinelRef: pendingSentinelRef,
    handleLoadMore: handleLoadMorePendingEntries,
  } = useProgressivePagination({
    batchSize: MODERATION_BATCH_SIZE,
    enabled: isModerationUnlocked,
    isBusy: isLoadingList,
    onButtonReveal: (nextVisibleCount, totalCount) => {
      setPoliteMessage(buildProgressiveListSummary(nextVisibleCount, totalCount, 'soumission(s) en attente'))
    },
    totalCount: pendingEntries.length,
  })
  const visiblePendingEntries = useMemo(
    () => pendingEntries.slice(0, visiblePendingCount),
    [pendingEntries, visiblePendingCount],
  )
  const {
    visibleCount: visiblePublishedCount,
    hasMore: hasMorePublishedEntries,
    handleLoadMore: handleLoadMorePublishedEntries,
  } = useProgressivePagination({
    autoLoad: false,
    batchSize: MODERATION_PUBLISHED_BATCH_SIZE,
    enabled: isModerationUnlocked,
    isBusy: isLoadingPublished,
    onButtonReveal: (nextVisibleCount, totalCount) => {
      setPoliteMessage(buildProgressiveListSummary(nextVisibleCount, totalCount, 'entrée(s) publiée(s)'))
    },
    totalCount: publishedEntries.length,
  })
  const visiblePublishedEntries = useMemo(
    () => publishedEntries.slice(0, visiblePublishedCount),
    [publishedEntries, visiblePublishedCount],
  )
  const {
    visibleCount: visibleSiteBlocklistCount,
    hasMore: hasMoreSiteBlocklistEntries,
    sentinelRef: siteBlocklistSentinelRef,
    handleLoadMore: handleLoadMoreSiteBlocklistEntries,
  } = useProgressivePagination({
    batchSize: MODERATION_BATCH_SIZE,
    enabled: isModerationUnlocked,
    onButtonReveal: (nextVisibleCount, totalCount) => {
      setPoliteMessage(buildProgressiveListSummary(nextVisibleCount, totalCount, 'site(s) en blocklist'))
    },
    totalCount: siteBlocklist.length,
  })
  const visibleSiteBlocklist = useMemo(
    () => siteBlocklist.slice(0, visibleSiteBlocklistCount),
    [siteBlocklist, visibleSiteBlocklistCount],
  )
  const {
    visibleCount: visibleVoteBlocklistCount,
    hasMore: hasMoreVoteBlocklistEntries,
    sentinelRef: voteBlocklistSentinelRef,
    handleLoadMore: handleLoadMoreVoteBlocklistEntries,
  } = useProgressivePagination({
    batchSize: MODERATION_BATCH_SIZE,
    enabled: isModerationUnlocked,
    onButtonReveal: (nextVisibleCount, totalCount) => {
      setPoliteMessage(buildProgressiveListSummary(nextVisibleCount, totalCount, 'blocage(s) de vote'))
    },
    totalCount: voteBlocklist.length,
  })
  const visibleVoteBlocklist = useMemo(
    () => voteBlocklist.slice(0, visibleVoteBlocklistCount),
    [visibleVoteBlocklistCount, voteBlocklist],
  )

  const focusElement = useCallback((element: HTMLElement | null) => {
    focusElementWithScroll(element)
  }, [])
  useHashTargetFocus(focusElement)

  const focusMain = useCallback(() => {
    focusElement(mainRef.current)
  }, [focusElement])

  const focusPending = useCallback(() => {
    focusElement(pendingRef.current)
  }, [focusElement])

  const focusPublished = useCallback(() => {
    focusElement(publishedRef.current)
  }, [focusElement])

  const focusMaintenance = useCallback(() => {
    focusElement(maintenanceSectionRef.current)
  }, [focusElement])

  const focusArchive = useCallback(() => {
    focusElement(archiveRef.current)
  }, [focusElement])

  const focusSiteBlocklist = useCallback(() => {
    focusElement(siteBlocklistSectionRef.current)
  }, [focusElement])

  const focusVoteBlocklist = useCallback(() => {
    focusElement(voteBlocklistSectionRef.current)
  }, [focusElement])

  const focusFooter = useCallback(() => {
    focusElement(footerRef.current)
  }, [focusElement])

  const focusNavigation = useCallback(() => {
    focusElement(navigationRef.current)
  }, [focusElement])

  const focusTokenInput = useCallback(() => {
    focusElement(tokenInputRef.current)
  }, [focusElement])

  const focusPrimaryModerationAction = useCallback(() => {
    const firstPendingApproveButton = Object.values(pendingApproveButtonRefs.current).find(
      (element): element is HTMLButtonElement => element instanceof HTMLButtonElement,
    )
    const firstPublishedSaveButton = Object.values(publishedSaveButtonRefs.current).find(
      (element): element is HTMLButtonElement => element instanceof HTMLButtonElement,
    )

    focusElement(firstPendingApproveButton ?? firstPublishedSaveButton ?? pendingRef.current ?? publishedRef.current)
  }, [focusElement])

  const focusMessage = useCallback(() => {
    window.setTimeout(() => {
      focusElement(messageRef.current)
    }, 0)
  }, [focusElement])

  const buildAuthHeaders = useCallback(
    (withContentType = false) => {
      const headers: Record<string, string> = {
        'x-moderation-token': moderationToken.trim(),
      }
      if (withContentType) {
        headers['content-type'] = 'application/json'
      }
      return headers
    },
    [moderationToken],
  )

  const lockModerationView = useCallback(() => {
    setIsModerationUnlocked(false)
    setPendingEntries([])
    setPublishedEntries([])
    setSiteBlocklist([])
    setVoteBlocklist([])
    setPublishedDrafts({})
    setPublishedFeedbackByUrl({})
    setRejectReasons({})
    setDeleteConfirmationUrl(null)
    setMaintenanceState(createDefaultMaintenanceState())
    setMaintenanceMessageInput('')
  }, [])

  const clearModerationSession = useCallback(
    (clearToken = false) => {
      clearStoredModerationSession()
      setHasStoredModerationSession(false)
      if (clearToken) {
        setModerationToken('')
      }
      lockModerationView()
    },
    [lockModerationView],
  )

  const handleSignOut = useCallback(() => {
    clearModerationSession(true)
    setAssertiveMessage('')
    setPoliteMessage('Session modération fermée.')
    setRememberModerationSession(false)
    window.setTimeout(() => {
      focusTokenInput()
    }, 0)
  }, [clearModerationSession, focusTokenInput])

  const loadPendingEntries = useCallback(async () => {
    if (!hasToken) {
      setAssertiveMessage('Veuillez saisir un jeton de modération.')
      setPoliteMessage('')
      focusTokenInput()
      return false
    }

    setAssertiveMessage('')
    setPoliteMessage('Chargement de la file de modération...')
    setIsLoadingList(true)

    try {
      const response = await fetch('/api/moderation/pending?limit=200', {
        headers: buildAuthHeaders(false),
      })
      const payload = await readApiPayload(response)

      if (!response.ok) {
        throw new Error(typeof payload.error === 'string' ? payload.error : 'Chargement impossible.')
      }

      const entries = Array.isArray(payload.entries)
        ? payload.entries.filter(isPendingSubmission).map((entry) => normalizePendingSubmission(entry))
        : []
      setPendingEntries(entries)
      setPoliteMessage(`${entries.length} soumission(s) en attente chargée(s).`)
      setAssertiveMessage('')
      return true
    } catch (error) {
      const localizedMessage = error instanceof Error ? error.message : 'Erreur lors du chargement.'
      setAssertiveMessage(localizedMessage)
      setPoliteMessage('')
      focusMessage()
      return false
    } finally {
      setIsLoadingList(false)
    }
  }, [buildAuthHeaders, focusMessage, focusTokenInput, hasToken])

  const loadPublishedEntries = useCallback(async () => {
    if (!hasToken) {
      return false
    }

    setIsLoadingPublished(true)

    try {
      const response = await fetch('/api/moderation/showcase?limit=200', {
        headers: buildAuthHeaders(false),
      })
      const payload = await readApiPayload(response)

      if (!response.ok) {
        throw new Error(typeof payload.error === 'string' ? payload.error : 'Chargement de l’annuaire impossible.')
      }

      const entries = Array.isArray(payload.entries)
        ? payload.entries
            .filter(isShowcaseEntry)
            .map((entry) => normalizePublishedEntry(entry))
            .sort((left, right) => {
              const leftTime = Date.parse(left.updatedAt)
              const rightTime = Date.parse(right.updatedAt)
              if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) {
                return rightTime - leftTime
              }
              return left.siteTitle.localeCompare(right.siteTitle, 'fr')
            })
        : []
      setPublishedEntries(entries)
      setPublishedDrafts(
        Object.fromEntries(entries.map((entry) => [entry.normalizedUrl, toPublishedEntryDraft(entry)])),
      )
      setPublishedFeedbackByUrl({})
      setDeleteConfirmationUrl(null)
      return true
    } catch (error) {
      const localizedMessage =
        error instanceof Error ? error.message : 'Erreur lors du chargement de l’annuaire publié.'
      setAssertiveMessage(localizedMessage)
      setPoliteMessage('')
      focusMessage()
      return false
    } finally {
      setIsLoadingPublished(false)
    }
  }, [buildAuthHeaders, focusMessage, hasToken])

  const loadBlocklists = useCallback(async () => {
    if (!hasToken) {
      return false
    }

    try {
      const response = await fetch('/api/moderation/blocklist', {
        headers: buildAuthHeaders(false),
      })
      const payload = await readApiPayload(response)

      if (!response.ok) {
        throw new Error(typeof payload.error === 'string' ? payload.error : 'Chargement des blocklists impossible.')
      }

      const nextSiteBlocklist = Array.isArray(payload.siteBlocklist)
        ? payload.siteBlocklist.filter((value): value is string => typeof value === 'string')
        : []
      const nextVoteBlocklist = Array.isArray(payload.voteBlocklist)
        ? payload.voteBlocklist.filter((value): value is string => typeof value === 'string')
        : []

      setSiteBlocklist(nextSiteBlocklist)
      setVoteBlocklist(nextVoteBlocklist)
      return true
    } catch (error) {
      const localizedMessage = error instanceof Error ? error.message : 'Erreur lors du chargement des blocklists.'
      setAssertiveMessage(localizedMessage)
      setPoliteMessage('')
      focusMessage()
      return false
    }
  }, [buildAuthHeaders, focusMessage, hasToken])

  const loadMaintenanceState = useCallback(async () => {
    if (!hasToken) {
      return false
    }

    setIsLoadingMaintenance(true)

    try {
      const response = await fetch('/api/moderation/maintenance', {
        headers: buildAuthHeaders(false),
      })
      const payload = await readApiPayload(response)

      if (!response.ok) {
        throw new Error(typeof payload.error === 'string' ? payload.error : 'Chargement du mode maintenance impossible.')
      }

      const nextState = normalizeMaintenanceStatePayload(payload)
      setMaintenanceState(nextState)
      setMaintenanceMessageInput(nextState.message ?? '')
      return true
    } catch (error) {
      const localizedMessage =
        error instanceof Error ? error.message : 'Erreur lors du chargement du mode maintenance.'
      setAssertiveMessage(localizedMessage)
      setPoliteMessage('')
      focusMessage()
      return false
    } finally {
      setIsLoadingMaintenance(false)
    }
  }, [buildAuthHeaders, focusMessage, hasToken])

  const resolveNextPendingSubmissionId = useCallback(
    (submissionId: string) => {
      const currentIndex = pendingEntries.findIndex((entry) => entry.submissionId === submissionId)
      if (currentIndex < 0) {
        return null
      }

      return pendingEntries[currentIndex + 1]?.submissionId ?? pendingEntries[currentIndex - 1]?.submissionId ?? null
    },
    [pendingEntries],
  )

  const handleApprove = useCallback(
    async (submissionId: string) => {
      const nextSubmissionId = resolveNextPendingSubmissionId(submissionId)
      setRunningSubmissionId(submissionId)
      setAssertiveMessage('')
      setPoliteMessage('Validation de la soumission en cours...')

      try {
        const response = await fetch('/api/moderation/approve', {
          method: 'POST',
          headers: buildAuthHeaders(true),
          body: JSON.stringify({ submissionId }),
        })
        const payload = await readApiPayload(response)

        if (!response.ok) {
          throw new Error(typeof payload.error === 'string' ? payload.error : 'Validation impossible.')
        }

        const info = toNullableString(payload.message) ?? 'Soumission approuvée.'
        setPendingEntries((current) => current.filter((entry) => entry.submissionId !== submissionId))
        setRejectReasons((current) => {
          const next = { ...current }
          delete next[submissionId]
          return next
        })
        await loadPublishedEntries()
        setPoliteMessage(info)
        window.setTimeout(() => {
          const nextButton = nextSubmissionId ? pendingApproveButtonRefs.current[nextSubmissionId] : null
          focusElement(nextButton ?? pendingRef.current)
        }, 0)
      } catch (error) {
        const localizedMessage = error instanceof Error ? error.message : 'Erreur lors de la validation.'
        setAssertiveMessage(localizedMessage)
        setPoliteMessage('')
        focusMessage()
      } finally {
        setRunningSubmissionId(null)
      }
    },
    [buildAuthHeaders, focusElement, focusMessage, loadPublishedEntries, resolveNextPendingSubmissionId],
  )

  const handleReject = useCallback(
    async (submissionId: string) => {
      const nextSubmissionId = resolveNextPendingSubmissionId(submissionId)
      setRunningSubmissionId(submissionId)
      setAssertiveMessage('')
      setPoliteMessage('Rejet de la soumission en cours...')

      try {
        const reason = (rejectReasons[submissionId] ?? '').trim()
        const response = await fetch('/api/moderation/reject', {
          method: 'POST',
          headers: buildAuthHeaders(true),
          body: JSON.stringify({
            submissionId,
            reason: reason || undefined,
          }),
        })
        const payload = await readApiPayload(response)

        if (!response.ok) {
          throw new Error(typeof payload.error === 'string' ? payload.error : 'Rejet impossible.')
        }

        const info = toNullableString(payload.message) ?? 'Soumission rejetée.'
        setPendingEntries((current) => current.filter((entry) => entry.submissionId !== submissionId))
        setRejectReasons((current) => {
          const next = { ...current }
          delete next[submissionId]
          return next
        })
        setPoliteMessage(info)
        window.setTimeout(() => {
          const nextButton = nextSubmissionId ? pendingApproveButtonRefs.current[nextSubmissionId] : null
          focusElement(nextButton ?? pendingRef.current)
        }, 0)
      } catch (error) {
        const localizedMessage = error instanceof Error ? error.message : 'Erreur lors du rejet.'
        setAssertiveMessage(localizedMessage)
        setPoliteMessage('')
        focusMessage()
      } finally {
        setRunningSubmissionId(null)
      }
    },
    [buildAuthHeaders, focusElement, focusMessage, rejectReasons, resolveNextPendingSubmissionId],
  )

  const handleTokenSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      const pendingLoaded = await loadPendingEntries()
      const publishedLoaded = await loadPublishedEntries()
      const blocklistsLoaded = await loadBlocklists()
      const maintenanceLoaded = await loadMaintenanceState()
      const unlocked = pendingLoaded || publishedLoaded || blocklistsLoaded || maintenanceLoaded

      if (unlocked) {
        persistStoredModerationSession(moderationToken, rememberModerationSession)
        setHasStoredModerationSession(true)
        setIsModerationUnlocked(true)
        setAssertiveMessage('')
        setPoliteMessage('Accès modération activé.')
        window.setTimeout(() => {
          focusPrimaryModerationAction()
        }, 0)
        return
      }

      lockModerationView()
    },
    [
      focusPrimaryModerationAction,
      loadBlocklists,
      loadMaintenanceState,
      loadPendingEntries,
      loadPublishedEntries,
      lockModerationView,
      moderationToken,
      rememberModerationSession,
    ],
  )

  const handleSetMaintenanceMode = useCallback(
    async (enabled: boolean) => {
      if (!hasToken) {
        setAssertiveMessage('Veuillez saisir un jeton de modération.')
        setPoliteMessage('')
        focusTokenInput()
        return
      }

      setIsSavingMaintenance(true)
      setAssertiveMessage('')
      setPoliteMessage(enabled ? 'Activation du mode maintenance...' : 'Désactivation du mode maintenance...')

      try {
        const response = await fetch('/api/moderation/maintenance', {
          method: 'POST',
          headers: buildAuthHeaders(true),
          body: JSON.stringify({
            enabled,
            message: maintenanceMessageInput,
          }),
        })
        const payload = await readApiPayload(response)

        if (!response.ok) {
          throw new Error(
            typeof payload.error === 'string'
              ? payload.error
              : 'Mise à jour du mode maintenance impossible.',
          )
        }

        const nextState = normalizeMaintenanceStatePayload(payload)
        setMaintenanceState(nextState)
        setMaintenanceMessageInput(nextState.message ?? '')
        setPoliteMessage(
          toNullableString(payload.messageText) ??
            (nextState.enabled ? 'Mode maintenance activé.' : 'Mode maintenance désactivé.'),
        )
        setAssertiveMessage('')
      } catch (error) {
        const localizedMessage =
          error instanceof Error ? error.message : 'Erreur lors de la mise à jour du mode maintenance.'
        setAssertiveMessage(localizedMessage)
        setPoliteMessage('')
        focusMessage()
      } finally {
        setIsSavingMaintenance(false)
      }
    },
    [buildAuthHeaders, focusMessage, focusTokenInput, hasToken, maintenanceMessageInput],
  )

  const handleExportArchive = useCallback(async () => {
    if (!hasToken) {
      setAssertiveMessage('Veuillez saisir un jeton de modération.')
      setPoliteMessage('')
      focusTokenInput()
      return
    }

    setIsExportingArchive(true)
    setAssertiveMessage('')
    setPoliteMessage('Préparation de l’archive en cours...')

    try {
      const response = await fetch('/api/moderation/archive', {
        headers: buildAuthHeaders(false),
      })

      if (!response.ok) {
        const payload = await readApiPayload(response)
        throw new Error(typeof payload.error === 'string' ? payload.error : 'Export impossible.')
      }

      const archiveBlob = await response.blob()
      if (archiveBlob.size <= 0) {
        throw new Error('Archive vide reçue du serveur.')
      }

      const responseFilename = readFilenameFromDisposition(response.headers.get('content-disposition'))
      const fallbackFilename = `annuaire-rgaa-archive-${new Date()
        .toISOString()
        .replace(/[-:]/g, '')
        .replace(/\.\d{3}Z$/, 'Z')}.json`
      const archiveFilename = responseFilename || fallbackFilename

      const downloadUrl = window.URL.createObjectURL(archiveBlob)
      const downloadAnchor = document.createElement('a')
      downloadAnchor.href = downloadUrl
      downloadAnchor.download = archiveFilename
      downloadAnchor.rel = 'noopener'
      document.body.append(downloadAnchor)
      downloadAnchor.click()
      downloadAnchor.remove()
      window.URL.revokeObjectURL(downloadUrl)

      setPoliteMessage(`Archive exportée: ${archiveFilename}`)
      setAssertiveMessage('')
      focusArchive()
    } catch (error) {
      const localizedMessage = error instanceof Error ? error.message : 'Erreur lors de l’export.'
      setAssertiveMessage(localizedMessage)
      setPoliteMessage('')
      focusMessage()
    } finally {
      setIsExportingArchive(false)
    }
  }, [buildAuthHeaders, focusArchive, focusMessage, focusTokenInput, hasToken])

  const handleArchiveFileChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    setArchiveImportFile(file)
    setArchiveImportFileName(file?.name ?? '')
  }, [])

  const handleImportArchive = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()

      if (!hasToken) {
        setAssertiveMessage('Veuillez saisir un jeton de modération.')
        setPoliteMessage('')
        focusTokenInput()
        return
      }

      if (!archiveImportFile) {
        setAssertiveMessage('Veuillez sélectionner un fichier d’archive JSON.')
        setPoliteMessage('')
        focusElement(archiveImportInputRef.current)
        return
      }

      setIsImportingArchive(true)
      setAssertiveMessage('')
      setPoliteMessage('Import de l’archive en cours...')

      try {
        const archiveRawText = await archiveImportFile.text()
        let parsedArchive: unknown = null
        try {
          parsedArchive = JSON.parse(archiveRawText)
        } catch {
          throw new Error('Fichier JSON invalide.')
        }

        const response = await fetch('/api/moderation/archive/import', {
          method: 'POST',
          headers: buildAuthHeaders(true),
          body: JSON.stringify({
            mode: archiveImportMode,
            allowRollback: allowArchiveRollbackImport,
            archive: parsedArchive,
          }),
        })
        const payload = await readApiPayload(response)

        if (!response.ok) {
          throw new Error(typeof payload.error === 'string' ? payload.error : 'Import impossible.')
        }

        await Promise.all([loadPendingEntries(), loadPublishedEntries(), loadBlocklists(), loadMaintenanceState()])

        const message =
          toNullableString(payload.message) ??
          (archiveImportMode === 'replace'
            ? 'Archive importée en mode remplacement.'
            : 'Archive importée en mode fusion.')
        setPoliteMessage(message)
        setAssertiveMessage('')

        setArchiveImportFile(null)
        setArchiveImportFileName('')
        setAllowArchiveRollbackImport(false)
        if (archiveImportInputRef.current) {
          archiveImportInputRef.current.value = ''
        }

        focusArchive()
      } catch (error) {
        const localizedMessage = error instanceof Error ? error.message : 'Erreur lors de l’import.'
        setAssertiveMessage(localizedMessage)
        setPoliteMessage('')
        focusMessage()
      } finally {
        setIsImportingArchive(false)
      }
    },
    [
      archiveImportFile,
      archiveImportMode,
      allowArchiveRollbackImport,
      buildAuthHeaders,
      focusArchive,
      focusElement,
      focusMessage,
      focusTokenInput,
      hasToken,
      loadBlocklists,
      loadMaintenanceState,
      loadPendingEntries,
      loadPublishedEntries,
    ],
  )

  const handlePublishedDraftChange = useCallback(
    <K extends keyof PublishedEntryDraft>(normalizedUrl: string, field: K, value: PublishedEntryDraft[K]) => {
      setPublishedDrafts((current) => {
        const existing = current[normalizedUrl]
        if (!existing) {
          return current
        }

        return {
          ...current,
          [normalizedUrl]: { ...existing, [field]: value },
        }
      })
      setPublishedFeedbackByUrl((current) => {
        const existing = current[normalizedUrl]
        if (existing && existing.tone === 'info' && existing.message === 'Modifications non enregistrées.') {
          return current
        }

        return {
          ...current,
          [normalizedUrl]: {
            tone: 'info',
            message: 'Modifications non enregistrées.',
          },
        }
      })
    },
    [],
  )

  const handleUpdatePublishedEntry = useCallback(
    async (normalizedUrl: string) => {
      const draft = publishedDrafts[normalizedUrl]
      if (!draft) {
        return
      }

      const scoreRaw = draft.complianceScore.trim()
      let normalizedScore: number | null = null
      if (scoreRaw) {
        const scoreNumber = Number(scoreRaw.replace(',', '.'))
        if (Number.isNaN(scoreNumber) || scoreNumber < 0 || scoreNumber > 100) {
          const message = 'Le score doit être un nombre compris entre 0 et 100.'
          setPublishedFeedbackByUrl((current) => ({
            ...current,
            [normalizedUrl]: {
              tone: 'error',
              message,
            },
          }))
          setAssertiveMessage(message)
          setPoliteMessage('')
          window.setTimeout(() => {
            focusElement(publishedScoreInputRefs.current[normalizedUrl])
          }, 0)
          return
        }

        normalizedScore = Math.round(scoreNumber * 100) / 100
      }

      setRunningPublishedUrl(normalizedUrl)
      setDeleteConfirmationUrl(null)
      setAssertiveMessage('')
      setPoliteMessage('Mise à jour de l’entrée en cours...')
      setPublishedFeedbackByUrl((current) => ({
        ...current,
        [normalizedUrl]: {
          tone: 'info',
          message: 'Enregistrement en cours...',
        },
      }))

      try {
        const response = await fetch('/api/moderation/showcase/update', {
          method: 'POST',
          headers: buildAuthHeaders(true),
          body: JSON.stringify({
            normalizedUrl,
            siteTitle: draft.siteTitle,
            category: draft.category,
            complianceStatus: draft.complianceStatus || null,
            complianceScore: normalizedScore,
            rgaaBaseline: draft.rgaaBaseline,
            thumbnailUrl: draft.thumbnailUrl || null,
            accessibilityPageUrl: draft.accessibilityPageUrl || null,
          }),
        })
        const payload = await readApiPayload(response)
        const info = toNullableString(payload.message) ?? 'Entrée mise à jour.'

        if (!response.ok) {
          throw new Error(typeof payload.error === 'string' ? payload.error : 'Mise à jour impossible.')
        }

        if (!isShowcaseEntry(payload)) {
          throw new Error('Réponse serveur invalide.')
        }

        setPublishedEntries((current) =>
          current.map((entry) => (entry.normalizedUrl === normalizedUrl ? payload : entry)),
        )
        setPublishedDrafts((current) => ({
          ...current,
          [normalizedUrl]: toPublishedEntryDraft(payload),
        }))
        setPublishedFeedbackByUrl((current) => ({
          ...current,
          [normalizedUrl]: {
            tone: 'success',
            message: 'Entrée mise à jour avec succès.',
          },
        }))
        setPoliteMessage(info)
        setAssertiveMessage('')
        window.setTimeout(() => {
          focusElement(publishedSaveButtonRefs.current[normalizedUrl])
        }, 0)
      } catch (error) {
        const localizedMessage = error instanceof Error ? error.message : 'Erreur lors de la mise à jour.'
        setPublishedFeedbackByUrl((current) => ({
          ...current,
          [normalizedUrl]: {
            tone: 'error',
            message: localizedMessage,
          },
        }))
        setAssertiveMessage(localizedMessage)
        setPoliteMessage('')
        window.setTimeout(() => {
          focusElement(publishedFeedbackRefs.current[normalizedUrl] ?? messageRef.current)
        }, 0)
      } finally {
        setRunningPublishedUrl(null)
      }
    },
    [buildAuthHeaders, focusElement, publishedDrafts],
  )

  const handleDeletePublishedEntry = useCallback(
    async (normalizedUrl: string) => {
      if (deleteConfirmationUrl !== normalizedUrl) {
        setDeleteConfirmationUrl(normalizedUrl)
        setPublishedFeedbackByUrl((current) => ({
          ...current,
          [normalizedUrl]: {
            tone: 'info',
            message: 'Cliquez à nouveau sur supprimer pour confirmer.',
          },
        }))
        setAssertiveMessage('')
        setPoliteMessage('Cliquez à nouveau sur supprimer pour confirmer.')
        window.setTimeout(() => {
          focusElement(publishedDeleteButtonRefs.current[normalizedUrl])
        }, 0)
        return
      }

      const currentIndex = publishedEntries.findIndex((entry) => entry.normalizedUrl === normalizedUrl)
      const nextPublishedUrl =
        publishedEntries[currentIndex + 1]?.normalizedUrl ?? publishedEntries[currentIndex - 1]?.normalizedUrl ?? null

      setRunningPublishedUrl(normalizedUrl)
      setAssertiveMessage('')
      setPoliteMessage('Suppression de l’entrée en cours...')
      setPublishedFeedbackByUrl((current) => ({
        ...current,
        [normalizedUrl]: {
          tone: 'info',
          message: 'Suppression en cours...',
        },
      }))

      try {
        const response = await fetch('/api/moderation/showcase/delete', {
          method: 'POST',
          headers: buildAuthHeaders(true),
          body: JSON.stringify({
            normalizedUrl,
          }),
        })
        const payload = await readApiPayload(response)

        if (!response.ok) {
          throw new Error(typeof payload.error === 'string' ? payload.error : 'Suppression impossible.')
        }

        const info = toNullableString(payload.message) ?? 'Entrée supprimée.'
        setPublishedEntries((current) => current.filter((entry) => entry.normalizedUrl !== normalizedUrl))
        setPublishedDrafts((current) => {
          const next = { ...current }
          delete next[normalizedUrl]
          return next
        })
        setPublishedFeedbackByUrl((current) => {
          const next = { ...current }
          delete next[normalizedUrl]
          return next
        })
        setDeleteConfirmationUrl(null)
        setPoliteMessage(info)
        window.setTimeout(() => {
          const nextDeleteButton = nextPublishedUrl ? publishedDeleteButtonRefs.current[nextPublishedUrl] : null
          focusElement(nextDeleteButton ?? publishedRef.current)
        }, 0)
      } catch (error) {
        const localizedMessage = error instanceof Error ? error.message : 'Erreur lors de la suppression.'
        setPublishedFeedbackByUrl((current) => ({
          ...current,
          [normalizedUrl]: {
            tone: 'error',
            message: localizedMessage,
          },
        }))
        setAssertiveMessage(localizedMessage)
        setPoliteMessage('')
        window.setTimeout(() => {
          focusElement(publishedFeedbackRefs.current[normalizedUrl] ?? messageRef.current)
        }, 0)
      } finally {
        setRunningPublishedUrl(null)
      }
    },
    [buildAuthHeaders, deleteConfirmationUrl, focusElement, publishedEntries],
  )

  const handleSetSiteBlocked = useCallback(
    async (normalizedUrl: string, blocked: boolean) => {
      setRunningBlocklistSiteUrl(normalizedUrl)
      setAssertiveMessage('')
      setPoliteMessage(blocked ? 'Ajout à la blocklist en cours...' : 'Retrait de la blocklist en cours...')

      try {
        const response = await fetch('/api/moderation/blocklist/site', {
          method: 'POST',
          headers: buildAuthHeaders(true),
          body: JSON.stringify({
            normalizedUrl,
            blocked,
          }),
        })
        const payload = await readApiPayload(response)

        if (!response.ok) {
          throw new Error(typeof payload.error === 'string' ? payload.error : 'Mise à jour blocklist impossible.')
        }

        const nextSiteBlocklist = Array.isArray(payload.siteBlocklist)
          ? payload.siteBlocklist.filter((value): value is string => typeof value === 'string')
          : []
        setSiteBlocklist(nextSiteBlocklist)
        setPublishedEntries((current) =>
          current.map((entry) =>
            entry.normalizedUrl === normalizedUrl
              ? {
                  ...entry,
                  siteBlocked: blocked,
                }
              : entry,
          ),
        )

        const message =
          typeof payload.message === 'string'
            ? payload.message
            : blocked
              ? 'Site ajouté à la blocklist.'
              : 'Site retiré de la blocklist.'
        setPoliteMessage(message)
        setAssertiveMessage('')
        return true
      } catch (error) {
        const localizedMessage = error instanceof Error ? error.message : 'Erreur lors de la mise à jour blocklist.'
        setAssertiveMessage(localizedMessage)
        setPoliteMessage('')
        focusMessage()
        return false
      } finally {
        setRunningBlocklistSiteUrl(null)
      }
    },
    [buildAuthHeaders, focusMessage],
  )

  const handleSetVotesBlocked = useCallback(
    async (normalizedUrl: string, blocked: boolean) => {
      setRunningBlocklistVoteUrl(normalizedUrl)
      setAssertiveMessage('')
      setPoliteMessage(blocked ? 'Blocage des votes en cours...' : 'Déblocage des votes en cours...')

      try {
        const response = await fetch('/api/moderation/blocklist/votes', {
          method: 'POST',
          headers: buildAuthHeaders(true),
          body: JSON.stringify({
            normalizedUrl,
            blocked,
          }),
        })
        const payload = await readApiPayload(response)

        if (!response.ok) {
          throw new Error(typeof payload.error === 'string' ? payload.error : 'Mise à jour du blocage votes impossible.')
        }

        const nextVoteBlocklist = Array.isArray(payload.voteBlocklist)
          ? payload.voteBlocklist.filter((value): value is string => typeof value === 'string')
          : []
        setVoteBlocklist(nextVoteBlocklist)
        setPublishedEntries((current) =>
          current.map((entry) =>
            entry.normalizedUrl === normalizedUrl
              ? {
                  ...entry,
                  votesBlocked: blocked,
                }
              : entry,
          ),
        )

        const message =
          typeof payload.message === 'string'
            ? payload.message
            : blocked
              ? 'Votes bloqués pour ce site.'
              : 'Blocage des votes levé pour ce site.'
        setPoliteMessage(message)
        setAssertiveMessage('')
        return true
      } catch (error) {
        const localizedMessage = error instanceof Error ? error.message : 'Erreur lors de la mise à jour des votes.'
        setAssertiveMessage(localizedMessage)
        setPoliteMessage('')
        focusMessage()
        return false
      } finally {
        setRunningBlocklistVoteUrl(null)
      }
    },
    [buildAuthHeaders, focusMessage],
  )

  const handleDeleteAndBlockPublishedEntry = useCallback(
    async (normalizedUrl: string) => {
      const currentIndex = publishedEntries.findIndex((entry) => entry.normalizedUrl === normalizedUrl)
      const nextPublishedUrl =
        publishedEntries[currentIndex + 1]?.normalizedUrl ?? publishedEntries[currentIndex - 1]?.normalizedUrl ?? null

      setRunningPublishedUrl(normalizedUrl)
      setAssertiveMessage('')
      setPoliteMessage('Suppression + blocklist en cours...')

      try {
        const response = await fetch('/api/moderation/showcase/delete-and-block', {
          method: 'POST',
          headers: buildAuthHeaders(true),
          body: JSON.stringify({
            normalizedUrl,
          }),
        })
        const payload = await readApiPayload(response)

        if (!response.ok) {
          throw new Error(typeof payload.error === 'string' ? payload.error : 'Suppression + blocklist impossible.')
        }

        setPublishedEntries((current) => current.filter((entry) => entry.normalizedUrl !== normalizedUrl))
        setPublishedDrafts((current) => {
          const next = { ...current }
          delete next[normalizedUrl]
          return next
        })
        setPublishedFeedbackByUrl((current) => {
          const next = { ...current }
          delete next[normalizedUrl]
          return next
        })
        setDeleteConfirmationUrl(null)
        await loadBlocklists()

        const message =
          typeof payload.message === 'string'
            ? payload.message
            : 'Site supprimé et ajouté à la blocklist.'
        setPoliteMessage(message)
        setAssertiveMessage('')

        window.setTimeout(() => {
          const nextButton = nextPublishedUrl ? publishedDeleteAndBlockButtonRefs.current[nextPublishedUrl] : null
          focusElement(nextButton ?? publishedRef.current)
        }, 0)
      } catch (error) {
        const localizedMessage =
          error instanceof Error ? error.message : 'Erreur lors de la suppression avec blocklist.'
        setAssertiveMessage(localizedMessage)
        setPoliteMessage('')
        focusMessage()
      } finally {
        setRunningPublishedUrl(null)
      }
    },
    [buildAuthHeaders, focusElement, focusMessage, loadBlocklists, publishedEntries],
  )

  const handleAddSiteBlocklist = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      const normalizedUrl = siteBlocklistInput.trim()
      if (!normalizedUrl) {
        setAssertiveMessage('Veuillez saisir une URL à bloquer.')
        setPoliteMessage('')
        focusElement(siteBlocklistInputRef.current)
        return
      }

      const updated = await handleSetSiteBlocked(normalizedUrl, true)
      if (updated) {
        setSiteBlocklistInput('')
        window.setTimeout(() => {
          focusSiteBlocklist()
        }, 0)
      }
    },
    [focusElement, focusSiteBlocklist, handleSetSiteBlocked, siteBlocklistInput],
  )

  const handleAddVoteBlocklist = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      const normalizedUrl = voteBlocklistInput.trim()
      if (!normalizedUrl) {
        setAssertiveMessage('Veuillez saisir une URL pour bloquer les votes.')
        setPoliteMessage('')
        focusElement(voteBlocklistInputRef.current)
        return
      }

      const updated = await handleSetVotesBlocked(normalizedUrl, true)
      if (updated) {
        setVoteBlocklistInput('')
        window.setTimeout(() => {
          focusVoteBlocklist()
        }, 0)
      }
    },
    [focusElement, focusVoteBlocklist, handleSetVotesBlocked, voteBlocklistInput],
  )

  useEffect(() => {
    applySeo({
      title: 'Modération | Annuaire RGAA',
      description: 'Espace de modération interne pour valider ou rejeter les soumissions de l’annuaire RGAA.',
      path: '/moderation',
      robots: 'noindex,nofollow,noarchive',
      structuredData: null,
    })
  }, [])

  useEffect(() => {
    const restoredSession = readStoredModerationSession()
    if (!restoredSession) {
      clearStoredModerationSession()
      setHasStoredModerationSession(false)
      return
    }

    setModerationToken(restoredSession.token)
    setRememberModerationSession(restoredSession.source === 'local')
    setHasStoredModerationSession(true)
    setAssertiveMessage('')
    setPoliteMessage('Jeton restauré. Activez le chargement pour ouvrir la modération.')
  }, [])

  return (
    <>
      <div
        className={skipLinksContainerClass}
        aria-label="Liens d’évitement"
      >
        <a href="#contenu-moderation" className={skipLinkClass} onClick={focusMain}>
          Aller au contenu
        </a>
        <a href="#navigation-principale" className={skipLinkClass} onClick={focusNavigation}>
          Aller à la navigation principale
        </a>
        <a href="/#moteur-recherche-global" className={skipLinkClass}>
          Aller à la recherche annuaire
        </a>
        {isModerationUnlocked && (
          <>
            <a href="#soumissions-attente" className={skipLinkClass} onClick={focusPending}>
              Aller aux validations
            </a>
            <a href="#annuaire-publie" className={skipLinkClass} onClick={focusPublished}>
              Aller à l’annuaire publié
            </a>
            <a href="#blocklist-sites" className={skipLinkClass} onClick={focusSiteBlocklist}>
              Aller à la blocklist sites
            </a>
            <a href="#blocklist-votes" className={skipLinkClass} onClick={focusVoteBlocklist}>
              Aller à la blocklist votes
            </a>
            <a href="#archive-donnees" className={skipLinkClass} onClick={focusArchive}>
              Aller à l’archivage
            </a>
            <a href="#mode-maintenance" className={skipLinkClass} onClick={focusMaintenance}>
              Aller au mode maintenance
            </a>
          </>
        )}
        <a href="#pied-page" className={skipLinkClass} onClick={focusFooter}>
          Aller au pied de page
        </a>
      </div>

      <div className="sr-only" style={visuallyHiddenStyle} role="status" aria-live="polite" aria-atomic="true" lang="fr">
        {politeMessage}
      </div>
      <div className="sr-only" style={visuallyHiddenStyle} role="alert" aria-live="assertive" aria-atomic="true" lang="fr">
        {assertiveMessage}
      </div>

      <div className="min-h-screen bg-brand-surface text-brand-ink">
        <SecondaryPageHeader
          title="Modération Annuaire RGAA"
          navigationRef={navigationRef}
          description="Validez ou rejetez les soumissions en attente sans passer par `curl`."
          currentPath="/moderation"
        />

        <main
          id="contenu-moderation"
          ref={mainRef}
          tabIndex={-1}
          className={`mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 ${focusTargetScrollMarginClass} ${focusTargetClass}`}
        >
          {!isModerationUnlocked && (
            <section className={`rounded-2xl p-6 ${moderationSurfaceClass}`}>
            <h2 className="text-lg font-semibold">Authentification modérateur</h2>
            <form className="mt-4 grid gap-3 md:grid-cols-[2fr_auto_auto]" onSubmit={handleTokenSubmit}>
              <div>
                <label htmlFor="token-moderation" className="block text-sm font-medium">
                  Jeton de modération
                </label>
                <input
                  ref={tokenInputRef}
                  id="token-moderation"
                  type={showToken ? 'text' : 'password'}
                  value={moderationToken}
                  onChange={(event) => {
                    const nextToken = event.target.value
                    setModerationToken(nextToken)
                    if (!nextToken.trim()) {
                      clearStoredModerationSession()
                      setHasStoredModerationSession(false)
                      if (isModerationUnlocked) {
                        lockModerationView()
                        setPoliteMessage('Accès modération verrouillé.')
                        setAssertiveMessage('')
                      }
                    }
                  }}
                  aria-describedby="token-session-help"
                  autoComplete="off"
                  required
                  spellCheck={false}
                  className={`mt-1 ${moderationFieldClass}`}
                />
                <label className={`mt-3 inline-flex min-h-11 items-center gap-2 text-sm ${focusRingClass}`}>
                  <input
                    type="checkbox"
                    checked={rememberModerationSession}
                    onChange={(event) => setRememberModerationSession(event.target.checked)}
                  />
                  Mémoriser sur cet appareil pendant 12 heures
                </label>
                <p id="token-session-help" className={`mt-1 text-sm ${moderationTextMutedClass}`}>
                  La session est conservée dans cet onglet. Avec l’option “Mémoriser sur cet appareil”, elle est aussi conservée pendant 12 heures.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowToken((current) => !current)}
                className={`min-h-11 rounded-xl px-4 py-2 text-sm font-semibold ${ctaDisabledClass} ${moderationCtaNeutralClass} ${focusRingClass} md:self-end`}
              >
                {showToken ? 'Masquer' : 'Afficher'}
              </button>
              <button
                type="submit"
                disabled={isLoadingList || isLoadingPublished || isLoadingMaintenance}
                className={`min-h-11 rounded-xl px-4 py-2 text-sm font-semibold ${ctaDisabledClass} ${moderationCtaPrimaryClass} ${focusRingClass} md:self-end`}
              >
                {isLoadingList || isLoadingPublished || isLoadingMaintenance ? 'Chargement...' : 'Charger la modération'}
              </button>
            </form>

            {(isModerationUnlocked || hasStoredModerationSession) && (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={handleSignOut}
                  className={`min-h-11 rounded-xl px-4 py-2 text-sm font-semibold ${ctaDisabledClass} ${moderationCtaNeutralClass} ${focusRingClass}`}
                >
                  Se déconnecter et oublier la session
                </button>
              </div>
            )}

            </section>
          )}

          {(politeMessage || assertiveMessage) && (
            <p
              ref={messageRef}
              tabIndex={-1}
              className={`mt-4 rounded-lg border p-3 text-sm ${
                assertiveMessage ? moderationDangerPanelClass : moderationInfoPanelClass
              }`}
              role={assertiveMessage ? 'alert' : 'status'}
              aria-live={assertiveMessage ? 'assertive' : 'polite'}
            >
              {assertiveMessage || politeMessage}
            </p>
          )}

          {!isModerationUnlocked && (
            <section className={`mt-8 rounded-2xl p-6 ${moderationSurfaceClass}`}>
              <h2 className="text-lg font-semibold">Accès protégé</h2>
              <p className={`mt-2 ${moderationTextMutedClass}`}>
                Les tableaux de bord et contrôles de modération restent masqués tant qu’un jeton valide n’a pas été confirmé.
              </p>
            </section>
          )}

          {isModerationUnlocked && (
            <>
              <section
                id="soumissions-attente"
                ref={pendingRef}
                tabIndex={-1}
                className={`mt-8 rounded-3xl p-5 sm:p-6 ${
                  pendingEntries.length > 0 ? moderationPendingSectionClass : moderationSurfaceClass
                }`}
                aria-labelledby="soumissions-attente-titre"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 id="soumissions-attente-titre" className="text-lg font-semibold text-slate-950 dark:text-slate-50">
                      Soumissions en attente
                    </h2>
                    <p className={`mt-2 ${moderationTextStrongClass}`}>
                      {pendingEntries.length} soumission(s) à traiter.
                    </p>
                    {pendingEntries.length > 0 && (
                      <p className={`mt-1 text-sm ${moderationTextStrongClass}`}>
                        {buildProgressiveListSummary(
                          visiblePendingEntries.length,
                          pendingEntries.length,
                          'soumission(s) en attente',
                        )}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex min-h-11 items-center rounded-full border px-4 py-2 text-sm font-extrabold ${
                        pendingEntries.length > 0
                          ? moderationWarningBadgeClass
                          : moderationNeutralBadgeClass
                      }`}
                    >
                      {pendingEntries.length > 0 ? `Action requise: ${pendingEntries.length}` : 'File vide'}
                    </span>
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className={`min-h-11 rounded-xl px-4 py-2 text-sm font-semibold ${ctaDisabledClass} ${moderationCtaNeutralClass} ${focusRingClass}`}
                    >
                      Se déconnecter
                    </button>
                  </div>
                </div>

                {pendingEntries.length === 0 ? (
                  <p className={`mt-4 rounded-xl p-4 ${moderationSurfaceStrongClass} ${moderationTextMutedClass}`}>
                    Aucune soumission en attente.
                  </p>
                ) : (
                  <>
                    <p className={`mt-4 rounded-2xl p-4 text-sm font-semibold shadow-sm ${moderationWarningPanelClass}`}>
                      Priorité de modération: ces soumissions attendent une validation manuelle. Traitez-les pour éviter
                      qu’elles restent oubliées dans la file.
                    </p>

                    <ul className="mt-5 grid gap-4">
                      {visiblePendingEntries.map((entry) => {
                        const rejectReasonValue = rejectReasons[entry.submissionId] ?? ''
                        const isActionRunning = runningSubmissionId === entry.submissionId
                        const score = toNullableNumber(entry.complianceScore)
                        return (
                          <li
                            key={entry.submissionId}
                            className={moderationPendingCardClass}
                          >
                            <article>
                              <div className={moderationPendingCardHeaderClass}>
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-amber-950 dark:text-amber-100">
                                      Validation manuelle requise
                                    </p>
                                    <h3 className="mt-1 text-lg font-semibold text-slate-950 dark:text-slate-50">
                                      {entry.siteTitle}
                                    </h3>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className={`inline-flex min-h-10 items-center rounded-full px-3 py-1 text-sm font-extrabold ${moderationDangerBadgeClass}`}>
                                      À traiter
                                    </span>
                                    <span className={`inline-flex min-h-10 items-center rounded-full px-3 py-1 text-sm font-semibold ${moderationNeutralBadgeClass}`}>
                                      {entry.category}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="p-4 sm:p-5">
                                <p className="wrap-anywhere text-sm font-semibold text-slate-900 dark:text-slate-50">
                                  {entry.normalizedUrl}
                                </p>
                                {entry.domainContext ? (
                                  <div className={`mt-3 rounded-xl px-3 py-3 text-sm ${moderationInfoPanelClass}`}>
                                    <p className="font-semibold">
                                      Domaine rapproché: {entry.domainContext.registrableDomain}
                                    </p>
                                    <p className="mt-1">
                                      {entry.domainContext.publishedSiteCount ?? entry.domainContext.siteCount} fiche(s)
                                      publiée(s) et {entry.domainContext.pendingSiteCount ?? 0} soumission(s) en attente
                                      pour ce domaine.
                                    </p>
                                    {entry.domainContext.groupPath ? (
                                      <p className="mt-2">
                                        <a
                                          href={entry.domainContext.groupPath}
                                          className={moderationPanelLinkClass}
                                        >
                                          Voir la page domaine
                                        </a>
                                      </p>
                                    ) : null}
                                    {entry.domainContext.siblings.length > 0 ? (
                                      <ul className="mt-2 list-disc space-y-1 ps-5">
                                        {entry.domainContext.siblings.slice(0, 3).map((sibling) => (
                                          <li key={sibling.normalizedUrl}>
                                            {sibling.siteTitle}
                                            {sibling.profilePath ? (
                                              <>
                                                {' '}
                                                ·{' '}
                                                <a
                                                  href={sibling.profilePath}
                                                  className={moderationPanelLinkClass}
                                                >
                                                  fiche publique
                                                </a>
                                              </>
                                            ) : null}
                                          </li>
                                        ))}
                                      </ul>
                                    ) : null}
                                  </div>
                                ) : null}
                                <dl className={`mt-3 grid gap-2 text-sm ${moderationTextStrongClass} sm:grid-cols-2`}>
                                  <div className={`rounded-xl px-3 py-2 ${moderationWarningPanelClass}`}>
                                    <dt className="font-semibold text-slate-900 dark:text-slate-50">Créée le</dt>
                                    <dd className="mt-1">{formatDate(entry.createdAt)}</dd>
                                  </div>
                                  <div className={`rounded-xl px-3 py-2 ${moderationWarningPanelClass}`}>
                                    <dt className="font-semibold text-slate-900 dark:text-slate-50">Dernière analyse</dt>
                                    <dd className="mt-1">{formatDate(entry.updatedAt)}</dd>
                                  </div>
                                  <div className={`rounded-xl px-3 py-2 ${moderationWarningPanelClass}`}>
                                    <dt className="font-semibold text-slate-900 dark:text-slate-50">Niveau</dt>
                                    <dd className="mt-1">
                                      {entry.complianceStatusLabel ?? 'Inconnu'} | Score: {formatScore(score)}
                                    </dd>
                                  </div>
                                  <div className={`rounded-xl px-3 py-2 ${moderationWarningPanelClass}`}>
                                    <dt className="font-semibold text-slate-900 dark:text-slate-50">Référentiel</dt>
                                    <dd className="mt-1">{formatRgaaBaseline(entry.rgaaBaseline)}</dd>
                                  </div>
                                </dl>

                                {entry.reviewReason && (
                                  <p className={`mt-3 rounded-xl p-3 text-sm font-semibold ${moderationWarningPanelClass}`}>
                                    Motif de validation manuelle: {entry.reviewReason}
                                  </p>
                                )}

                                <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-end">
                                  <div>
                                    <label htmlFor={`reject-reason-${entry.submissionId}`} className="block text-sm font-medium text-slate-950 dark:text-slate-50">
                                      Motif de rejet (optionnel)
                                    </label>
                                    <input
                                      id={`reject-reason-${entry.submissionId}`}
                                      value={rejectReasonValue}
                                      onChange={(event) =>
                                        setRejectReasons((current) => ({
                                          ...current,
                                          [entry.submissionId]: event.target.value,
                                        }))
                                      }
                                      className={`mt-1 ${moderationValidatedFieldStrongClass}`}
                                    />
                                  </div>
                                  <button
                                    ref={(element) => {
                                      pendingApproveButtonRefs.current[entry.submissionId] = element
                                    }}
                                    type="button"
                                    onClick={() => {
                                      void handleApprove(entry.submissionId)
                                    }}
                                    disabled={isActionRunning}
                                    className={`min-h-11 rounded-xl px-4 py-2 text-sm font-extrabold shadow-sm ${ctaDisabledClass} ${moderationCtaSuccessClass} ${focusRingClass} md:self-end`}
                                  >
                                    {isActionRunning ? 'Traitement...' : 'Approuver'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      void handleReject(entry.submissionId)
                                    }}
                                    disabled={isActionRunning}
                                    className={`min-h-11 rounded-xl px-4 py-2 text-sm font-extrabold shadow-sm ${ctaDisabledClass} ${moderationCtaDangerClass} ${focusRingClass} md:self-end`}
                                  >
                                    {isActionRunning ? 'Traitement...' : 'Rejeter'}
                                  </button>
                                </div>
                              </div>
                            </article>
                          </li>
                        )
                      })}
                    </ul>
                    {hasMorePendingEntries && (
                      <div className="mt-4 flex flex-col items-start gap-3">
                        <button
                          type="button"
                          onClick={() => handleLoadMorePendingEntries('button')}
                          className={`inline-flex min-h-11 items-center rounded-xl px-4 py-2 text-sm font-semibold ${ctaDisabledClass} ${moderationCtaNeutralClass} ${focusRingClass}`}
                        >
                          {formatLoadMoreLabel(
                            visiblePendingEntries.length,
                            pendingEntries.length,
                            MODERATION_BATCH_SIZE,
                            'soumission(s)',
                          )}
                        </button>
                        <p className={`text-sm ${moderationTextMutedClass}`}>
                          Chargement progressif actif pour garder la file exploitable au clavier et en lecture d’écran.
                        </p>
                      </div>
                    )}
                    {pendingEntries.length > 0 && (
                      <div ref={pendingSentinelRef} className="h-1 w-full" aria-hidden="true" />
                    )}
                  </>
                )}
              </section>

              <section
                id="annuaire-publie"
                ref={publishedRef}
                tabIndex={-1}
                className={`mt-8 ${focusTargetScrollMarginClass} ${focusTargetClass}`}
                aria-labelledby="annuaire-publie-titre"
                aria-busy={isLoadingPublished}
              >
            <h2 id="annuaire-publie-titre" className="text-lg font-semibold">Annuaire publié (édition et suppression)</h2>
            <p className={`mt-2 ${moderationTextMutedClass}`}>
              {publishedEntries.length} entrée(s) publiées.
            </p>
            {publishedEntries.length > 0 && (
              <p className={`mt-1 text-sm ${moderationTextMutedClass}`}>
                {buildProgressiveListSummary(
                  visiblePublishedEntries.length,
                  publishedEntries.length,
                  'entrée(s) publiée(s)',
                )}
              </p>
            )}
            <datalist id="moderation-category-suggestions">
              {availableModerationCategoryOptions.map((category) => (
                <option key={category} value={category} />
              ))}
            </datalist>

            {publishedEntries.length === 0 ? (
              <p className={`mt-4 rounded-xl p-4 ${moderationSurfaceStrongClass} ${moderationTextMutedClass}`}>
                Aucune entrée publiée chargée.
              </p>
            ) : (
              <ul className="mt-4 grid gap-4">
                {visiblePublishedEntries.map((entry) => {
                  const draft = publishedDrafts[entry.normalizedUrl]
                  if (!draft) {
                    return null
                  }

                  const itemId = toDomId(entry.normalizedUrl)
                  const isRunning = runningPublishedUrl === entry.normalizedUrl
                  const isDeleteConfirm = deleteConfirmationUrl === entry.normalizedUrl
                  const isSiteBlocked = entry.siteBlocked === true || siteBlocklist.includes(entry.normalizedUrl)
                  const areVotesBlocked = entry.votesBlocked === true || voteBlocklist.includes(entry.normalizedUrl)
                  const isSiteRuleRunning = runningBlocklistSiteUrl === entry.normalizedUrl
                  const isVoteRuleRunning = runningBlocklistVoteUrl === entry.normalizedUrl
                  const feedback = publishedFeedbackByUrl[entry.normalizedUrl]

                  return (
                    <li
                      key={entry.normalizedUrl}
                      className={`rounded-2xl p-4 ${moderationSurfaceClass}`}
                    >
                      <article>
                        <h3 className="text-lg font-semibold">{entry.siteTitle}</h3>
                        <p className={`mt-2 wrap-anywhere text-sm ${moderationTextMutedClass}`}>{entry.normalizedUrl}</p>
                        <p className={`mt-1 text-sm ${moderationTextMutedClass}`}>
                          Dernière mise à jour: {formatDate(entry.updatedAt)}
                        </p>
                        <p className={`mt-1 text-sm ${moderationTextMutedClass}`}>
                          Référentiel: {formatRgaaBaseline(entry.rgaaBaseline)}
                        </p>
                        {entry.domainContext ? (
                          <div className={`mt-3 rounded-xl px-3 py-3 text-sm ${moderationInfoPanelClass}`}>
                            <p className="font-semibold">
                              Domaine rapproché: {entry.domainContext.registrableDomain}
                            </p>
                            <p className="mt-1">
                              {entry.domainContext.siteCount} fiche(s) publique(s) pour ce domaine.
                            </p>
                            {entry.domainContext.groupPath ? (
                              <p className="mt-2">
                                <a
                                  href={entry.domainContext.groupPath}
                                  className={moderationPanelLinkClass}
                                >
                                  Voir la page domaine
                                </a>
                              </p>
                            ) : null}
                            {entry.domainContext.siblings.length > 0 ? (
                              <ul className="mt-2 list-disc space-y-1 ps-5">
                                {entry.domainContext.siblings.slice(0, 3).map((sibling) => (
                                  <li key={sibling.normalizedUrl}>
                                    {sibling.siteTitle}
                                    {sibling.profilePath ? (
                                      <>
                                        {' '}
                                        ·{' '}
                                        <a
                                          href={sibling.profilePath}
                                          className={moderationPanelLinkClass}
                                        >
                                          fiche publique
                                        </a>
                                      </>
                                    ) : null}
                                  </li>
                                ))}
                              </ul>
                            ) : null}
                          </div>
                        ) : null}
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span
                            className={`inline-flex min-h-8 items-center rounded-full px-3 py-1 text-sm font-semibold ${
                              isSiteBlocked
                                ? moderationDangerBadgeClass
                                : moderationNeutralBadgeClass
                            }`}
                          >
                            {isSiteBlocked ? 'Site en blocklist' : 'Site non bloqué'}
                          </span>
                          <span
                            className={`inline-flex min-h-8 items-center rounded-full px-3 py-1 text-sm font-semibold ${
                              areVotesBlocked
                                ? moderationWarningBadgeClass
                                : moderationNeutralBadgeClass
                            }`}
                          >
                            {areVotesBlocked ? 'Votes bloqués' : 'Votes autorisés'}
                          </span>
                        </div>

                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          <div>
                            <label htmlFor={`title-${itemId}`} className="block text-sm font-medium">
                              Nom du site
                            </label>
                            <input
                              id={`title-${itemId}`}
                              value={draft.siteTitle}
                              onChange={(event) =>
                                handlePublishedDraftChange(entry.normalizedUrl, 'siteTitle', event.target.value)
                              }
                              className={`mt-1 ${moderationValidatedFieldClass}`}
                            />
                          </div>
                          <div>
                            <label htmlFor={`category-${itemId}`} className="block text-sm font-medium">
                              Catégorie (saisie libre possible)
                            </label>
                            <input
                              id={`category-${itemId}`}
                              type="text"
                              list="moderation-category-suggestions"
                              autoComplete="off"
                              value={draft.category}
                              onChange={(event) =>
                                handlePublishedDraftChange(entry.normalizedUrl, 'category', event.target.value)
                              }
                              aria-describedby={`category-help-${itemId}`}
                              className={`mt-1 ${moderationFieldClass}`}
                            />
                            <p id={`category-help-${itemId}`} className={`mt-1 text-sm ${moderationTextMutedClass}`}>
                              Suggestions disponibles, ou catégorie personnalisée.
                            </p>
                          </div>
                          <div>
                            <label htmlFor={`status-${itemId}`} className="block text-sm font-medium">
                              Niveau de conformité
                            </label>
                            <select
                              id={`status-${itemId}`}
                              value={draft.complianceStatus}
                              onChange={(event) =>
                                handlePublishedDraftChange(
                                  entry.normalizedUrl,
                                  'complianceStatus',
                                  event.target.value as PublishedEntryDraft['complianceStatus'],
                                )
                              }
                              className={`mt-1 ${moderationFieldClass}`}
                            >
                              {complianceStatusOptions.map((statusOption) => (
                                <option key={statusOption.value || 'unknown'} value={statusOption.value}>
                                  {statusOption.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label htmlFor={`rgaa-baseline-${itemId}`} className="block text-sm font-medium">
                              Référentiel RGAA
                            </label>
                            <select
                              id={`rgaa-baseline-${itemId}`}
                              value={draft.rgaaBaseline}
                              onChange={(event) =>
                                handlePublishedDraftChange(
                                  entry.normalizedUrl,
                                  'rgaaBaseline',
                                  event.target.value as PublishedEntryDraft['rgaaBaseline'],
                                )
                              }
                              className={`mt-1 ${moderationFieldClass}`}
                            >
                              {rgaaBaselineOptions.map((baselineOption) => (
                                <option key={baselineOption.value} value={baselineOption.value}>
                                  {baselineOption.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label htmlFor={`score-${itemId}`} className="block text-sm font-medium">
                              Score
                            </label>
                            <input
                              ref={(element) => {
                                publishedScoreInputRefs.current[entry.normalizedUrl] = element
                              }}
                              id={`score-${itemId}`}
                              type="text"
                              inputMode="decimal"
                              value={draft.complianceScore}
                              onChange={(event) =>
                                handlePublishedDraftChange(entry.normalizedUrl, 'complianceScore', event.target.value)
                              }
                              aria-describedby={`score-help-${itemId}`}
                              className={`mt-1 ${moderationFieldClass}`}
                            />
                            <p id={`score-help-${itemId}`} className={`mt-1 text-sm ${moderationTextMutedClass}`}>
                              Valeur attendue entre 0 et 100 (décimales autorisées).
                            </p>
                          </div>
                          <div className="md:col-span-2">
                            <label htmlFor={`thumb-${itemId}`} className="block text-sm font-medium">
                              URL vignette (optionnel)
                            </label>
                            <input
                              id={`thumb-${itemId}`}
                              type="url"
                              inputMode="url"
                              value={draft.thumbnailUrl}
                              onChange={(event) =>
                                handlePublishedDraftChange(entry.normalizedUrl, 'thumbnailUrl', event.target.value)
                              }
                              className={`mt-1 ${moderationFieldClass}`}
                            />
                          </div>
                          <div className="md:col-span-2">
                            <label htmlFor={`a11y-${itemId}`} className="block text-sm font-medium">
                              URL déclaration d’accessibilité (optionnel)
                            </label>
                            <input
                              id={`a11y-${itemId}`}
                              type="url"
                              inputMode="url"
                              value={draft.accessibilityPageUrl}
                              onChange={(event) =>
                                handlePublishedDraftChange(
                                  entry.normalizedUrl,
                                  'accessibilityPageUrl',
                                  event.target.value,
                                )
                              }
                              className={`mt-1 ${moderationFieldClass}`}
                            />
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-3">
                          <button
                            ref={(element) => {
                              publishedSaveButtonRefs.current[entry.normalizedUrl] = element
                            }}
                            type="button"
                            onClick={() => {
                              void handleUpdatePublishedEntry(entry.normalizedUrl)
                            }}
                            disabled={isRunning}
                            className={`min-h-11 rounded-xl px-4 py-2 text-sm font-semibold ${ctaDisabledClass} ${moderationCtaPrimaryClass} ${focusRingClass}`}
                          >
                            {isRunning ? 'Traitement...' : 'Enregistrer'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              void handleSetVotesBlocked(entry.normalizedUrl, !areVotesBlocked)
                            }}
                            disabled={isRunning || isVoteRuleRunning}
                            className={`min-h-11 rounded-xl px-4 py-2 text-sm font-semibold ${ctaDisabledClass} ${focusRingClass} ${
                              areVotesBlocked ? moderationCtaWarningClass : moderationCtaSlateClass
                            }`}
                          >
                            {isVoteRuleRunning
                              ? 'Traitement...'
                              : areVotesBlocked
                                ? 'Autoriser les votes'
                                : 'Bloquer les votes'}
                          </button>
                          <button
                            ref={(element) => {
                              publishedDeleteButtonRefs.current[entry.normalizedUrl] = element
                            }}
                            type="button"
                            onClick={() => {
                              void handleDeletePublishedEntry(entry.normalizedUrl)
                            }}
                            disabled={isRunning}
                            className={`min-h-11 rounded-xl px-4 py-2 text-sm font-semibold ${ctaDisabledClass} ${focusRingClass} ${
                              isDeleteConfirm ? moderationCtaDangerStrongClass : moderationCtaDangerClass
                            }`}
                          >
                            {isRunning ? 'Traitement...' : isDeleteConfirm ? 'Confirmer suppression' : 'Supprimer'}
                          </button>
                          <button
                            ref={(element) => {
                              publishedDeleteAndBlockButtonRefs.current[entry.normalizedUrl] = element
                            }}
                            type="button"
                            onClick={() => {
                              void handleDeleteAndBlockPublishedEntry(entry.normalizedUrl)
                            }}
                            disabled={isRunning || isSiteRuleRunning}
                            className={`min-h-11 rounded-xl px-4 py-2 text-sm font-semibold ${ctaDisabledClass} ${moderationCtaDangerStrongClass} ${focusRingClass}`}
                          >
                            {isSiteRuleRunning ? 'Traitement...' : 'Supprimer + blocklist'}
                          </button>
                        </div>

                        {feedback && (
                          <p
                            ref={(element) => {
                              publishedFeedbackRefs.current[entry.normalizedUrl] = element
                            }}
                            tabIndex={-1}
                            className={`mt-3 rounded-lg border px-3 py-2 text-sm ${
                              feedback.tone === 'error'
                                ? moderationDangerPanelClass
                                : feedback.tone === 'success'
                                  ? moderationSuccessPanelClass
                                  : moderationInfoPanelClass
                            }`}
                            role={feedback.tone === 'error' ? 'alert' : 'status'}
                            aria-live={feedback.tone === 'error' ? 'assertive' : 'polite'}
                          >
                            {feedback.message}
                          </p>
                        )}
                      </article>
                    </li>
                  )
                })}
              </ul>
            )}
            {publishedEntries.length > 0 && hasMorePublishedEntries && (
              <div className="mt-6 flex justify-center">
                <button
                  type="button"
                  onClick={() => handleLoadMorePublishedEntries('button')}
                  className={`inline-flex min-h-12 items-center justify-center rounded-2xl px-7 py-3 text-base font-extrabold shadow-sm ${ctaDisabledClass} ${moderationCtaPrimaryClass} ${focusRingClass}`}
                >
                  {formatLoadMoreLabel(
                    visiblePublishedEntries.length,
                    publishedEntries.length,
                    MODERATION_PUBLISHED_BATCH_SIZE,
                    'entrée(s)',
                  )}
                </button>
              </div>
            )}
              </section>

              <div className="mt-8 grid gap-8 lg:grid-cols-2 lg:items-start">
              <section
                id="blocklist-sites"
                ref={siteBlocklistSectionRef}
                tabIndex={-1}
                className={`rounded-2xl border-2 border-rose-300 dark:border-rose-300 bg-rose-50 dark:bg-slate-950 p-6 ${focusTargetScrollMarginClass} ${focusTargetClass}`}
                aria-labelledby="blocklist-sites-titre"
              >
            <h2 id="blocklist-sites-titre" className="text-lg font-semibold text-rose-900 dark:text-rose-100">
              Blocklist des sites
            </h2>
            <p className={`mt-2 text-sm ${moderationTextMutedClass}`}>
              Les URL présentes ici ne peuvent plus être soumises. La liste reste modifiable à tout moment.
            </p>
            {siteBlocklist.length > 0 && (
              <p className={`mt-1 text-sm ${moderationTextMutedClass}`}>
                {buildProgressiveListSummary(
                  visibleSiteBlocklist.length,
                  siteBlocklist.length,
                  'site(s) en blocklist',
                )}
              </p>
            )}

            <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={handleAddSiteBlocklist}>
              <div className="min-w-0 flex-1">
                <label htmlFor="blocklist-site-url" className="block text-sm font-medium text-slate-950 dark:text-slate-50">
                  URL à bloquer
                </label>
                <input
                  ref={siteBlocklistInputRef}
                  id="blocklist-site-url"
                  type="url"
                  inputMode="url"
                  required
                  value={siteBlocklistInput}
                  onChange={(event) => setSiteBlocklistInput(event.target.value)}
                  placeholder="https://www.exemple.fr/"
                  className={`mt-1 ${moderationValidatedFieldClass}`}
                />
              </div>
              <button
                type="submit"
                disabled={runningBlocklistSiteUrl === siteBlocklistInput.trim()}
                className={`min-h-11 rounded-xl px-4 py-2 text-sm font-semibold ${ctaDisabledClass} ${moderationCtaDangerClass} ${focusRingClass}`}
              >
                Ajouter à la blocklist
              </button>
            </form>

            <ul className="mt-4 grid gap-2">
              {siteBlocklist.length === 0 ? (
                <li className={`rounded-xl p-3 text-sm ${moderationSurfaceStrongClass} ${moderationTextMutedClass}`}>
                  Aucun site en blocklist.
                </li>
              ) : (
                visibleSiteBlocklist.map((blockedUrl) => {
                  const isRunning = runningBlocklistSiteUrl === blockedUrl
                  return (
                    <li key={blockedUrl} className={`flex flex-wrap items-center justify-between gap-2 rounded-xl p-3 ${moderationSurfaceStrongClass}`}>
                      <span className="wrap-anywhere text-sm text-slate-800 dark:text-slate-50">{blockedUrl}</span>
                      <button
                        type="button"
                        onClick={() => {
                          void handleSetSiteBlocked(blockedUrl, false)
                        }}
                        aria-label={`Retirer ${blockedUrl} de la blocklist des sites`}
                        disabled={isRunning}
                        className={`min-h-11 rounded-xl px-4 py-2 text-sm font-semibold ${ctaDisabledClass} ${moderationCtaOutlineDangerClass} ${focusRingClass}`}
                      >
                        {isRunning ? 'Traitement...' : 'Retirer'}
                      </button>
                    </li>
                  )
                })
              )}
            </ul>
            {siteBlocklist.length > 0 && hasMoreSiteBlocklistEntries && (
              <div className="mt-4 flex flex-col items-start gap-3">
                <button
                  type="button"
                  onClick={() => handleLoadMoreSiteBlocklistEntries('button')}
                  className={`inline-flex min-h-11 items-center rounded-xl px-4 py-2 text-sm font-semibold ${ctaDisabledClass} ${moderationCtaOutlineDangerClass} ${focusRingClass}`}
                >
                  {formatLoadMoreLabel(
                    visibleSiteBlocklist.length,
                    siteBlocklist.length,
                    MODERATION_BATCH_SIZE,
                    'site(s)',
                  )}
                </button>
              </div>
            )}
            {siteBlocklist.length > 0 && (
              <div ref={siteBlocklistSentinelRef} className="h-1 w-full" aria-hidden="true" />
            )}
              </section>

              <section
                id="blocklist-votes"
                ref={voteBlocklistSectionRef}
                tabIndex={-1}
                className={`rounded-2xl border-2 border-amber-300 dark:border-amber-300 bg-amber-50 dark:bg-slate-950 p-6 ${focusTargetScrollMarginClass} ${focusTargetClass}`}
                aria-labelledby="blocklist-votes-titre"
              >
            <h2 id="blocklist-votes-titre" className="text-lg font-semibold text-amber-900 dark:text-amber-100">
              Blocage des votes
            </h2>
            <p className={`mt-2 text-sm ${moderationTextMutedClass}`}>
              Les votes sont désactivés côté public pour les URL listées, jusqu’à retrait manuel.
            </p>
            {voteBlocklist.length > 0 && (
              <p className={`mt-1 text-sm ${moderationTextMutedClass}`}>
                {buildProgressiveListSummary(
                  visibleVoteBlocklist.length,
                  voteBlocklist.length,
                  'blocage(s) de vote',
                )}
              </p>
            )}

            <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={handleAddVoteBlocklist}>
              <div className="min-w-0 flex-1">
                <label htmlFor="blocklist-vote-url" className="block text-sm font-medium text-slate-950 dark:text-slate-50">
                  URL pour bloquer les votes
                </label>
                <input
                  ref={voteBlocklistInputRef}
                  id="blocklist-vote-url"
                  type="url"
                  inputMode="url"
                  required
                  value={voteBlocklistInput}
                  onChange={(event) => setVoteBlocklistInput(event.target.value)}
                  placeholder="https://www.exemple.fr/"
                  className={`mt-1 ${moderationValidatedFieldClass}`}
                />
              </div>
              <button
                type="submit"
                disabled={runningBlocklistVoteUrl === voteBlocklistInput.trim()}
                className={`min-h-11 rounded-xl px-4 py-2 text-sm font-semibold ${ctaDisabledClass} ${moderationCtaWarningClass} ${focusRingClass}`}
              >
                Bloquer les votes
              </button>
            </form>

            <ul className="mt-4 grid gap-2">
              {voteBlocklist.length === 0 ? (
                <li className={`rounded-xl p-3 text-sm ${moderationSurfaceStrongClass} ${moderationTextMutedClass}`}>
                  Aucun blocage de vote actif.
                </li>
              ) : (
                visibleVoteBlocklist.map((blockedUrl) => {
                  const isRunning = runningBlocklistVoteUrl === blockedUrl
                  return (
                    <li key={blockedUrl} className={`flex flex-wrap items-center justify-between gap-2 rounded-xl p-3 ${moderationSurfaceStrongClass}`}>
                      <span className="wrap-anywhere text-sm text-slate-800 dark:text-slate-50">{blockedUrl}</span>
                      <button
                        type="button"
                        onClick={() => {
                          void handleSetVotesBlocked(blockedUrl, false)
                        }}
                        aria-label={`Réactiver les votes pour ${blockedUrl}`}
                        disabled={isRunning}
                        className={`min-h-11 rounded-xl px-4 py-2 text-sm font-semibold ${ctaDisabledClass} ${moderationCtaOutlineWarningClass} ${focusRingClass}`}
                      >
                        {isRunning ? 'Traitement...' : 'Réactiver les votes'}
                      </button>
                    </li>
                  )
                })
              )}
            </ul>
            {voteBlocklist.length > 0 && hasMoreVoteBlocklistEntries && (
              <div className="mt-4 flex flex-col items-start gap-3">
                <button
                  type="button"
                  onClick={() => handleLoadMoreVoteBlocklistEntries('button')}
                  className={`inline-flex min-h-11 items-center rounded-xl px-4 py-2 text-sm font-semibold ${ctaDisabledClass} ${moderationCtaOutlineWarningClass} ${focusRingClass}`}
                >
                  {formatLoadMoreLabel(
                    visibleVoteBlocklist.length,
                    voteBlocklist.length,
                    MODERATION_BATCH_SIZE,
                    'blocage(s)',
                  )}
                </button>
              </div>
            )}
            {voteBlocklist.length > 0 && (
              <div ref={voteBlocklistSentinelRef} className="h-1 w-full" aria-hidden="true" />
            )}
              </section>
              </div>

              <div className="mt-8 grid gap-8 xl:grid-cols-2 xl:items-start">
                <section
                  id="archive-donnees"
                  ref={archiveRef}
                  tabIndex={-1}
                  className={`rounded-2xl p-6 ${moderationSurfaceClass} ${focusTargetScrollMarginClass} ${focusTargetClass}`}
                  aria-labelledby="archive-donnees-titre"
                >
                  <h2 id="archive-donnees-titre" className="text-lg font-semibold">
                    Archivage et restauration
                  </h2>
                  <p className={`mt-2 ${moderationTextMutedClass}`}>
                    Exportez une archive complète lisible de la base, puis réimportez-la en fusion ou en remplacement.
                  </p>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        void handleExportArchive()
                      }}
                      disabled={!hasToken || isExportingArchive || isImportingArchive}
                      className={`min-h-11 rounded-xl px-4 py-2 text-sm font-semibold ${ctaDisabledClass} ${moderationCtaPrimaryClass} ${focusRingClass}`}
                    >
                      {isExportingArchive ? 'Export en cours...' : 'Télécharger l’archive JSON'}
                    </button>
                  </div>

                  <form className={`mt-4 grid gap-4 rounded-xl p-4 ${moderationSurfaceStrongClass}`} onSubmit={handleImportArchive}>
                    <div>
                      <label htmlFor="archive-import-file" className="block text-sm font-medium">
                        Fichier d’archive JSON
                      </label>
                      <input
                        ref={archiveImportInputRef}
                        id="archive-import-file"
                        type="file"
                        accept=".json,application/json"
                        required
                        onChange={handleArchiveFileChange}
                        aria-describedby="archive-import-help archive-import-selected"
                        className={moderationFileFieldClass}
                      />
                      <p id="archive-import-help" className={`mt-1 text-sm ${moderationTextMutedClass}`}>
                        Format attendu: export natif Annuaire RGAA.
                      </p>
                      <p id="archive-import-selected" className={`mt-1 text-sm ${moderationTextMutedClass}`}>
                        {archiveImportFileName ? `Fichier sélectionné: ${archiveImportFileName}` : 'Aucun fichier sélectionné.'}
                      </p>
                    </div>

                    <fieldset className={`rounded-xl p-3 ${moderationSurfaceStrongClass}`}>
                      <legend className="px-1 text-sm font-semibold">Mode d’import</legend>
                      <div className="mt-2 flex flex-wrap gap-3">
                        <label className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-3 py-2 text-sm ${moderationCtaNeutralClass} ${focusRingClass}`}>
                          <input
                            type="radio"
                            name="archive-import-mode"
                            value="merge"
                            checked={archiveImportMode === 'merge'}
                            onChange={() => {
                              setArchiveImportMode('merge')
                              setAllowArchiveRollbackImport(false)
                            }}
                          />
                          Fusionner
                        </label>
                        <label className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-3 py-2 text-sm ${moderationCtaNeutralClass} ${focusRingClass}`}>
                          <input
                            type="radio"
                            name="archive-import-mode"
                            value="replace"
                            checked={archiveImportMode === 'replace'}
                            onChange={() => setArchiveImportMode('replace')}
                          />
                          Remplacer toute la base
                        </label>
                      </div>

                      {archiveImportMode === 'replace' && (
                        <label className={`mt-3 inline-flex min-h-11 items-start gap-2 rounded-xl px-3 py-2 text-sm ${moderationWarningPanelClass} ${focusRingClass}`}>
                          <input
                            type="checkbox"
                            checked={allowArchiveRollbackImport}
                            onChange={(event) => setAllowArchiveRollbackImport(event.target.checked)}
                          />
                          <span>
                            Autoriser un rollback (import d’une archive potentiellement plus ancienne que la base actuelle).
                          </span>
                        </label>
                      )}
                    </fieldset>

                    <p className={`rounded-lg p-3 text-sm ${moderationWarningPanelClass}`}>
                      Le mode <strong>Remplacer</strong> écrase les données existantes avant import.
                    </p>

                    <button
                      type="submit"
                      disabled={!hasToken || !archiveImportFile || isImportingArchive || isExportingArchive}
                      className={`min-h-11 rounded-xl px-4 py-2 text-sm font-semibold ${ctaDisabledClass} ${moderationCtaPrimaryClass} ${focusRingClass}`}
                    >
                      {isImportingArchive ? 'Import en cours...' : 'Importer l’archive'}
                    </button>
                  </form>
                </section>

                <section
                  id="mode-maintenance"
                  ref={maintenanceSectionRef}
                  tabIndex={-1}
                  className={`${moderationMaintenanceSectionClass} ${focusTargetScrollMarginClass} ${focusTargetClass}`}
                  aria-labelledby="mode-maintenance-titre"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-rose-950 dark:text-rose-100">
                        Contrôle d’interruption publique
                      </p>
                      <h2 id="mode-maintenance-titre" className="mt-1 text-lg font-semibold text-slate-950 dark:text-slate-50">
                        Mode maintenance
                      </h2>
                      <p className={`mt-2 ${moderationTextStrongClass}`}>
                        Utilisez ce mode en dernier recours. L’activation coupe immédiatement l’accès public et force les endpoints JSON/XML publics en `503`, tandis que la modération reste disponible.
                      </p>
                    </div>
                    <span
                      className={`inline-flex min-h-11 items-center rounded-full border-2 px-4 py-2 text-sm font-extrabold ${
                        maintenanceState.enabled
                          ? moderationDangerBadgeClass
                          : moderationSuccessBadgeClass
                      }`}
                    >
                      {maintenanceState.enabled ? 'Maintenance active' : 'Site public ouvert'}
                    </span>
                  </div>

                  <div className={`mt-4 rounded-2xl p-4 ${moderationDangerPanelClass}`}>
                    <p className="text-sm font-extrabold">
                      Impact immédiat côté public
                    </p>
                    <ul className="mt-2 list-disc space-y-1 ps-5 text-sm">
                      <li>La vitrine publique affiche une page d’interruption temporaire.</li>
                      <li>Les endpoints publics d’API et de sitemap répondent en indisponibilité temporaire.</li>
                      <li>La modération reste accessible avec votre jeton.</li>
                    </ul>
                  </div>

                  <div className={`mt-4 rounded-xl p-4 ${moderationSurfaceStrongClass}`}>
                    <p className="text-sm font-semibold text-slate-950 dark:text-slate-50">
                      Message public actuellement diffusé
                    </p>
                    <p className="mt-2 text-sm text-slate-900 dark:text-slate-100">
                      {maintenanceState.effectiveMessage}
                    </p>
                    <p className={`mt-2 text-sm ${moderationTextMutedClass}`}>
                      {maintenanceState.updatedAt
                        ? `Dernière mise à jour: ${formatDate(maintenanceState.updatedAt)}.`
                        : 'Aucune activation enregistrée pour le moment.'}
                    </p>
                  </div>

                  <div className="mt-4">
                    <label htmlFor="maintenance-message" className="block text-sm font-medium text-slate-950 dark:text-slate-50">
                      Message public personnalisé
                    </label>
                    <textarea
                      id="maintenance-message"
                      rows={4}
                      maxLength={280}
                      value={maintenanceMessageInput}
                      onChange={(event) => setMaintenanceMessageInput(event.target.value)}
                      aria-describedby="maintenance-message-help maintenance-message-count maintenance-danger-help"
                      className={`mt-1 min-h-11 ${moderationValidatedFieldStrongClass}`}
                    />
                    <p id="maintenance-message-help" className={`mt-1 text-sm ${moderationTextMutedClass}`}>
                      Laissez vide pour utiliser le message standard: “{DEFAULT_MAINTENANCE_MESSAGE}”.
                    </p>
                    <p id="maintenance-message-count" className={`mt-1 text-sm ${moderationTextMutedClass}`}>
                      {maintenanceMessageInput.trim().length}/280 caractère(s).
                    </p>
                    <p id="maintenance-danger-help" className="mt-1 text-sm font-semibold text-rose-900 dark:text-rose-100">
                      Vérifiez le message avant activation: il sera diffusé immédiatement au public.
                    </p>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        void handleSetMaintenanceMode(true)
                      }}
                      disabled={!hasToken || isSavingMaintenance || isLoadingMaintenance}
                      className={`min-h-11 rounded-xl px-4 py-2 text-sm font-extrabold ${ctaDisabledClass} ${moderationCtaDangerClass} ${focusRingClass}`}
                    >
                      {isSavingMaintenance
                        ? 'Traitement...'
                        : maintenanceState.enabled
                          ? 'Mettre à jour la maintenance'
                          : 'Déclencher la maintenance publique'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void handleSetMaintenanceMode(false)
                      }}
                      disabled={!hasToken || !maintenanceState.enabled || isSavingMaintenance || isLoadingMaintenance}
                      className={`min-h-11 rounded-xl px-4 py-2 text-sm font-semibold ${ctaDisabledClass} ${moderationCtaNeutralClass} ${focusRingClass}`}
                    >
                      {isSavingMaintenance && maintenanceState.enabled ? 'Traitement...' : 'Rétablir l’accès public'}
                    </button>
                  </div>
                </section>
              </div>
            </>
          )}
        </main>

        <SiteFooter id="pied-page" footerRef={footerRef} />
      </div>
    </>
  )
}

export default ModerationPage
