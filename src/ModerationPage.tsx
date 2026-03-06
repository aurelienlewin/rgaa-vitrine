import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import ThemeToggle from './ThemeToggle'
import { applySeo } from './seo'

type ComplianceStatus = 'full' | 'partial' | 'none' | null

type PendingSubmission = {
  submissionId: string
  normalizedUrl: string
  siteTitle: string
  thumbnailUrl: string | null
  accessibilityPageUrl: string | null
  complianceStatus: ComplianceStatus
  complianceStatusLabel: string | null
  complianceScore: number | null
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
  updatedAt: string
  category: string
}

type PublishedEntryDraft = {
  siteTitle: string
  category: string
  complianceStatus: '' | 'full' | 'partial' | 'none'
  complianceScore: string
  thumbnailUrl: string
  accessibilityPageUrl: string
}

const moderationCategories = ['Administration', 'E-commerce', 'Media', 'Sante', 'Education', 'Associatif', 'Autre']
const complianceStatusOptions: Array<{ value: PublishedEntryDraft['complianceStatus']; label: string }> = [
  { value: '', label: 'Inconnu' },
  { value: 'full', label: 'Totalement conforme' },
  { value: 'partial', label: 'Partiellement conforme' },
  { value: 'none', label: 'Non conforme' },
]

const focusRingClass =
  'focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-brand-focus'
const skipLinksContainerClass =
  'fixed left-2 top-2 z-60 flex max-w-[calc(100vw-1rem)] -translate-y-[120%] flex-col items-start gap-2 transition-transform duration-150 motion-reduce:transition-none focus-within:translate-y-0 sm:left-4 sm:top-4 sm:max-w-none'
const skipLinkClass = `inline-flex min-h-11 items-center rounded-lg bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-50 shadow-lg ${focusRingClass}`

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

