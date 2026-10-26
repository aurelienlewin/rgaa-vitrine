import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent, RefObject } from 'react'
import {
  normalizeDomainGroup,
  readDomainGroupSlugFromPath,
  type ComplianceStatus,
  type DomainGroup,
} from './domainGroups'
import {
  focusElementWithScroll,
  focusTargetClass,
  focusTargetScrollMarginClass,
  useHashTargetFocus,
} from './hashNavigation'
import { preloadRouteApi, readPreloadedRouteApi } from './routeData'
import { applySeo, createAbsoluteUrl } from './seo'
import { resolveShowcaseProfilePath } from './siteProfiles'
import SecondaryPageHeader from './SecondaryPageHeader'
import SiteFooter from './SiteFooter'

const focusRingClass =
  'focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-brand-focus'
const skipLinksContainerClass =
  'fixed start-2 top-2 z-60 flex max-w-[calc(100vw-1rem)] -translate-y-[120%] flex-col items-start gap-2 transition-transform duration-150 motion-reduce:transition-none focus-within:translate-y-0 hover:translate-y-0 sm:start-4 sm:top-4 sm:max-w-none'
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

const statusClassByValue: Record<Exclude<ComplianceStatus, null>, string> = {
  full: 'ui-badge ui-badge-full',
  partial: 'ui-badge ui-badge-partial',
  none: 'ui-badge ui-badge-none',
}

// One readable line: status as text badge (colour only reinforces it), score as plain text.
function ComplianceLine({
  status,
  statusLabel,
  score,
}: {
  status: ComplianceStatus
  statusLabel: string | null
  score: number | null
}) {
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className={status ? statusClassByValue[status] : 'ui-badge ui-badge-unknown'}>
        {status ? (statusLabel ?? 'Niveau inconnu') : 'Niveau inconnu'}
      </span>
      <span className="font-semibold [font-variant-numeric:tabular-nums]">Score {formatScore(score)}</span>
    </p>
  )
}

function readDomainGroupFromApiResult(result: { ok: boolean; payload: Record<string, unknown> }) {
  if (!result.ok) {
    throw new Error(
      typeof result.payload.error === 'string' ? result.payload.error : 'Chargement du domaine impossible.',
    )
  }

  const groups = Array.isArray(result.payload.groups) ? (result.payload.groups as unknown[]) : null
  if (!groups) {
    throw new Error('Réponse domaine invalide.')
  }

  const firstGroup = groups.map((item) => normalizeDomainGroup(item)).find((item) => item !== null) ?? null
  if (!firstGroup) {
    throw new Error('Aucun domaine multi-sites ne correspond à cette adresse.')
  }

  return firstGroup
}

