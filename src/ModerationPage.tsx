import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { applySeo } from './seo'
import SecondaryPageHeader from './SecondaryPageHeader'
import SiteFooter from './SiteFooter'

type ComplianceStatus = 'full' | 'partial' | 'none' | null
type RgaaBaseline = '4.1' | '5.0-ready'

type PendingSubmission = {
  submissionId: string
  normalizedUrl: string
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
}

type ShowcaseEntry = {
  normalizedUrl: string
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
const skipLinksContainerClass =
  'fixed start-2 top-2 z-60 flex max-w-[calc(100vw-1rem)] -translate-y-[120%] flex-col items-start gap-2 transition-transform duration-150 motion-reduce:transition-none focus-within:translate-y-0 sm:start-4 sm:top-4 sm:max-w-none'
const skipLinkClass = `inline-flex min-h-11 items-center rounded-lg border border-slate-900 bg-slate-950 px-3 py-2 text-slate-50 underline decoration-2 underline-offset-2 shadow-lg dark:border-slate-50 dark:bg-slate-50 dark:text-slate-950 ${focusRingClass}`
const MODERATION_SESSION_STORAGE_KEY = 'annuaire-rgaa-moderation-session'
const MODERATION_SESSION_TTL_MS = 12 * 60 * 60 * 1000

type StoredModerationSession = {
  token: string
  expiresAt: number
  source: 'session' | 'local'
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(new Date(value))
}

function toNullableString(value: unknown) {
  return typeof value === 'string' ? value : null
}

function toNullableNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
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
  const [archiveImportMode, setArchiveImportMode] = useState<ArchiveImportMode>('merge')
  const [allowArchiveRollbackImport, setAllowArchiveRollbackImport] = useState(false)
  const [archiveImportFile, setArchiveImportFile] = useState<File | null>(null)
  const [archiveImportFileName, setArchiveImportFileName] = useState('')
  const mainRef = useRef<HTMLElement | null>(null)
  const pendingRef = useRef<HTMLElement | null>(null)
  const publishedRef = useRef<HTMLElement | null>(null)
  const archiveRef = useRef<HTMLElement | null>(null)
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

  const focusElement = useCallback((element: HTMLElement | null) => {
    if (!element) {
      return
    }
    element.focus({ preventScroll: true })
    element.scrollIntoView({ block: 'start' })
  }, [])

  const focusMain = useCallback(() => {
    focusElement(mainRef.current)
  }, [focusElement])

  const focusPending = useCallback(() => {
    focusElement(pendingRef.current)
  }, [focusElement])

  const focusPublished = useCallback(() => {
    focusElement(publishedRef.current)
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

  const focusTokenInput = useCallback(() => {
    focusElement(tokenInputRef.current)
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

      const entries = Array.isArray(payload.entries) ? payload.entries.filter(isPendingSubmission) : []
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

      const entries = Array.isArray(payload.entries) ? payload.entries.filter(isShowcaseEntry) : []
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
      const unlocked = pendingLoaded || publishedLoaded || blocklistsLoaded

      if (unlocked) {
        persistStoredModerationSession(moderationToken, rememberModerationSession)
        setHasStoredModerationSession(true)
        setIsModerationUnlocked(true)
        setAssertiveMessage('')
        setPoliteMessage('Accès modération activé.')
        window.setTimeout(() => {
          focusPending()
        }, 0)
        return
      }

      lockModerationView()
    },
    [
      focusPending,
      loadBlocklists,
      loadPendingEntries,
      loadPublishedEntries,
      lockModerationView,
      moderationToken,
      rememberModerationSession,
    ],
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

        await Promise.all([loadPendingEntries(), loadPublishedEntries(), loadBlocklists()])

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
        <a href="#navigation-principale" className={skipLinkClass}>
          Aller à la navigation principale
        </a>
        <a href="/#moteur-recherche-global" className={skipLinkClass}>
          Aller à la recherche annuaire
        </a>
        {isModerationUnlocked && (
          <>
            <a href="#annuaire-publie" className={skipLinkClass} onClick={focusPublished}>
              Aller à l’annuaire publié
            </a>
            <a href="#archive-donnees" className={skipLinkClass} onClick={focusArchive}>
              Aller à l’archivage
            </a>
            <a href="#blocklist-sites" className={skipLinkClass} onClick={focusSiteBlocklist}>
              Aller à la blocklist sites
            </a>
            <a href="#blocklist-votes" className={skipLinkClass} onClick={focusVoteBlocklist}>
              Aller à la blocklist votes
            </a>
          </>
        )}
        <a href="#pied-page" className={skipLinkClass} onClick={focusFooter}>
          Aller au pied de page
        </a>
      </div>

      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true" lang="fr">
        {politeMessage}
      </div>
      <div className="sr-only" role="alert" aria-live="assertive" aria-atomic="true" lang="fr">
        {assertiveMessage}
      </div>

      <div className="min-h-screen bg-brand-surface text-brand-ink">
        <SecondaryPageHeader
          title="Modération Annuaire RGAA"
          description="Validez ou rejetez les soumissions en attente sans passer par `curl`."
          currentPath="/moderation"
        />

        <main
          id="contenu-moderation"
          ref={mainRef}
          tabIndex={-1}
          className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8"
        >
          <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm">
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
                  className={`mt-1 min-h-11 w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-base text-slate-900 dark:text-slate-50 ${focusRingClass}`}
                />
                <label className={`mt-3 inline-flex min-h-11 items-center gap-2 text-sm ${focusRingClass}`}>
                  <input
                    type="checkbox"
                    checked={rememberModerationSession}
                    onChange={(event) => setRememberModerationSession(event.target.checked)}
                  />
                  Mémoriser sur cet appareil pendant 12 heures
                </label>
                <p id="token-session-help" className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                  La session est conservée dans cet onglet. Avec l’option “Mémoriser sur cet appareil”, elle est aussi conservée pendant 12 heures.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowToken((current) => !current)}
                className={`min-h-11 rounded-xl border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm font-semibold ${focusRingClass} md:self-end`}
              >
                {showToken ? 'Masquer' : 'Afficher'}
              </button>
              <button
                type="submit"
                disabled={isLoadingList || isLoadingPublished}
                className={`min-h-11 rounded-xl bg-slate-900 dark:bg-slate-100 px-4 py-2 text-sm font-semibold text-white dark:text-slate-950 disabled:border-slate-600 disabled:bg-slate-600 disabled:text-slate-100 disabled:opacity-100 ${focusRingClass} md:self-end`}
              >
                {isLoadingList || isLoadingPublished ? 'Chargement...' : 'Charger la modération'}
              </button>
            </form>

            {(isModerationUnlocked || hasStoredModerationSession) && (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={handleSignOut}
                  className={`min-h-11 rounded-xl border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm font-semibold ${focusRingClass}`}
                >
                  Se déconnecter et oublier la session
                </button>
              </div>
            )}

            {(politeMessage || assertiveMessage) && (
              <p
                ref={messageRef}
                tabIndex={-1}
                className={`mt-4 rounded-lg border p-3 text-sm ${
                  assertiveMessage
                    ? 'border-rose-300 dark:border-rose-700 bg-rose-50 dark:bg-rose-950 text-rose-800 dark:text-rose-100'
                    : 'border-sky-300 dark:border-sky-600 bg-sky-50 dark:bg-sky-950 text-sky-900 dark:text-sky-100'
                }`}
                role={assertiveMessage ? 'alert' : 'status'}
                aria-live={assertiveMessage ? 'assertive' : 'polite'}
              >
                {assertiveMessage || politeMessage}
              </p>
            )}
          </section>

          {!isModerationUnlocked && (
            <section className="mt-8 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm">
              <h2 className="text-lg font-semibold">Accès protégé</h2>
              <p className="mt-2 text-slate-700 dark:text-slate-300">
                Les tableaux de bord et contrôles de modération restent masqués tant qu’un jeton valide n’a pas été confirmé.
              </p>
            </section>
          )}

          {isModerationUnlocked && (
            <>
              <section
                id="archive-donnees"
                ref={archiveRef}
                tabIndex={-1}
                className="mt-8 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm"
                aria-labelledby="archive-donnees-titre"
              >
                <h2 id="archive-donnees-titre" className="text-lg font-semibold">
                  Archivage et restauration
                </h2>
                <p className="mt-2 text-slate-700 dark:text-slate-300">
                  Exportez une archive complète lisible de la base, puis réimportez-la en fusion ou en remplacement.
                </p>

                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      void handleExportArchive()
                    }}
                    disabled={!hasToken || isExportingArchive || isImportingArchive}
                    className={`min-h-11 rounded-xl bg-slate-900 dark:bg-slate-100 px-4 py-2 text-sm font-semibold text-white dark:text-slate-950 disabled:border-slate-600 disabled:bg-slate-600 disabled:text-slate-100 disabled:opacity-100 ${focusRingClass}`}
                  >
                    {isExportingArchive ? 'Export en cours...' : 'Télécharger l’archive JSON'}
                  </button>
                </div>

                <form className="mt-4 grid gap-4 rounded-xl border border-slate-200 dark:border-slate-700 p-4" onSubmit={handleImportArchive}>
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
                      className={`mt-1 min-h-11 w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm text-slate-900 dark:text-slate-50 ${focusRingClass}`}
                    />
                    <p id="archive-import-help" className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                      Format attendu: export natif Annuaire RGAA.
                    </p>
                    <p id="archive-import-selected" className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                      {archiveImportFileName ? `Fichier sélectionné: ${archiveImportFileName}` : 'Aucun fichier sélectionné.'}
                    </p>
                  </div>

                  <fieldset className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
                    <legend className="px-1 text-sm font-semibold">Mode d’import</legend>
                    <div className="mt-2 flex flex-wrap gap-3">
                      <label className={`inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm ${focusRingClass}`}>
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
                      <label className={`inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm ${focusRingClass}`}>
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
                      <label className={`mt-3 inline-flex min-h-11 items-start gap-2 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950 px-3 py-2 text-sm text-amber-900 dark:text-amber-100 ${focusRingClass}`}>
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

                  <p className="rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950 p-3 text-sm text-amber-900 dark:text-amber-100">
                    Le mode <strong>Remplacer</strong> écrase les données existantes avant import.
                  </p>

                  <button
                    type="submit"
                    disabled={!hasToken || !archiveImportFile || isImportingArchive || isExportingArchive}
                    className={`min-h-11 rounded-xl bg-sky-700 px-4 py-2 text-sm font-semibold text-white disabled:border-slate-600 disabled:bg-slate-600 disabled:text-slate-100 disabled:opacity-100 ${focusRingClass}`}
                  >
                    {isImportingArchive ? 'Import en cours...' : 'Importer l’archive'}
                  </button>
                </form>
              </section>

              <section id="soumissions-attente" ref={pendingRef} tabIndex={-1} className="mt-8">
            <h2 className="text-lg font-semibold">Soumissions en attente</h2>
            <p className="mt-2 text-slate-700 dark:text-slate-300">
              {pendingEntries.length} soumission(s) à traiter.
            </p>

            {pendingEntries.length === 0 ? (
              <p className="mt-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 text-slate-700 dark:text-slate-300">
                Aucune soumission en attente.
              </p>
            ) : (
              <ul className="mt-4 grid gap-4">
                {pendingEntries.map((entry) => {
                  const rejectReasonValue = rejectReasons[entry.submissionId] ?? ''
                  const isActionRunning = runningSubmissionId === entry.submissionId
                  const score = toNullableNumber(entry.complianceScore)
                  return (
                    <li
                      key={entry.submissionId}
                      className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm"
                    >
                      <article>
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <h3 className="text-lg font-semibold">{entry.siteTitle}</h3>
                          <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-1 text-sm font-semibold text-slate-800 dark:text-slate-200">
                            {entry.category}
                          </span>
                        </div>
                        <p className="mt-2 wrap-anywhere text-sm text-slate-700 dark:text-slate-300">{entry.normalizedUrl}</p>
                        <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">Créée le: {formatDate(entry.createdAt)}</p>
                        <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">Dernière analyse: {formatDate(entry.updatedAt)}</p>
                        <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                          Niveau: {entry.complianceStatusLabel ?? 'Inconnu'} | Score: {formatScore(score)}
                        </p>
                        <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                          Référentiel: {formatRgaaBaseline(entry.rgaaBaseline)}
                        </p>
                        {entry.reviewReason && (
                          <p className="mt-2 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950 p-3 text-sm text-amber-900 dark:text-amber-100">
                            Motif de validation manuelle: {entry.reviewReason}
                          </p>
                        )}

                        <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto_auto]">
                          <div>
                            <label htmlFor={`reject-reason-${entry.submissionId}`} className="block text-sm font-medium">
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
                              className={`mt-1 min-h-11 w-full rounded-xl border border-slate-300 dark:border-slate-600 user-invalid:border-rose-700 dark:user-invalid:border-rose-500 user-valid:border-emerald-700 dark:user-valid:border-emerald-500 bg-transparent px-3 py-2 text-base text-slate-900 dark:text-slate-50 ${focusRingClass}`}
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
                            className={`min-h-11 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:border-slate-600 disabled:bg-slate-600 disabled:text-slate-100 disabled:opacity-100 ${focusRingClass} md:self-end`}
                          >
                            {isActionRunning ? 'Traitement...' : 'Approuver'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              void handleReject(entry.submissionId)
                            }}
                            disabled={isActionRunning}
                            className={`min-h-11 rounded-xl bg-rose-700 px-4 py-2 text-sm font-semibold text-white disabled:border-slate-600 disabled:bg-slate-600 disabled:text-slate-100 disabled:opacity-100 ${focusRingClass} md:self-end`}
                          >
                            {isActionRunning ? 'Traitement...' : 'Rejeter'}
                          </button>
                        </div>
                      </article>
                    </li>
                  )
                })}
              </ul>
            )}
              </section>

              <section
                id="annuaire-publie"
                ref={publishedRef}
                tabIndex={-1}
                className="mt-8"
                aria-busy={isLoadingPublished}
              >
            <h2 className="text-lg font-semibold">Annuaire publié (édition et suppression)</h2>
            <p className="mt-2 text-slate-700 dark:text-slate-300">
              {publishedEntries.length} entrée(s) publiées.
            </p>
            <datalist id="moderation-category-suggestions">
              {availableModerationCategoryOptions.map((category) => (
                <option key={category} value={category} />
              ))}
            </datalist>

            {publishedEntries.length === 0 ? (
              <p className="mt-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 text-slate-700 dark:text-slate-300">
                Aucune entrée publiée chargée.
              </p>
            ) : (
              <ul className="mt-4 grid gap-4">
                {publishedEntries.map((entry) => {
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
                      className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm"
                    >
                      <article>
                        <h3 className="text-lg font-semibold">{entry.siteTitle}</h3>
                        <p className="mt-2 wrap-anywhere text-sm text-slate-700 dark:text-slate-300">{entry.normalizedUrl}</p>
                        <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                          Dernière mise à jour: {formatDate(entry.updatedAt)}
                        </p>
                        <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                          Référentiel: {formatRgaaBaseline(entry.rgaaBaseline)}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span
                            className={`inline-flex min-h-8 items-center rounded-full px-3 py-1 text-sm font-semibold ${
                              isSiteBlocked
                                ? 'border border-rose-400 dark:border-rose-700 bg-rose-50 dark:bg-rose-950 text-rose-900 dark:text-rose-100'
                                : 'border border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200'
                            }`}
                          >
                            {isSiteBlocked ? 'Site en blocklist' : 'Site non bloqué'}
                          </span>
                          <span
                            className={`inline-flex min-h-8 items-center rounded-full px-3 py-1 text-sm font-semibold ${
                              areVotesBlocked
                                ? 'border border-amber-400 dark:border-amber-700 bg-amber-50 dark:bg-amber-950 text-amber-900 dark:text-amber-100'
                                : 'border border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200'
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
                              className={`mt-1 min-h-11 w-full rounded-xl border border-slate-300 dark:border-slate-600 user-invalid:border-rose-700 dark:user-invalid:border-rose-500 user-valid:border-emerald-700 dark:user-valid:border-emerald-500 bg-transparent px-3 py-2 text-base text-slate-900 dark:text-slate-50 ${focusRingClass}`}
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
                              className={`mt-1 min-h-11 w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-base text-slate-900 dark:text-slate-50 ${focusRingClass}`}
                            />
                            <p id={`category-help-${itemId}`} className="mt-1 text-sm text-slate-700 dark:text-slate-300">
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
                              className={`mt-1 min-h-11 w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-base text-slate-900 dark:text-slate-50 ${focusRingClass}`}
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
                              className={`mt-1 min-h-11 w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-base text-slate-900 dark:text-slate-50 ${focusRingClass}`}
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
                              className={`mt-1 min-h-11 w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-base text-slate-900 dark:text-slate-50 ${focusRingClass}`}
                            />
                            <p id={`score-help-${itemId}`} className="mt-1 text-sm text-slate-700 dark:text-slate-300">
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
                              className={`mt-1 min-h-11 w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-base text-slate-900 dark:text-slate-50 ${focusRingClass}`}
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
                              className={`mt-1 min-h-11 w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-base text-slate-900 dark:text-slate-50 ${focusRingClass}`}
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
                            className={`min-h-11 rounded-xl bg-sky-700 px-4 py-2 text-sm font-semibold text-white disabled:border-slate-600 disabled:bg-slate-600 disabled:text-slate-100 disabled:opacity-100 ${focusRingClass}`}
                          >
                            {isRunning ? 'Traitement...' : 'Enregistrer'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              void handleSetVotesBlocked(entry.normalizedUrl, !areVotesBlocked)
                            }}
                            disabled={isRunning || isVoteRuleRunning}
                            className={`min-h-11 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:border-slate-600 disabled:bg-slate-600 disabled:text-slate-100 disabled:opacity-100 ${focusRingClass} ${
                              areVotesBlocked ? 'bg-amber-700' : 'bg-slate-700'
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
                            className={`min-h-11 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:border-slate-600 disabled:bg-slate-600 disabled:text-slate-100 disabled:opacity-100 ${focusRingClass} ${
                              isDeleteConfirm ? 'bg-rose-900' : 'bg-rose-700'
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
                            className={`min-h-11 rounded-xl bg-rose-900 px-4 py-2 text-sm font-semibold text-white disabled:border-slate-600 disabled:bg-slate-600 disabled:text-slate-100 disabled:opacity-100 ${focusRingClass}`}
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
                                ? 'border-rose-300 dark:border-rose-700 bg-rose-50 dark:bg-rose-950 text-rose-800 dark:text-rose-100'
                                : feedback.tone === 'success'
                                  ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-100'
                                  : 'border-sky-300 dark:border-sky-700 bg-sky-50 dark:bg-sky-950 text-sky-800 dark:text-sky-100'
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
              </section>

              <section
                id="blocklist-sites"
                ref={siteBlocklistSectionRef}
                tabIndex={-1}
                className="mt-8 rounded-2xl border border-rose-200 dark:border-rose-700 bg-rose-50 dark:bg-rose-950 p-6"
                aria-labelledby="blocklist-sites-titre"
              >
            <h2 id="blocklist-sites-titre" className="text-lg font-semibold text-rose-900 dark:text-rose-100">
              Blocklist des sites
            </h2>
            <p className="mt-2 text-sm text-rose-900 dark:text-rose-100">
              Les URL présentes ici ne peuvent plus être soumises. La liste reste modifiable à tout moment.
            </p>

            <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={handleAddSiteBlocklist}>
              <div className="min-w-0 flex-1">
                <label htmlFor="blocklist-site-url" className="block text-sm font-medium text-rose-900 dark:text-rose-100">
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
                  className={`mt-1 min-h-11 w-full rounded-xl border border-rose-300 dark:border-rose-700 user-invalid:border-rose-800 dark:user-invalid:border-rose-400 user-valid:border-emerald-700 dark:user-valid:border-emerald-500 bg-transparent px-3 py-2 text-base text-slate-900 dark:text-slate-50 ${focusRingClass}`}
                />
              </div>
              <button
                type="submit"
                disabled={runningBlocklistSiteUrl === siteBlocklistInput.trim()}
                className={`min-h-11 rounded-xl bg-rose-800 px-4 py-2 text-sm font-semibold text-white disabled:border-slate-600 disabled:bg-slate-600 disabled:text-slate-100 disabled:opacity-100 ${focusRingClass}`}
              >
                Ajouter à la blocklist
              </button>
            </form>

            <ul className="mt-4 grid gap-2">
              {siteBlocklist.length === 0 ? (
                <li className="rounded-xl border border-rose-200 dark:border-rose-800 bg-white dark:bg-slate-900 p-3 text-sm text-slate-700 dark:text-slate-300">
                  Aucun site en blocklist.
                </li>
              ) : (
                siteBlocklist.map((blockedUrl) => {
                  const isRunning = runningBlocklistSiteUrl === blockedUrl
                  return (
                    <li key={blockedUrl} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-200 dark:border-rose-800 bg-white dark:bg-slate-900 p-3">
                      <span className="wrap-anywhere text-sm text-slate-800 dark:text-slate-200">{blockedUrl}</span>
                      <button
                        type="button"
                        onClick={() => {
                          void handleSetSiteBlocked(blockedUrl, false)
                        }}
                        aria-label={`Retirer ${blockedUrl} de la blocklist des sites`}
                        disabled={isRunning}
                        className={`min-h-11 rounded-xl border border-rose-300 dark:border-rose-700 px-4 py-2 text-sm font-semibold text-rose-900 dark:text-rose-100 disabled:border-slate-600 disabled:bg-slate-600 disabled:text-slate-100 disabled:opacity-100 ${focusRingClass}`}
                      >
                        {isRunning ? 'Traitement...' : 'Retirer'}
                      </button>
                    </li>
                  )
                })
              )}
            </ul>
              </section>

              <section
                id="blocklist-votes"
                ref={voteBlocklistSectionRef}
                tabIndex={-1}
                className="mt-8 rounded-2xl border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-950 p-6"
                aria-labelledby="blocklist-votes-titre"
              >
            <h2 id="blocklist-votes-titre" className="text-lg font-semibold text-amber-900 dark:text-amber-100">
              Blocage des votes
            </h2>
            <p className="mt-2 text-sm text-amber-900 dark:text-amber-100">
              Les votes sont désactivés côté public pour les URL listées, jusqu’à retrait manuel.
            </p>

            <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={handleAddVoteBlocklist}>
              <div className="min-w-0 flex-1">
                <label htmlFor="blocklist-vote-url" className="block text-sm font-medium text-amber-900 dark:text-amber-100">
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
                  className={`mt-1 min-h-11 w-full rounded-xl border border-amber-300 dark:border-amber-700 user-invalid:border-rose-700 dark:user-invalid:border-rose-500 user-valid:border-emerald-700 dark:user-valid:border-emerald-500 bg-transparent px-3 py-2 text-base text-slate-900 dark:text-slate-50 ${focusRingClass}`}
                />
              </div>
              <button
                type="submit"
                disabled={runningBlocklistVoteUrl === voteBlocklistInput.trim()}
                className={`min-h-11 rounded-xl bg-amber-700 px-4 py-2 text-sm font-semibold text-white disabled:border-slate-600 disabled:bg-slate-600 disabled:text-slate-100 disabled:opacity-100 ${focusRingClass}`}
              >
                Bloquer les votes
              </button>
            </form>

            <ul className="mt-4 grid gap-2">
              {voteBlocklist.length === 0 ? (
                <li className="rounded-xl border border-amber-200 dark:border-amber-800 bg-white dark:bg-slate-900 p-3 text-sm text-slate-700 dark:text-slate-300">
                  Aucun blocage de vote actif.
                </li>
              ) : (
                voteBlocklist.map((blockedUrl) => {
                  const isRunning = runningBlocklistVoteUrl === blockedUrl
                  return (
                    <li key={blockedUrl} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 dark:border-amber-800 bg-white dark:bg-slate-900 p-3">
                      <span className="wrap-anywhere text-sm text-slate-800 dark:text-slate-200">{blockedUrl}</span>
                      <button
                        type="button"
                        onClick={() => {
                          void handleSetVotesBlocked(blockedUrl, false)
                        }}
                        aria-label={`Réactiver les votes pour ${blockedUrl}`}
                        disabled={isRunning}
                        className={`min-h-11 rounded-xl border border-amber-300 dark:border-amber-700 px-4 py-2 text-sm font-semibold text-amber-900 dark:text-amber-100 disabled:border-slate-600 disabled:bg-slate-600 disabled:text-slate-100 disabled:opacity-100 ${focusRingClass}`}
                      >
                        {isRunning ? 'Traitement...' : 'Réactiver les votes'}
                      </button>
                    </li>
                  )
                })
              )}
            </ul>
              </section>
            </>
          )}
        </main>

        <SiteFooter id="pied-page" footerRef={footerRef} />
      </div>
    </>
  )
}

export default ModerationPage