function ModerationPage() {
  const [moderationToken, setModerationToken] = useState('')
  const [pendingEntries, setPendingEntries] = useState<PendingSubmission[]>([])
  const [publishedEntries, setPublishedEntries] = useState<ShowcaseEntry[]>([])
  const [publishedDrafts, setPublishedDrafts] = useState<Record<string, PublishedEntryDraft>>({})
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({})
  const [isLoadingList, setIsLoadingList] = useState(false)
  const [isLoadingPublished, setIsLoadingPublished] = useState(false)
  const [runningSubmissionId, setRunningSubmissionId] = useState<string | null>(null)
  const [runningPublishedUrl, setRunningPublishedUrl] = useState<string | null>(null)
  const [deleteConfirmationUrl, setDeleteConfirmationUrl] = useState<string | null>(null)
  const [politeMessage, setPoliteMessage] = useState('')
  const [assertiveMessage, setAssertiveMessage] = useState('')
  const [showToken, setShowToken] = useState(false)
  const mainRef = useRef<HTMLElement | null>(null)
  const publishedRef = useRef<HTMLElement | null>(null)
  const messageRef = useRef<HTMLParagraphElement | null>(null)

  const hasToken = useMemo(() => moderationToken.trim().length > 0, [moderationToken])

  const focusMain = useCallback(() => {
    if (!mainRef.current) {
      return
    }
    mainRef.current.focus({ preventScroll: true })
    mainRef.current.scrollIntoView({ block: 'start' })
  }, [])

  const focusPublished = useCallback(() => {
    if (!publishedRef.current) {
      return
    }
    publishedRef.current.focus({ preventScroll: true })
    publishedRef.current.scrollIntoView({ block: 'start' })
  }, [])

  const focusMessage = useCallback(() => {
    if (!messageRef.current) {
      return
    }
    messageRef.current.focus({ preventScroll: true })
    messageRef.current.scrollIntoView({ block: 'start' })
  }, [])

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

  const loadPendingEntries = useCallback(async () => {
    if (!hasToken) {
      setAssertiveMessage('Veuillez saisir un jeton de modération.')
      setPoliteMessage('')
      focusMessage()
      return
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
      focusMessage()
    } catch (error) {
      const localizedMessage = error instanceof Error ? error.message : 'Erreur lors du chargement.'
      setAssertiveMessage(localizedMessage)
      setPoliteMessage('')
      focusMessage()
    } finally {
      setIsLoadingList(false)
    }
  }, [buildAuthHeaders, focusMessage, hasToken])

  const loadPublishedEntries = useCallback(async () => {
    if (!hasToken) {
      return
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
      setDeleteConfirmationUrl(null)
    } catch (error) {
      const localizedMessage =
        error instanceof Error ? error.message : 'Erreur lors du chargement de l’annuaire publié.'
      setAssertiveMessage(localizedMessage)
      setPoliteMessage('')
      focusMessage()
    } finally {
      setIsLoadingPublished(false)
    }
  }, [buildAuthHeaders, focusMessage, hasToken])

  const handleApprove = useCallback(
    async (submissionId: string) => {
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
        focusMessage()
      } catch (error) {
        const localizedMessage = error instanceof Error ? error.message : 'Erreur lors de la validation.'
        setAssertiveMessage(localizedMessage)
        setPoliteMessage('')
        focusMessage()
      } finally {
        setRunningSubmissionId(null)
      }
    },
    [buildAuthHeaders, focusMessage, loadPublishedEntries],
  )

  const handleReject = useCallback(
    async (submissionId: string) => {
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
        focusMessage()
      } catch (error) {
        const localizedMessage = error instanceof Error ? error.message : 'Erreur lors du rejet.'
        setAssertiveMessage(localizedMessage)
        setPoliteMessage('')
        focusMessage()
      } finally {
        setRunningSubmissionId(null)
      }
    },
    [buildAuthHeaders, focusMessage, rejectReasons],
  )

  const handleTokenSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      await loadPendingEntries()
      await loadPublishedEntries()
    },
    [loadPendingEntries, loadPublishedEntries],
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
    },
    [],
  )

  const handleUpdatePublishedEntry = useCallback(
    async (normalizedUrl: string) => {
      const draft = publishedDrafts[normalizedUrl]
      if (!draft) {
        return
      }

      setRunningPublishedUrl(normalizedUrl)
      setDeleteConfirmationUrl(null)
      setAssertiveMessage('')
      setPoliteMessage('Mise à jour de l’entrée en cours...')

      try {
        const scoreRaw = draft.complianceScore.trim()
        let scoreNumber: number | null = null
        if (scoreRaw) {
          scoreNumber = Number(scoreRaw.replace(',', '.'))
          if (Number.isNaN(scoreNumber) || scoreNumber < 0 || scoreNumber > 100) {
            throw new Error('Le score doit être un nombre compris entre 0 et 100.')
          }
        }
        const normalizedScore = scoreNumber === null ? null : Math.round(scoreNumber * 100) / 100

        const response = await fetch('/api/moderation/showcase/update', {
          method: 'POST',
          headers: buildAuthHeaders(true),
          body: JSON.stringify({
            normalizedUrl,
            siteTitle: draft.siteTitle,
            category: draft.category,
            complianceStatus: draft.complianceStatus || null,
            complianceScore: normalizedScore,
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
        setPoliteMessage(info)
        focusMessage()
      } catch (error) {
        const localizedMessage = error instanceof Error ? error.message : 'Erreur lors de la mise à jour.'
        setAssertiveMessage(localizedMessage)
        setPoliteMessage('')
        focusMessage()
      } finally {
        setRunningPublishedUrl(null)
      }
    },
    [buildAuthHeaders, focusMessage, publishedDrafts],
  )

  const handleDeletePublishedEntry = useCallback(
    async (normalizedUrl: string) => {
      if (deleteConfirmationUrl !== normalizedUrl) {
        setDeleteConfirmationUrl(normalizedUrl)
        setAssertiveMessage('')
        setPoliteMessage('Cliquez à nouveau sur supprimer pour confirmer.')
        focusMessage()
        return
      }

      setRunningPublishedUrl(normalizedUrl)
      setAssertiveMessage('')
      setPoliteMessage('Suppression de l’entrée en cours...')

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
        setDeleteConfirmationUrl(null)
        setPoliteMessage(info)
        focusMessage()
      } catch (error) {
        const localizedMessage = error instanceof Error ? error.message : 'Erreur lors de la suppression.'
        setAssertiveMessage(localizedMessage)
        setPoliteMessage('')
        focusMessage()
      } finally {
        setRunningPublishedUrl(null)
      }
    },
    [buildAuthHeaders, deleteConfirmationUrl, focusMessage],
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

  return (
    <>
      <div
        className={skipLinksContainerClass}
        aria-label="Liens d’évitement"
      >
        <a href="#contenu-moderation" className={skipLinkClass} onClick={focusMain}>
          Aller au contenu
        </a>
        <a href="#annuaire-publie" className={skipLinkClass} onClick={focusPublished}>
          Aller à l’annuaire publié
        </a>
      </div>

      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true" lang="fr">
        {politeMessage}
      </div>
      <div className="sr-only" role="alert" aria-live="assertive" aria-atomic="true" lang="fr">
        {assertiveMessage}
      </div>

      <div className="min-h-screen bg-brand-surface text-brand-ink">
        <header className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
          <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h1 className="text-xl font-semibold">Modération Annuaire RGAA</h1>
              <div className="flex flex-wrap items-center gap-2">
                <ThemeToggle
                  className={`inline-flex min-h-11 items-center rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-900 dark:text-slate-50 ${focusRingClass}`}
                />
                <a href="/" className={`inline-flex min-h-11 items-center rounded-xl border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm font-semibold ${focusRingClass}`}>
                  Retour à l’annuaire
                </a>
                <a
                  href="/plan-du-site"
                  className={`inline-flex min-h-11 items-center rounded-xl border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm font-semibold ${focusRingClass}`}
                >
                  Plan du site
                </a>
                <a
                  href="/accessibilite"
                  className={`inline-flex min-h-11 items-center rounded-xl border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm font-semibold ${focusRingClass}`}
                >
                  Accessibilité
                </a>
              </div>
            </div>
            <p className="mt-2 text-slate-700 dark:text-slate-300">
              Validez ou rejetez les soumissions en attente sans passer par `curl`.
            </p>
          </div>
        </header>

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
                  id="token-moderation"
                  type={showToken ? 'text' : 'password'}
                  value={moderationToken}
                  onChange={(event) => setModerationToken(event.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  className={`mt-1 min-h-11 w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-3 py-2 text-base text-slate-900 dark:text-slate-50 ${focusRingClass}`}
                />
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
                className={`min-h-11 rounded-xl bg-slate-900 dark:bg-slate-100 px-4 py-2 text-sm font-semibold text-white dark:text-slate-950 disabled:opacity-60 ${focusRingClass} md:self-end`}
              >
                {isLoadingList || isLoadingPublished ? 'Chargement...' : 'Charger la modération'}
              </button>
            </form>

            {(politeMessage || assertiveMessage) && (
              <p
                ref={messageRef}
                tabIndex={-1}
                className={`mt-4 rounded-lg border p-3 text-sm ${
                  assertiveMessage
                    ? 'border-rose-300 dark:border-rose-700 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-100'
                    : 'border-sky-300 dark:border-sky-600 bg-sky-50 dark:bg-sky-950/40 text-sky-900 dark:text-sky-100'
                }`}
                role={assertiveMessage ? 'alert' : 'status'}
                aria-live={assertiveMessage ? 'assertive' : 'polite'}
              >
                {assertiveMessage || politeMessage}
              </p>
            )}
          </section>

          <section className="mt-8">
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
                        <p className="mt-2 break-all text-sm text-slate-700 dark:text-slate-300">{entry.normalizedUrl}</p>
                        <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">Créée le: {formatDate(entry.createdAt)}</p>
                        <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">Dernière analyse: {formatDate(entry.updatedAt)}</p>
                        <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                          Niveau: {entry.complianceStatusLabel ?? 'Inconnu'} | Score: {formatScore(score)}
                        </p>
                        {entry.reviewReason && (
                          <p className="mt-2 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 p-3 text-sm text-amber-900 dark:text-amber-100">
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
                              className={`mt-1 min-h-11 w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-3 py-2 text-base text-slate-900 dark:text-slate-50 ${focusRingClass}`}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              void handleApprove(entry.submissionId)
                            }}
                            disabled={isActionRunning}
                            className={`min-h-11 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 ${focusRingClass} md:self-end`}
                          >
                            {isActionRunning ? 'Traitement...' : 'Approuver'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              void handleReject(entry.submissionId)
                            }}
                            disabled={isActionRunning}
                            className={`min-h-11 rounded-xl bg-rose-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 ${focusRingClass} md:self-end`}
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

                  return (
                    <li
                      key={entry.normalizedUrl}
                      className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm"
                    >
                      <article>
                        <h3 className="text-lg font-semibold">{entry.siteTitle}</h3>
                        <p className="mt-2 break-all text-sm text-slate-700 dark:text-slate-300">{entry.normalizedUrl}</p>
                        <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                          Dernière mise à jour: {formatDate(entry.updatedAt)}
                        </p>

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
                              className={`mt-1 min-h-11 w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-3 py-2 text-base text-slate-900 dark:text-slate-50 ${focusRingClass}`}
                            />
                          </div>
                          <div>
                            <label htmlFor={`category-${itemId}`} className="block text-sm font-medium">
                              Catégorie
                            </label>
                            <select
                              id={`category-${itemId}`}
                              value={draft.category}
                              onChange={(event) =>
                                handlePublishedDraftChange(entry.normalizedUrl, 'category', event.target.value)
                              }
                              className={`mt-1 min-h-11 w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-3 py-2 text-base text-slate-900 dark:text-slate-50 ${focusRingClass}`}
                            >
                              {moderationCategories.map((category) => (
                                <option key={category} value={category}>
                                  {category}
                                </option>
                              ))}
                            </select>
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
                              className={`mt-1 min-h-11 w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-3 py-2 text-base text-slate-900 dark:text-slate-50 ${focusRingClass}`}
                            >
                              {complianceStatusOptions.map((statusOption) => (
                                <option key={statusOption.value || 'unknown'} value={statusOption.value}>
                                  {statusOption.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label htmlFor={`score-${itemId}`} className="block text-sm font-medium">
                              Score
                            </label>
                            <input
                              id={`score-${itemId}`}
                              inputMode="decimal"
                              value={draft.complianceScore}
                              onChange={(event) =>
                                handlePublishedDraftChange(entry.normalizedUrl, 'complianceScore', event.target.value)
                              }
                              className={`mt-1 min-h-11 w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-3 py-2 text-base text-slate-900 dark:text-slate-50 ${focusRingClass}`}
                            />
                          </div>
                          <div className="md:col-span-2">
                            <label htmlFor={`thumb-${itemId}`} className="block text-sm font-medium">
                              URL vignette (optionnel)
                            </label>
                            <input
                              id={`thumb-${itemId}`}
                              value={draft.thumbnailUrl}
                              onChange={(event) =>
                                handlePublishedDraftChange(entry.normalizedUrl, 'thumbnailUrl', event.target.value)
                              }
                              className={`mt-1 min-h-11 w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-3 py-2 text-base text-slate-900 dark:text-slate-50 ${focusRingClass}`}
                            />
                          </div>
                          <div className="md:col-span-2">
                            <label htmlFor={`a11y-${itemId}`} className="block text-sm font-medium">
                              URL déclaration d’accessibilité (optionnel)
                            </label>
                            <input
                              id={`a11y-${itemId}`}
                              value={draft.accessibilityPageUrl}
                              onChange={(event) =>
                                handlePublishedDraftChange(
                                  entry.normalizedUrl,
                                  'accessibilityPageUrl',
                                  event.target.value,
                                )
                              }
                              className={`mt-1 min-h-11 w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-3 py-2 text-base text-slate-900 dark:text-slate-50 ${focusRingClass}`}
                            />
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              void handleUpdatePublishedEntry(entry.normalizedUrl)
                            }}
                            disabled={isRunning}
                            className={`min-h-11 rounded-xl bg-sky-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 ${focusRingClass}`}
                          >
                            {isRunning ? 'Traitement...' : 'Enregistrer'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              void handleDeletePublishedEntry(entry.normalizedUrl)
                            }}
                            disabled={isRunning}
                            className={`min-h-11 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 ${focusRingClass} ${
                              isDeleteConfirm ? 'bg-rose-900' : 'bg-rose-700'
                            }`}
                          >
                            {isRunning ? 'Traitement...' : isDeleteConfirm ? 'Confirmer suppression' : 'Supprimer'}
                          </button>
                        </div>
                      </article>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </main>
      </div>
    </>
  )
}

export default ModerationPage
