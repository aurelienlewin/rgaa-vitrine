import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent, MouseEvent as ReactMouseEvent, RefObject } from 'react'
import ThemeToggle from './ThemeToggle'
import { applySeo, createAbsoluteUrl } from './seo'
import { resolveShowcaseProfilePath } from './siteProfiles'
import SiteFooter from './SiteFooter'
import GlobalSearchForm from './GlobalSearchForm'
import PrimaryNavigation from './PrimaryNavigation'
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
  slug?: string
  profilePath?: string
  siteTitle: string
  thumbnailUrl: string | null
  accessibilityPageUrl: string | null
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

type SubmissionStatus = 'approved' | 'duplicate' | 'pending'
type SubmissionFeedbackKind = 'duplicate' | 'already-pending'
type SubmissionFeedback = {
  id: number
  entry: ShowcaseEntry
  message: string
  kind: SubmissionFeedbackKind
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
  }
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
  const [submitErrorMessage, setSubmitErrorMessage] = useState<string | null>(null)
  const [submitInfoMessage, setSubmitInfoMessage] = useState<string | null>(null)
  const [submissionFeedback, setSubmissionFeedback] = useState<SubmissionFeedback | null>(null)
  const [isSubmitConfirmationStep, setIsSubmitConfirmationStep] = useState(false)
  const [submissionPreviewEntry, setSubmissionPreviewEntry] = useState<ShowcaseEntry | null>(null)
  const [submissionPreviewStatus, setSubmissionPreviewStatus] = useState<SubmissionStatus | null>(null)
  const [lastAddedEntry, setLastAddedEntry] = useState<ShowcaseEntry | null>(null)
  const [showcaseEntries, setShowcaseEntries] = useState<ShowcaseEntry[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<ShowcaseStatusFilter>('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
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

    let voterId = ''
    try {
      const stored = window.localStorage.getItem(CLIENT_VOTER_ID_STORAGE_KEY)
      if (stored && /^[a-zA-Z0-9_-]{16,120}$/.test(stored)) {
        voterId = stored
      } else {
        voterId = createClientVoterId()
        window.localStorage.setItem(CLIENT_VOTER_ID_STORAGE_KEY, voterId)
      }
    } catch {
      voterId = createClientVoterId()
    }

    clientVoterIdRef.current = voterId
    return voterId
  }, [])

  const focusElement = useCallback((element: HTMLElement | null) => {
    if (!element) {
      return
    }
    element.focus({ preventScroll: true })
    element.scrollIntoView({ block: 'start' })
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

  const syncFiltersInUrl = useCallback((filters: { query: string; status: ShowcaseStatusFilter; category: string }) => {
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
    syncFiltersInUrl({ query: '', status: 'all', category: 'all' })
    announcePolite('Filtres réinitialisés.')
    searchInputRef.current?.focus()
  }, [announcePolite, syncFiltersInUrl])

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

  const visibleShowcaseEntries = useMemo(
    () => filteredShowcaseEntries.slice(0, visibleTilesCount),
    [filteredShowcaseEntries, visibleTilesCount],
  )

  const hasMoreTiles = visibleTilesCount < filteredShowcaseEntries.length

  const handleSearchSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      syncFiltersInUrl({ query: searchQuery, status: statusFilter, category: categoryFilter })
      announcePolite(
        `Recherche appliquée. ${Math.min(
          filteredShowcaseEntries.length,
          TILE_BATCH_SIZE,
        )} carte(s) affichée(s) sur ${filteredShowcaseEntries.length} résultat(s).`,
      )
      focusElement(resultsSummaryRef.current)
    },
    [
      announcePolite,
      categoryFilter,
      filteredShowcaseEntries.length,
      focusElement,
      searchQuery,
      statusFilter,
      syncFiltersInUrl,
    ],
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
      url: createAbsoluteUrl(resolveShowcaseProfilePath(entry.normalizedUrl, entry.slug)),
    }))

    return {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebSite',
          '@id': createAbsoluteUrl('/#website'),
          url: createAbsoluteUrl('/'),
          name: 'Annuaire RGAA',
          inLanguage: 'fr-FR',
          description:
            'Annuaire français pour valoriser les sites engagés dans la conformité RGAA et l’accessibilité numérique.',
          potentialAction: {
            '@type': 'SearchAction',
            target: `${createAbsoluteUrl('/')}?recherche={search_term_string}`,
            'query-input': 'required name=search_term_string',
          },
        },
        {
          '@type': 'Organization',
          '@id': createAbsoluteUrl('/#organization'),
          name: 'Annuaire RGAA',
          url: createAbsoluteUrl('/'),
          logo: createAbsoluteUrl('/logo-rgaa-vitrine.svg'),
          sameAs: [githubProfile.profileUrl],
        },
        {
          '@type': 'Person',
          '@id': createAbsoluteUrl('/#creator'),
          name: githubProfile.name,
          url: githubProfile.profileUrl,
        },
        {
          '@type': 'CollectionPage',
          '@id': createAbsoluteUrl('/#collection'),
          url: createAbsoluteUrl('/'),
          name: 'Annuaire RGAA',
          inLanguage: 'fr-FR',
          isPartOf: {
            '@id': createAbsoluteUrl('/#website'),
          },
          mainEntity: {
            '@type': 'ItemList',
            numberOfItems: showcaseEntries.length,
            itemListOrder: 'https://schema.org/ItemListOrderDescending',
            itemListElement: itemListElements,
          },
        },
        {
          '@type': 'Dataset',
          '@id': createAbsoluteUrl('/#dataset-showcase'),
          name: 'Vitrine RGAA - données publiques',
          description:
            'Jeu de données public des sites référencés dans l’annuaire RGAA, incluant catégorie et indicateurs de conformité.',
          inLanguage: 'fr-FR',
          isAccessibleForFree: true,
          license: 'https://opensource.org/license/mit/',
          url: createAbsoluteUrl('/api/showcase'),
          dateModified: latestUpdatedAt,
          creator: {
            '@id': createAbsoluteUrl('/#organization'),
          },
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
    shouldFocusResultsAfterQueryInitRef.current =
      Boolean(initialQuery?.trim()) || initialStatus !== 'all' || initialCategory !== 'all'

    if (initialQuery) {
      setSearchQuery(initialQuery.slice(0, 120))
    }

    setStatusFilter(initialStatus)
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
      announcePolite('Filtres de recherche appliqués depuis l’URL.')
    }, 0)
  }, [announcePolite, directoryErrorMessage, focusElement, loadingDirectory])

  useEffect(() => {
    setVisibleTilesCount(Math.min(TILE_BATCH_SIZE, filteredShowcaseEntries.length))
  }, [filteredShowcaseEntries.length, searchQuery, statusFilter, categoryFilter])

  const handleLoadMoreTiles = useCallback(
    (source: 'button' | 'auto') => {
      if (!hasMoreTiles) {
        return
      }

      setVisibleTilesCount((current) => {
        const next = Math.min(current + TILE_BATCH_SIZE, filteredShowcaseEntries.length)
        if (next > current && source === 'button') {
          announcePolite(`${next} carte(s) affichée(s) sur ${filteredShowcaseEntries.length} résultat(s).`)
          if (next >= filteredShowcaseEntries.length) {
            window.setTimeout(() => {
              focusElement(resultsSummaryRef.current)
            }, 0)
          }
        }
        return next
      })
    },
    [announcePolite, filteredShowcaseEntries.length, focusElement, hasMoreTiles],
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
      message: `${visibleShowcaseEntries.length} carte(s) affichée(s) sur ${filteredShowcaseEntries.length} résultat(s).`,
    }))
  }, [visibleShowcaseEntries.length, filteredShowcaseEntries.length])

  const loadShowcaseEntries = useCallback(async () => {
    setDirectoryErrorMessage(null)
    setLoadingDirectory(true)
    announcePolite('Chargement de l’annuaire en cours.')

    try {
      const voterId = getClientVoterId()
      const response = await fetch(`/api/showcase?clientVoterId=${encodeURIComponent(voterId)}`)
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
      announcePolite(`${parsedEntries.length} site(s) chargé(s) dans l’annuaire.`)
    } catch (error) {
      console.error('Unable to load showcase entries', error)
      const localizedMessage = error instanceof Error ? error.message : 'Erreur de chargement de l’annuaire.'
      setDirectoryErrorMessage(localizedMessage)
      announceAssertive(localizedMessage)
    } finally {
      setLoadingDirectory(false)
    }
  }, [announceAssertive, announcePolite, getClientVoterId])

  useEffect(() => {
    let timeoutId: number | null = null
    let idleId: number | null = null
    let cancelled = false
    const loadDirectory = () => {
      if (cancelled) {
        return
      }
      void loadShowcaseEntries()
    }

    if (typeof window.requestIdleCallback === 'function') {
      idleId = window.requestIdleCallback(loadDirectory, { timeout: 2200 })
    } else {
      timeoutId = window.setTimeout(loadDirectory, 650)
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
  }, [loadShowcaseEntries])

  useEffect(() => {
    if (directoryErrorMessage) {
      focusElement(directoryErrorRef.current)
    }
  }, [directoryErrorMessage, focusElement])

  useEffect(() => {
    if (submitErrorMessage) {
      focusElement(submitErrorRef.current)
    }
  }, [submitErrorMessage, focusElement])

  useEffect(() => {
    if (submissionFeedback && !submitErrorMessage) {
      focusElement(duplicateFeedbackRef.current)
    }
  }, [submissionFeedback, focusElement, submitErrorMessage])

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

  const handleSubmissionFeedback = useCallback(
    (kind: SubmissionFeedbackKind, entry: ShowcaseEntry, message: string) => {
      setIsSubmitConfirmationStep(false)
      setSubmissionPreviewEntry(null)
      setSubmissionPreviewStatus(null)
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

      if (entry.hasUpvoted) {
        announcePolite(`Vote déjà pris en compte pour ${entry.siteTitle}.`)
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
                  hasUpvoted: true,
                }
              : candidate,
          ),
        )

        const responseMessage = typeof apiPayload.message === 'string' ? apiPayload.message : 'Vote enregistré.'
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

    setSubmitErrorMessage(null)
    setSubmitInfoMessage(null)
    setLastAddedEntry(null)
    setSubmissionFeedback(null)
    const categoryForSubmission = normalizePublicSubmissionCategory(inputCategory)

    if (!inputUrl.trim()) {
      const message =
        'Veuillez saisir une URL complète, par exemple https://www.exemple.fr, avant de continuer.'
      setSubmitErrorMessage(message)
      announceAssertive(message)
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
        handleSubmissionFeedback('already-pending', normalizeShowcaseEntry(payload), alreadyPendingMessage)
        return
      }

      if (!submissionStatus || !isShowcaseEntry(payload)) {
        throw new Error('Pré-analyse invalide du serveur.')
      }

      setSubmissionPreviewEntry(normalizeShowcaseEntry(payload))
      setSubmissionPreviewStatus(submissionStatus)
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
      const localizedMessage = error instanceof Error ? error.message : 'Erreur réseau.'
      setSubmitErrorMessage(localizedMessage)
      announceAssertive(localizedMessage)
    } finally {
      setIsPreAnalyzing(false)
    }
  }

  const handleConfirmSubmission = useCallback(async () => {
    if (!isSubmitConfirmationStep || !submissionPreviewEntry) {
      const message = 'Veuillez lancer la pré-analyse avant de confirmer.'
      setSubmitErrorMessage(message)
      setSubmitInfoMessage(null)
      announceAssertive(message)
      focusElement(urlInputRef.current)
      return
    }

    setSubmitErrorMessage(null)
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
        body: JSON.stringify({ url: inputUrl, category: categoryForSubmission, website: websiteField }),
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
        handleSubmissionFeedback('duplicate', normalizeShowcaseEntry(payload), duplicateMessage)
        return
      }

      if (!isShowcaseEntry(payload)) {
        throw new Error('Réponse serveur invalide.')
      }

      setIsSubmitConfirmationStep(false)
      setSubmissionPreviewEntry(null)
      setSubmissionPreviewStatus(null)
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
      setSubmitErrorMessage(localizedMessage)
      announceAssertive(localizedMessage)
    } finally {
      setIsConfirmingSubmission(false)
    }
  }, [
    announceAssertive,
    announcePolite,
    focusElement,
    handleSubmissionFeedback,
    inputCategory,
    inputUrl,
    isSubmitConfirmationStep,
    loadShowcaseEntries,
    submissionPreviewEntry,
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
        <a href="#ajout-site" className={skipLinkClass} onClick={(event) => handleSkipLinkClick(event, formSectionRef)}>
          Aller au formulaire d’ajout
        </a>
        <a href="#aide-accessibilite" className={skipLinkClass} onClick={(event) => handleSkipLinkClick(event, helpSectionRef)}>
          Aller à l’aide accessibilité
        </a>
        <a href="#pied-page" className={skipLinkClass} onClick={(event) => handleSkipLinkClick(event, footerRef)}>
          Aller au pied de page
        </a>
      </div>

      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true" lang="fr">
        {politeAnnouncement.message}
        <span aria-hidden="true">{politeAnnouncement.id}</span>
      </div>
      <div className="sr-only" role="alert" aria-live="assertive" aria-atomic="true" lang="fr">
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

        <main id="contenu" ref={mainContentRef} tabIndex={-1} className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
          <section aria-labelledby="annuaire-titre" className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm">
            <h2 id="annuaire-titre" className="text-xl font-semibold">
              Annuaire
            </h2>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl bg-slate-100 dark:bg-slate-800 px-4 py-3">
                <dt className="text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">Sites référencés</dt>
                <dd className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-50">{directoryStats.total}</dd>
              </div>
              <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950 px-4 py-3">
                <dt className="text-sm font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-100">Totalement conformes</dt>
                <dd className="mt-1 text-2xl font-bold text-emerald-900 dark:text-emerald-100">{directoryStats.full}</dd>
              </div>
              <div className="rounded-xl bg-amber-50 dark:bg-amber-950 px-4 py-3">
                <dt className="text-sm font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-100">Partiellement conformes</dt>
                <dd className="mt-1 text-2xl font-bold text-amber-900 dark:text-amber-100">{directoryStats.partial}</dd>
              </div>
              <div className="rounded-xl bg-rose-50 dark:bg-rose-950 px-4 py-3">
                <dt className="text-sm font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-100">Non conformes</dt>
                <dd className="mt-1 text-2xl font-bold text-rose-900 dark:text-rose-100">{directoryStats.none}</dd>
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
            className="mt-8"
            aria-labelledby="galerie-titre"
            aria-busy={loadingDirectory}
          >
            <div className="flex flex-col gap-2">
              <h2 id="galerie-titre" className="text-xl font-semibold">
                Résultats annuaire
              </h2>
              <p className="text-slate-700 dark:text-slate-300">
                La recherche et les filtres sont disponibles dans l’en-tête de page, puis les résultats sont listés ici.
              </p>
            </div>

            <p ref={resultsSummaryRef} tabIndex={-1} className="mt-3 text-sm text-slate-700 dark:text-slate-300">
              {visibleShowcaseEntries.length} carte(s) affichée(s) sur {filteredShowcaseEntries.length} résultat(s) ({showcaseEntries.length}{' '}
              site(s) total dans l’annuaire).
            </p>

            {loadingDirectory && <p className="mt-3 text-slate-700 dark:text-slate-300">Chargement de l’annuaire...</p>}

            {!loadingDirectory && showcaseEntries.length === 0 && (
              <p className="mt-3 text-slate-700 dark:text-slate-300">Aucun site référencé pour le moment.</p>
            )}

            {!loadingDirectory && showcaseEntries.length > 0 && filteredShowcaseEntries.length === 0 && (
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

            {filteredShowcaseEntries.length > 0 && (
              <ul id="liste-vitrines" className="mt-4 grid gap-5 md:grid-cols-2">
                {visibleShowcaseEntries.map((entry) => {
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
                        <div className="h-44 overflow-hidden border-b border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800">
                          {entry.thumbnailUrl ? (
                            <img
                              src={entry.thumbnailUrl}
                              alt=""
                              aria-hidden="true"
                              className="h-full w-full object-cover"
                              loading="lazy"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center px-3 text-center text-sm text-slate-700 dark:text-slate-200">
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
                                      ? 'Vote déjà enregistré pour'
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
                                <span>{entry.votesBlocked ? 'Votes indisponibles' : entry.hasUpvoted ? 'Voté' : 'Soutenir ce site'}</span>
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

            {filteredShowcaseEntries.length > 0 && hasMoreTiles && (
              <div className="mt-4 flex flex-col items-start gap-3">
                <button
                  ref={loadMoreButtonRef}
                  type="button"
                  onClick={() => handleLoadMoreTiles('button')}
                  className={`inline-flex min-h-11 items-center rounded-xl px-4 py-2 text-sm font-semibold ${ctaNeutralClass} ${focusRingClass}`}
                >
                  Charger {Math.min(TILE_BATCH_SIZE, filteredShowcaseEntries.length - visibleShowcaseEntries.length)} carte(s) de plus
                </button>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Chargement progressif actif pour alléger le rendu initial.
                </p>
              </div>
            )}

            {filteredShowcaseEntries.length > 0 && (
              <div ref={tilesSentinelRef} className="h-1 w-full" aria-hidden="true" />
            )}
          </section>

          <section
            id="aide-accessibilite"
            ref={helpSectionRef}
            tabIndex={-1}
            className="mt-8 rounded-2xl border border-sky-200 dark:border-sky-700 bg-sky-50 dark:bg-sky-950 p-6"
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
            className="mt-8 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm"
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
                  aria-invalid={Boolean(submitErrorMessage)}
                  aria-describedby={submitErrorMessage ? 'url-help url-format-help url-error' : 'url-help url-format-help'}
                  value={inputUrl}
                  onChange={(event) => {
                    setInputUrl(event.target.value)
                    setSubmissionFeedback(null)
                    setIsSubmitConfirmationStep(false)
                    setSubmissionPreviewEntry(null)
                    setSubmissionPreviewStatus(null)
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
                    setSubmissionFeedback(null)
                    setIsSubmitConfirmationStep(false)
                    setSubmissionPreviewEntry(null)
                    setSubmissionPreviewStatus(null)
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

            {submissionFeedback && !submitErrorMessage && (
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

            {submitErrorMessage && (
              <p
                id="url-error"
                ref={submitErrorRef}
                tabIndex={-1}
                className="mt-4 rounded-lg border border-rose-300 dark:border-rose-700 bg-rose-50 dark:bg-rose-950 p-3 text-sm text-rose-800 dark:text-rose-100"
                role="alert"
              >
                {submitErrorMessage}
              </p>
            )}

            {submitInfoMessage && !submitErrorMessage && (
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

            {lastAddedEntry && !submitErrorMessage && (
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

          <section className="mt-8" aria-labelledby="sources-titre">
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