function DomainGroupPage() {
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
  const routeApiUrl = slug ? `/api/domain-groups?slug=${encodeURIComponent(slug)}` : null
  const preloadedRouteResult = routeApiUrl ? readPreloadedRouteApi(routeApiUrl) : null
  const initialResolvedState = useMemo(() => {
    if (!routeApiUrl) {
      return {
        group: null,
        errorMessage: 'Lien de domaine invalide.',
        isLoading: false,
      }
    }

    if (!preloadedRouteResult) {
      return {
        group: null,
        errorMessage: null,
        isLoading: true,
      }
    }

    try {
      return {
        group: readDomainGroupFromApiResult(preloadedRouteResult),
        errorMessage: null,
        isLoading: false,
      }
    } catch (error) {
      return {
        group: null,
        errorMessage: error instanceof Error ? error.message : 'Erreur de chargement.',
        isLoading: false,
      }
    }
  }, [preloadedRouteResult, routeApiUrl])
  const [group, setGroup] = useState<DomainGroup | null>(initialResolvedState.group)
  const [errorMessage, setErrorMessage] = useState<string | null>(initialResolvedState.errorMessage)
  const [isLoading, setIsLoading] = useState(initialResolvedState.isLoading)

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

  const announcePolite = useCallback((message: string) => {
    setPoliteAnnouncement((current) => ({ id: current.id + 1, message }))
  }, [])

  useEffect(() => {
    if (!routeApiUrl || !slug) {
      setGroup(null)
      setIsLoading(false)
      setErrorMessage('Lien de domaine invalide.')
      return
    }
    const safeRouteApiUrl = routeApiUrl

    let cancelled = false

    async function loadGroup() {
      if (!initialResolvedState.group && !initialResolvedState.errorMessage) {
        setIsLoading(true)
      }
      setErrorMessage(null)

      try {
        const routeApiResult =
          readPreloadedRouteApi(safeRouteApiUrl) ?? (await preloadRouteApi(safeRouteApiUrl))
        const firstGroup = readDomainGroupFromApiResult(routeApiResult)

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

    if (initialResolvedState.group || initialResolvedState.errorMessage) {
      return
    }

    void loadGroup()

    return () => {
      cancelled = true
    }
  }, [announcePolite, initialResolvedState.errorMessage, initialResolvedState.group, routeApiUrl, slug])
  useHashTargetFocus(focusElement)

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
              '@type': 'BreadcrumbList',
              itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Accueil', item: createAbsoluteUrl('/') },
                {
                  '@type': 'ListItem',
                  position: 2,
                  name: group.registrableDomain,
                  item: createAbsoluteUrl(group.groupPath),
                },
              ],
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
      <nav className={skipLinksContainerClass} aria-label="Liens d’évitement">
        <a href="#contenu-domaine" className={skipLinkClass} onClick={(event) => handleSkipLinkClick(event, mainRef)}>
          Aller au contenu
        </a>
        <a href="#navigation-principale" className={skipLinkClass} onClick={(event) => handleSkipLinkClick(event, navigationRef)}>
          Aller à la navigation principale
        </a>
        <a href="#moteur-recherche-global" className={skipLinkClass}>
          Aller à la recherche annuaire
        </a>
        {!isLoading && group ? (
        <a href="#liste-domaine" className={skipLinkClass} onClick={(event) => handleSkipLinkClick(event, listRef)}>
          Aller à la liste des sous-sites
        </a>
        ) : null}
        <a href="#pied-page" className={skipLinkClass} onClick={(event) => handleSkipLinkClick(event, footerRef)}>
          Aller au pied de page
        </a>
      </nav>

      <div className="min-h-screen bg-white text-brand-ink">
        <SecondaryPageHeader
          title="Domaine multi-sites"
          navigationRef={navigationRef}
          description="Consultez toutes les fiches publiques rattachées à un même domaine racine."
        />
        {politeAnnouncement.message ? (
          <div className="ui-container mt-4">
            <p
              key={`domaine-annonce-${politeAnnouncement.id}`}
              role="status"
              aria-live="polite"
              aria-atomic="true"
              className="ui-callout text-sm"
            >
              {politeAnnouncement.message}
            </p>
          </div>
        ) : null}

        <main
          id="contenu-domaine"
          ref={mainRef}
          tabIndex={-1}
          className={`ui-container space-y-12 py-10 ${focusTargetScrollMarginClass} ${focusTargetClass}`}
          aria-busy={isLoading}
        >
          {isLoading ? (
            <div className="space-y-6">
              <p role="status" aria-live="polite" className="ui-muted">
                Chargement du domaine en cours...
              </p>
              <div aria-hidden="true" className="space-y-6">
                <div className="space-y-3">
                  <div className="ui-panel h-8 w-56 max-w-full p-0" />
                  <div className="ui-panel h-5 w-80 max-w-full p-0" />
                </div>
                <ul className="grid gap-6 md:grid-cols-2">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <li key={`domain-loading-card-${index}`} className="ui-card overflow-hidden">
                      <div className="site-thumbnail-frame h-32 border-b border-slate-200" />
                      <div className="space-y-3 p-5">
                        <div className="ui-panel h-6 w-64 max-w-full p-0" />
                        <div className="ui-panel h-5 w-full p-0" />
                        <div className="ui-panel h-5 w-48 max-w-full p-0" />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}

          {!isLoading && errorMessage ? (
            <p className="ui-alert" role="alert">
              {errorMessage}
            </p>
          ) : null}

          {!isLoading && group ? (
            <article className="space-y-12">
              <header className="ui-prose space-y-3">
                <p className="ui-muted text-sm font-semibold">Domaine racine</p>
                <h2 className="ui-section-title">{group.registrableDomain}</h2>
                <p>
                  {group.siteCount} fiche(s) publique(s). Dernière mise à jour : {formatDate(group.updatedAt)}.
                </p>
                <p className="ui-muted">{statusSummaryText}</p>
                {group.primaryEntry?.profilePath ? (
                  <p>
                    Site principal repéré :{' '}
                    <a href={group.primaryEntry.profilePath} className="font-semibold">
                      {group.primaryEntry.siteTitle}
                    </a>
                  </p>
                ) : null}
              </header>

              <section
                id="liste-domaine"
                ref={listRef}
                tabIndex={-1}
                className={`space-y-6 ${focusTargetScrollMarginClass} ${focusTargetClass}`}
                aria-labelledby="liste-domaine-titre"
              >
                <h3 id="liste-domaine-titre" className="ui-section-title">
                  Sous-sites déjà référencés
                </h3>
                <ul className="ui-card-grid">
                  {group.children.map((entry) => {
                    const profilePath =
                      entry.profilePath ?? resolveShowcaseProfilePath(entry.normalizedUrl, entry.slug)
                    const isPrimary =
                      group.primaryEntry?.normalizedUrl === entry.normalizedUrl

                    return (
                      <li key={entry.normalizedUrl} className="ui-card">
                          {/* Keeps the same subgrid rows in every card, labelled or not. */}
                          <div className="ui-muted ui-small pt-5 font-semibold">{isPrimary ? 'Site principal' : null}</div>
                          <h4 className="ui-h3">
                            <a href={profilePath}>{entry.siteTitle}</a>
                          </h4>
                          <p className="ui-muted ui-small wrap-anywhere">{entry.normalizedUrl}</p>
                          <ComplianceLine
                            status={entry.complianceStatus}
                            statusLabel={entry.complianceStatusLabel}
                            score={entry.complianceScore}
                          />
                          <dl className="ui-meta">
                            <div>
                              <dt>Catégorie :</dt>
                              <dd>{entry.category}</dd>
                            </div>
                            <div>
                              <dt>Mise à jour :</dt>
                              <dd>{formatDate(entry.updatedAt)}</dd>
                            </div>
                          </dl>

                          <ul className="ui-card-footer ui-actions">
                            <li>
                              <a
                                href={entry.normalizedUrl}
                                target="_blank"
                                rel="noopener external"
                                referrerPolicy="strict-origin-when-cross-origin"
                                className="ui-action-link"
                              >
                                Visiter le site (nouvel onglet)
                                <span className="sr-only"> : {entry.siteTitle}</span>
                              </a>
                            </li>
                            <li>
                              {entry.accessibilityPageUrl ? (
                                <a
                                  href={entry.accessibilityPageUrl}
                                  target="_blank"
                                  rel="noopener external"
                                  referrerPolicy="strict-origin-when-cross-origin"
                                  className="ui-action-link"
                                >
                                  Déclaration d’accessibilité (nouvel onglet)
                                  <span className="sr-only"> : {entry.siteTitle}</span>
                                </a>
                              ) : (
                                <span className="ui-muted inline-flex min-h-11 items-center text-sm">
                                  Déclaration non détectée
                                </span>
                              )}
                            </li>
                          </ul>
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
