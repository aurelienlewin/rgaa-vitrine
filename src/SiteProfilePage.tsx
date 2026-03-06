import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent, RefObject } from 'react'
import ThemeToggle from './ThemeToggle'
import { applySeo, createAbsoluteUrl } from './seo'
import { readSiteSlugFromPath, resolveShowcaseProfilePath } from './siteProfiles'

type ComplianceStatus = 'full' | 'partial' | 'none' | null

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
  rgaaBaseline: '4.1' | '5.0-ready'
  updatedAt: string
  category: string
}

const focusRingClass =
  'focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-brand-focus'
const skipLinksContainerClass =
  'fixed start-2 top-2 z-60 flex max-w-[calc(100vw-1rem)] -translate-y-[120%] flex-col items-start gap-2 transition-transform duration-150 motion-reduce:transition-none focus-within:translate-y-0 sm:start-4 sm:top-4 sm:max-w-none'
const skipLinkClass = `inline-flex min-h-11 items-center rounded-lg bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-50 shadow-lg ${focusRingClass}`

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

function isShowcaseEntry(payload: unknown): payload is ShowcaseEntry {
  if (!payload || typeof payload !== 'object') {
    return false
  }

  const candidate = payload as Record<string, unknown>
  return (
    typeof candidate.normalizedUrl === 'string' &&
    typeof candidate.siteTitle === 'string' &&
    typeof candidate.category === 'string' &&
    typeof candidate.updatedAt === 'string'
  )
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

function SiteProfilePage() {
  const [entry, setEntry] = useState<ShowcaseEntry | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [copyMessage, setCopyMessage] = useState('')
  const mainRef = useRef<HTMLElement | null>(null)
  const backlinkSectionRef = useRef<HTMLElement | null>(null)
  const copyMessageRef = useRef<HTMLParagraphElement | null>(null)
  const slug =
    typeof window !== 'undefined'
      ? readSiteSlugFromPath(window.location.pathname)
      : null

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

  const profilePath = useMemo(() => {
    if (!entry) {
      return slug ? `/site/${slug}` : '/site'
    }

    return resolveShowcaseProfilePath(entry.normalizedUrl, entry.slug)
  }, [entry, slug])
  const profileUrl = createAbsoluteUrl(profilePath)
  const backlinkSnippet = `<a href="${profileUrl}">Référencé sur Annuaire RGAA</a>`

  useEffect(() => {
    if (entry) {
      applySeo({
        title: `${entry.siteTitle} | Fiche annuaire RGAA`,
        description: `${entry.siteTitle} est référencé sur annuaire-rgaa.fr avec catégorie, score détecté et accès à la déclaration d’accessibilité.`,
        path: profilePath,
        structuredData: {
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'WebPage',
              '@id': `${profileUrl}#webpage`,
              url: profileUrl,
              name: `${entry.siteTitle} | Fiche annuaire RGAA`,
              inLanguage: 'fr-FR',
              description:
                'Fiche publique d’un site référencé dans l’annuaire RGAA avec informations de conformité et liens utiles.',
              isPartOf: {
                '@type': 'WebSite',
                '@id': `${createAbsoluteUrl('/')}#website`,
                url: createAbsoluteUrl('/'),
                name: 'Annuaire RGAA',
              },
              about: {
                '@type': 'Organization',
                name: entry.siteTitle,
                url: entry.normalizedUrl,
              },
            },
            {
              '@type': 'BreadcrumbList',
              itemListElement: [
                {
                  '@type': 'ListItem',
                  position: 1,
                  name: 'Accueil',
                  item: createAbsoluteUrl('/'),
                },
                {
                  '@type': 'ListItem',
                  position: 2,
                  name: entry.siteTitle,
                  item: profileUrl,
                },
              ],
            },
          ],
        },
      })
      return
    }

    applySeo({
      title: 'Fiche annuaire introuvable | Annuaire RGAA',
      description:
        'La fiche demandée n’a pas été trouvée dans l’annuaire RGAA. Retournez à l’accueil pour parcourir les sites référencés.',
      path: profilePath,
      robots: 'noindex,follow',
      structuredData: null,
    })
  }, [entry, profilePath, profileUrl])

  useEffect(() => {
    if (!slug) {
      setIsLoading(false)
      setErrorMessage('Lien de fiche invalide.')
      return
    }
    const siteSlug = slug

    let cancelled = false

    async function loadEntry() {
      setIsLoading(true)
      setErrorMessage(null)

      try {
        const response = await fetch(`/api/showcase?slug=${encodeURIComponent(siteSlug)}&limit=500`)
        const payload = await readApiPayload(response)

        if (!response.ok) {
          throw new Error(typeof payload.error === 'string' ? payload.error : 'Chargement de la fiche impossible.')
        }

        const responseEntries = Array.isArray(payload.entries)
          ? payload.entries
          : Array.isArray(payload)
            ? payload
            : null

        if (!responseEntries) {
          throw new Error('Réponse annuaire invalide.')
        }

        const firstEntry = responseEntries.find((candidate) => isShowcaseEntry(candidate))
        if (!firstEntry) {
          throw new Error('Aucune fiche ne correspond à cette adresse.')
        }

        if (!cancelled) {
          setEntry(firstEntry)
        }
      } catch (error) {
        if (!cancelled) {
          const localizedMessage = error instanceof Error ? error.message : 'Erreur de chargement.'
          setEntry(null)
          setErrorMessage(localizedMessage)
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadEntry()

    return () => {
      cancelled = true
    }
  }, [slug])

  useEffect(() => {
    if (copyMessage) {
      focusElement(copyMessageRef.current)
    }
  }, [copyMessage, focusElement])

  const handleCopyBacklink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(backlinkSnippet)
      setCopyMessage('Code copié. Vous pouvez le coller dans votre site.')
    } catch {
      setCopyMessage('Copie automatique indisponible. Sélectionnez puis copiez le code manuellement.')
    }
  }, [backlinkSnippet])

  return (
    <>
      <div
        className={skipLinksContainerClass}
        aria-label="Liens d’évitement"
      >
        <a href="#contenu-fiche" className={skipLinkClass} onClick={(event) => handleSkipLinkClick(event, mainRef)}>
          Aller au contenu
        </a>
        <a href="#backlink-fiche" className={skipLinkClass} onClick={(event) => handleSkipLinkClick(event, backlinkSectionRef)}>
          Aller au lien retour
        </a>
      </div>

      <div className="min-h-screen bg-brand-surface text-brand-ink">
        <header className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
          <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h1 className="text-2xl font-bold">Fiche annuaire</h1>
              <div className="flex flex-wrap items-center gap-2">
                <ThemeToggle
                  className={`inline-flex min-h-11 items-center rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-900 dark:text-slate-50 ${focusRingClass}`}
                />
                <a
                  href="/"
                  className={`inline-flex min-h-11 items-center rounded-xl border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm font-semibold ${focusRingClass}`}
                >
                  Retour à l’annuaire
                </a>
                <a
                  href="/plan-du-site"
                  className={`inline-flex min-h-11 items-center rounded-xl border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm font-semibold ${focusRingClass}`}
                >
                  Plan du site
                </a>
              </div>
            </div>
          </div>
        </header>

        <main
          id="contenu-fiche"
          ref={mainRef}
          tabIndex={-1}
          className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8"
        >
          {isLoading && <p role="status" aria-live="polite">Chargement de la fiche en cours...</p>}

          {!isLoading && errorMessage && (
            <p className="rounded-xl border border-rose-300 dark:border-rose-700 bg-rose-50 dark:bg-rose-950/40 p-4 text-rose-900 dark:text-rose-100" role="alert">
              {errorMessage}
            </p>
          )}

          {!isLoading && entry && (
            <article className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm">
              <h2 className="text-2xl font-bold">{entry.siteTitle}</h2>
              <p className="mt-2 text-slate-700 dark:text-slate-300">
                Catégorie: <strong>{entry.category}</strong>
              </p>
              <p className="mt-1 text-slate-700 dark:text-slate-300">
                Dernière mise à jour: {formatDate(entry.updatedAt)}
              </p>
              <p className="mt-1 text-slate-700 dark:text-slate-300">
                Score détecté: <strong>{formatScore(entry.complianceScore)}</strong>
              </p>
              <p className="mt-1 text-slate-700 dark:text-slate-300">
                Niveau détecté: <strong>{entry.complianceStatusLabel ?? 'N/A'}</strong>
              </p>

              <div className="mt-4 flex flex-wrap gap-3">
                <a
                  href={entry.normalizedUrl}
                  target="_blank"
                  rel="noopener external"
                  referrerPolicy="strict-origin-when-cross-origin"
                  className={`inline-flex min-h-11 items-center rounded-xl border border-slate-300 dark:border-slate-600 px-4 py-2 font-semibold text-slate-900 dark:text-slate-50 ${focusRingClass}`}
                >
                  Visiter le site d’origine
                </a>
                {entry.accessibilityPageUrl ? (
                  <a
                    href={entry.accessibilityPageUrl}
                    target="_blank"
                    rel="noopener external"
                    referrerPolicy="strict-origin-when-cross-origin"
                    className={`inline-flex min-h-11 items-center rounded-xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 px-4 py-2 font-semibold text-emerald-900 dark:text-emerald-100 ${focusRingClass}`}
                  >
                    Déclaration d’accessibilité
                  </a>
                ) : (
                  <span className="inline-flex min-h-11 items-center rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 px-4 py-2 text-slate-700 dark:text-slate-300">
                    Déclaration non détectée
                  </span>
                )}
              </div>

              <section id="backlink-fiche" ref={backlinkSectionRef} tabIndex={-1} className="mt-6 rounded-xl border border-sky-300 dark:border-sky-700 bg-sky-50 dark:bg-sky-950/40 p-4" aria-labelledby="backlink-fiche-titre">
                <h3 id="backlink-fiche-titre" className="text-lg font-semibold text-sky-900 dark:text-sky-100">
                  Lien retour recommandé
                </h3>
                <p className="mt-2 text-sm text-sky-900 dark:text-sky-100">
                  Pour faciliter la découverte mutuelle, vous pouvez publier ce lien vers votre fiche annuaire.
                </p>
                <label htmlFor="backlink-code" className="mt-3 block text-sm font-semibold text-sky-900 dark:text-sky-100">
                  Code HTML prêt à copier
                </label>
                <textarea
                  id="backlink-code"
                  readOnly
                  value={backlinkSnippet}
                  className={`mt-1 min-h-24 w-full rounded-xl border border-sky-300 dark:border-sky-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-50 ${focusRingClass}`}
                />
                <button
                  type="button"
                  onClick={() => {
                    void handleCopyBacklink()
                  }}
                  className={`mt-3 inline-flex min-h-11 items-center rounded-xl bg-sky-700 px-4 py-2 font-semibold text-white ${focusRingClass}`}
                >
                  Copier le code
                </button>
                {copyMessage && (
                  <p ref={copyMessageRef} tabIndex={-1} className="mt-3 text-sm text-sky-900 dark:text-sky-100" role="status" aria-live="polite">
                    {copyMessage}
                  </p>
                )}
              </section>
            </article>
          )}
        </main>
      </div>
    </>
  )
}

export default SiteProfilePage
