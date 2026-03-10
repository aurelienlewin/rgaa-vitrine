import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent, RefObject } from 'react'
import { normalizeDomainGroup, readDomainGroupSlugFromPath, type DomainGroup } from './domainGroups'
import { preloadRouteApi } from './routeData'
import { applySeo, createAbsoluteUrl } from './seo'
import { resolveShowcaseProfilePath } from './siteProfiles'
import SecondaryPageHeader from './SecondaryPageHeader'
import SiteFooter from './SiteFooter'
import { visuallyHiddenStyle } from './visuallyHidden'

const focusRingClass =
  'focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-brand-focus'
const skipLinksContainerClass =
  'fixed start-2 top-2 z-60 flex max-w-[calc(100vw-1rem)] -translate-y-[120%] flex-col items-start gap-2 transition-transform duration-150 motion-reduce:transition-none focus-within:translate-y-0 sm:start-4 sm:top-4 sm:max-w-none'
const skipLinkClass = `inline-flex min-h-11 items-center rounded-lg border border-slate-900 bg-slate-950 px-3 py-2 text-slate-50 underline decoration-2 underline-offset-2 shadow-lg dark:border-slate-50 dark:bg-slate-50 dark:text-slate-950 ${focusRingClass}`

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

function DomainGroupPage() {
  const [group, setGroup] = useState<DomainGroup | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [politeAnnouncement, setPoliteAnnouncement] = useState({ id: 0, message: '' })
  const mainRef = useRef<HTMLElement | null>(null)
  const navigationRef = useRef<HTMLElement | null>(null)
  const listRef = useRef<HTMLElement | null>(null)
  const footerRef = useRef<HTMLElement | null>(null)

  const slug =
    typeof window !== 'undefined'
      ? readDomainGroupSlugFromPath(window.location.pathname)
      : null
  const requestedPath =
    typeof window !== 'undefined'
      ? window.location.pathname
      : slug
        ? `/domaine/${slug}`
        : '/domaine'

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

  const announcePolite = useCallback((message: string) => {
    setPoliteAnnouncement((current) => ({ id: current.id + 1, message }))
  }, [])

  useEffect(() => {
    if (!slug) {
      setIsLoading(false)
      setErrorMessage('Lien de domaine invalide.')
      return
    }
    const groupSlug = slug

    let cancelled = false

    async function loadGroup() {
      setIsLoading(true)
      setErrorMessage(null)

      try {
        const { ok, payload } = await preloadRouteApi(
          `/api/domain-groups?slug=${encodeURIComponent(groupSlug)}`,
        )

        if (!ok) {
          throw new Error(typeof payload.error === 'string' ? payload.error : 'Chargement du domaine impossible.')
        }

        const groups = Array.isArray(payload.groups) ? (payload.groups as unknown[]) : null
        if (!groups) {
          throw new Error('Réponse domaine invalide.')
        }

        const firstGroup = groups.map((item) => normalizeDomainGroup(item)).find((item) => item !== null) ?? null
        if (!firstGroup) {
          throw new Error('Aucun domaine multi-sites ne correspond à cette adresse.')
        }

        if (!cancelled) {
          setGroup(firstGroup)
          announcePolite(
            `${firstGroup.siteCount} fiche(s) chargée(s) pour le domaine ${firstGroup.registrableDomain}.`,
          )
        }
      } catch (error) {
        if (!cancelled) {
          setGroup(null)
          setErrorMessage(error instanceof Error ? error.message : 'Erreur de chargement.')
          announcePolite('Chargement du domaine terminé avec erreur.')
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadGroup()

    return () => {
      cancelled = true
    }
  }, [announcePolite, slug])

  const statusSummaryText = useMemo(() => {
    if (!group) {
      return null
    }

    const parts = [
      group.statusSummary.full > 0 ? `${group.statusSummary.full} totalement conforme(s)` : null,
      group.statusSummary.partial > 0 ? `${group.statusSummary.partial} partiellement conforme(s)` : null,
      group.statusSummary.none > 0 ? `${group.statusSummary.none} non conforme(s)` : null,
      group.statusSummary.unknown > 0 ? `${group.statusSummary.unknown} niveau(x) inconnu(s)` : null,
    ].filter((value): value is string => Boolean(value))

    return parts.length > 0 ? parts.join(', ') : 'Aucune synthèse de conformité disponible.'
  }, [group])

  useEffect(() => {
    if (group) {
      applySeo({
        title: `Domaine ${group.registrableDomain} | Annuaire RGAA`,
        description: `Consultez les ${group.siteCount} fiches publiques déjà référencées pour le domaine ${group.registrableDomain}.`,
        path: group.groupPath,
        ogType: 'website',
        structuredData: {
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'CollectionPage',
              '@id': `${createAbsoluteUrl(group.groupPath)}#webpage`,
              url: createAbsoluteUrl(group.groupPath),
              name: `Domaine ${group.registrableDomain}`,
              inLanguage: 'fr-FR',
              description: `Page domaine multi-sites listant ${group.siteCount} fiches publiques pour ${group.registrableDomain}.`,
            },
            {
              '@type': 'ItemList',
              '@id': `${createAbsoluteUrl(group.groupPath)}#item-list`,
              name: `Sous-sites référencés pour ${group.registrableDomain}`,
              numberOfItems: group.siteCount,
              itemListElement: group.children.map((entry, index) => ({
                '@type': 'ListItem',
                position: index + 1,
                name: entry.siteTitle,
                item: createAbsoluteUrl(
                  entry.profilePath ?? resolveShowcaseProfilePath(entry.normalizedUrl, entry.slug),
                ),
              })),
            },
          ],
        },
      })
      return
    }

    if (isLoading && slug) {
      applySeo({
        title: 'Domaine multi-sites | Annuaire RGAA',
        description: 'Consultez toutes les fiches publiques rattachées à un même domaine racine dans l’annuaire RGAA.',
        path: requestedPath,
        ogType: 'website',
        structuredData: {
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          '@id': `${createAbsoluteUrl(requestedPath)}#webpage`,
          url: createAbsoluteUrl(requestedPath),
          name: 'Domaine multi-sites | Annuaire RGAA',
          inLanguage: 'fr-FR',
          description: 'Page domaine multi-sites de l’annuaire RGAA.',
        },
      })
      return
    }

    applySeo({
      title: 'Domaine multi-sites introuvable | Annuaire RGAA',
      description:
        'Le domaine demandé n’a pas été trouvé dans l’annuaire RGAA. Retournez à l’accueil pour parcourir les fiches publiques.',
      path: requestedPath,
      robots: 'noindex,follow',
      structuredData: null,
    })
  }, [group, isLoading, requestedPath, slug])

  return (
    <>
      <div className="sr-only" style={visuallyHiddenStyle} role="status" aria-live="polite" aria-atomic="true" lang="fr">
        {politeAnnouncement.message}
        <span aria-hidden="true">{politeAnnouncement.id}</span>
      </div>

      <div className={skipLinksContainerClass} aria-label="Liens d’évitement">
        <a href="#contenu-domaine" className={skipLinkClass} onClick={(event) => handleSkipLinkClick(event, mainRef)}>
          Aller au contenu
        </a>
        <a href="#navigation-principale" className={skipLinkClass} onClick={(event) => handleSkipLinkClick(event, navigationRef)}>
          Aller à la navigation principale
        </a>
        <a href="#liste-domaine" className={skipLinkClass} onClick={(event) => handleSkipLinkClick(event, listRef)}>
          Aller à la liste des sous-sites
        </a>
        <a href="#pied-page" className={skipLinkClass} onClick={(event) => handleSkipLinkClick(event, footerRef)}>
          Aller au pied de page
        </a>
      </div>

      <div className="min-h-screen bg-brand-surface text-brand-ink">
        <SecondaryPageHeader
          title="Domaine multi-sites"
          navigationRef={navigationRef}
          description="Consultez toutes les fiches publiques rattachées à un même domaine racine."
        />

        <main
          id="contenu-domaine"
          ref={mainRef}
          tabIndex={-1}
          className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8"
          aria-busy={isLoading}
        >
          {isLoading ? <p role="status" aria-live="polite">Chargement du domaine en cours...</p> : null}

          {!isLoading && errorMessage ? (
            <p className="rounded-xl border border-rose-300 dark:border-rose-700 bg-rose-50 dark:bg-rose-950 p-4 text-rose-900 dark:text-rose-100" role="alert">
              {errorMessage}
            </p>
          ) : null}

          {!isLoading && group ? (
            <article className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm">
              <header className="rounded-2xl border border-sky-200 dark:border-sky-700 bg-sky-50 dark:bg-sky-950 p-4">
                <p className="text-sm font-semibold uppercase tracking-wide text-sky-900 dark:text-sky-100">
                  Domaine racine
                </p>
                <h2 className="mt-2 text-2xl font-bold text-slate-950 dark:text-slate-50">
                  {group.registrableDomain}
                </h2>
                <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
                  {group.siteCount} fiche(s) publique(s). Dernière mise à jour: {formatDate(group.updatedAt)}.
                </p>
                <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">{statusSummaryText}</p>
                {group.primaryEntry?.profilePath ? (
                  <p className="mt-3 text-sm text-slate-900 dark:text-slate-100">
                    Site principal repéré:{' '}
                    <a
                      href={group.primaryEntry.profilePath}
                      className={`font-semibold underline ${focusRingClass}`}
                    >
                      {group.primaryEntry.siteTitle}
                    </a>
                  </p>
                ) : null}
              </header>

              <section
                id="liste-domaine"
                ref={listRef}
                tabIndex={-1}
                className="mt-6"
                aria-labelledby="liste-domaine-titre"
              >
                <h3 id="liste-domaine-titre" className="text-lg font-semibold">
                  Sous-sites déjà référencés
                </h3>
                <ul className="mt-4 grid gap-4">
                  {group.children.map((entry) => {
                    const profilePath =
                      entry.profilePath ?? resolveShowcaseProfilePath(entry.normalizedUrl, entry.slug)
                    const isPrimary =
                      group.primaryEntry?.normalizedUrl === entry.normalizedUrl

                    return (
                      <li
                        key={entry.normalizedUrl}
                        className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-4"
                      >
                        <article>
                          <div className="flex flex-wrap items-center gap-2">
                            {isPrimary ? (
                              <span className="inline-flex min-h-8 items-center rounded-full border border-sky-700 dark:border-sky-300 bg-sky-100 dark:bg-sky-950 px-3 py-1 text-sm font-semibold text-sky-900 dark:text-sky-100">
                                Site principal
                              </span>
                            ) : null}
                            <span className="inline-flex min-h-8 items-center rounded-full border border-slate-500 dark:border-slate-400 bg-slate-100 dark:bg-slate-900 px-3 py-1 text-sm font-semibold text-slate-800 dark:text-slate-200">
                              Score {formatScore(entry.complianceScore)}
                            </span>
                            <span className="inline-flex min-h-8 items-center rounded-full border border-slate-500 dark:border-slate-400 bg-slate-100 dark:bg-slate-900 px-3 py-1 text-sm font-semibold text-slate-800 dark:text-slate-200">
                              {entry.complianceStatusLabel ?? 'Niveau inconnu'}
                            </span>
                          </div>
                          <h4 className="mt-3 text-lg font-semibold text-slate-950 dark:text-slate-50">
                            {entry.siteTitle}
                          </h4>
                          <p className="mt-1 wrap-anywhere text-sm text-slate-700 dark:text-slate-300">
                            {entry.normalizedUrl}
                          </p>
                          <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                            Catégorie: {entry.category} · Mise à jour: {formatDate(entry.updatedAt)}
                          </p>

                          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
                            <a
                              href={profilePath}
                              className={`inline-flex min-h-11 items-center justify-center rounded-xl border border-sky-700 dark:border-sky-300 px-3 py-2 text-sm font-semibold text-sky-900 dark:text-sky-100 ${focusRingClass}`}
                            >
                              Voir la fiche annuaire
                            </a>
                            <a
                              href={entry.normalizedUrl}
                              target="_blank"
                              rel="noopener external"
                              referrerPolicy="strict-origin-when-cross-origin"
                              className={`inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-700 dark:border-slate-300 px-3 py-2 text-sm font-semibold text-slate-900 dark:text-slate-50 ${focusRingClass}`}
                            >
                              Visiter le site (nouvel onglet)
                            </a>
                            {entry.accessibilityPageUrl ? (
                              <a
                                href={entry.accessibilityPageUrl}
                                target="_blank"
                                rel="noopener external"
                                referrerPolicy="strict-origin-when-cross-origin"
                                className={`inline-flex min-h-11 items-center justify-center rounded-xl border border-emerald-700 dark:border-emerald-300 px-3 py-2 text-sm font-semibold text-emerald-900 dark:text-emerald-100 ${focusRingClass}`}
                              >
                                Déclaration d’accessibilité (nouvel onglet)
                              </a>
                            ) : (
                              <span className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-500 dark:border-slate-400 px-3 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                                Déclaration non détectée
                              </span>
                            )}
                          </div>
                        </article>
                      </li>
                    )
                  })}
                </ul>
              </section>
            </article>
          ) : null}
        </main>

        <SiteFooter id="pied-page" footerRef={footerRef} />
      </div>
    </>
  )
}

export default DomainGroupPage
