import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent, RefObject } from 'react'
import { normalizeDomainContext } from './domainGroups'
import {
  focusElementWithScroll,
  focusTargetClass,
  focusTargetScrollMarginClass,
  useHashTargetFocus,
} from './hashNavigation'
import { preloadRouteApi, readPreloadedRouteApi, type RouteApiResult } from './routeData'
import { applySeo, createAbsoluteUrl } from './seo'
import { readSiteSlugFromPath, resolveShowcaseProfilePath } from './siteProfiles'
import SecondaryPageHeader from './SecondaryPageHeader'
import SiteFooter from './SiteFooter'

type ComplianceStatus = 'full' | 'partial' | 'none' | null

type ShowcaseEntry = {
  normalizedUrl: string
  siteHost?: string | null
  siteOrigin?: string | null
  registrableDomain?: string | null
  slug?: string
  profilePath?: string
  domainGroupSlug?: string | null
  domainGroupPath?: string | null
  domainContext?: ReturnType<typeof normalizeDomainContext>
  siteTitle: string
  thumbnailUrl: string | null
  accessibilityPageUrl: string | null
  hasAccessibilityPage?: boolean
  complianceStatus: ComplianceStatus
  complianceStatusLabel: string | null
  complianceScore: number | null
  rgaaBaseline: '4.1' | '5.0-ready'
  updatedAt: string
  category: string
}

const MAX_RELATED_ENTRIES = 6
const MAX_RELATED_FETCH_LIMIT = 80
const PROFILE_API_LINK_ID = 'app-profile-api-link'
const PROFILE_UP_LINK_ID = 'app-profile-up-link'

const statusClassByValue: Record<Exclude<ComplianceStatus, null>, string> = {
  full: 'ui-badge ui-badge-full',
  partial: 'ui-badge ui-badge-partial',
  none: 'ui-badge ui-badge-none',
}

const focusRingClass =
  'focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-brand-focus'
const skipLinksContainerClass =
  'fixed start-2 top-2 z-60 flex max-w-[calc(100vw-1rem)] -translate-y-[120%] flex-col items-start gap-2 transition-transform duration-150 motion-reduce:transition-none focus-within:translate-y-0 hover:translate-y-0 sm:start-4 sm:top-4 sm:max-w-none'
const skipLinkClass = `inline-flex min-h-11 w-full max-w-full items-center justify-start rounded-lg border border-slate-900 bg-slate-950 px-3 py-2 text-left text-slate-50 underline decoration-2 underline-offset-2 shadow-lg whitespace-normal break-words dark:border-slate-50 dark:bg-slate-50 dark:text-slate-950 sm:w-auto ${focusRingClass}`

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

function formatRgaaBaseline(value: ShowcaseEntry['rgaaBaseline']) {
  return value === '5.0-ready' ? 'RGAA 5.0 prêt' : 'RGAA 4.1'
}

function readSafeSlug(value: unknown) {
  if (typeof value !== 'string') {
    return null
  }

  return /^[a-z0-9-]{4,120}$/.test(value) ? value : null
}

function normalizeRgaaBaseline(value: unknown): ShowcaseEntry['rgaaBaseline'] {
  return value === '5.0-ready' ? '5.0-ready' : '4.1'
}

function readSiteHost(normalizedUrl: string) {
  try {
    return new URL(normalizedUrl).hostname.replace(/^www\./i, '')
  } catch {
    return null
  }
}

function normalizeShowcaseEntry(entry: ShowcaseEntry): ShowcaseEntry {
  const safeSlug = readSafeSlug(entry.slug)
  return {
    ...entry,
    slug: safeSlug ?? undefined,
    profilePath: resolveShowcaseProfilePath(entry.normalizedUrl, safeSlug),
    rgaaBaseline: normalizeRgaaBaseline(entry.rgaaBaseline),
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

function readCanonicalRedirectPath(payload: Record<string, unknown>) {
  const rawValue = payload.redirectPath
  if (typeof rawValue !== 'string' || !rawValue.trim()) {
    return null
  }

  const trimmed = rawValue.trim()
  if (!/^\/site\/[a-z0-9-]{4,120}$/.test(trimmed)) {
    return null
  }

  return trimmed
}

function upsertHeadLink(id: string, attributes: Record<string, string>) {
  let element = document.getElementById(id) as HTMLLinkElement | null
  if (!element) {
    element = document.createElement('link')
    element.id = id
    document.head.append(element)
  }

  for (const [key, value] of Object.entries(attributes)) {
    element.setAttribute(key, value)
  }
}

function escapeHtmlAttribute(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function readSiteProfileStateFromApiResult(
  result: RouteApiResult,
  siteSlug: string,
): {
  entry: ShowcaseEntry | null
  errorMessage: string | null
  redirectPath: string | null
} {
  const redirectPath = readCanonicalRedirectPath(result.payload)

  if (!result.ok) {
    throw new Error(
      typeof result.payload.error === 'string' ? result.payload.error : 'Chargement de la fiche impossible.',
    )
  }

  if (redirectPath && redirectPath !== `/site/${siteSlug}`) {
    return {
      entry: null,
      errorMessage: null,
      redirectPath,
    }
  }

  const responseEntries = Array.isArray(result.payload.entries)
    ? (result.payload.entries as unknown[])
    : Array.isArray(result.payload)
      ? result.payload
      : null

  if (!responseEntries) {
    throw new Error('Réponse annuaire invalide.')
  }

  const firstEntry = responseEntries.find((candidate) => isShowcaseEntry(candidate))
  if (!firstEntry) {
    throw new Error('Aucune fiche ne correspond à cette adresse.')
  }

  return {
    entry: normalizeShowcaseEntry(firstEntry),
    errorMessage: null,
    redirectPath: null,
  }
}

function SiteProfilePage() {
  const [relatedEntries, setRelatedEntries] = useState<ShowcaseEntry[]>([])
  const [isLoadingRelated, setIsLoadingRelated] = useState(false)
  const [relatedErrorMessage, setRelatedErrorMessage] = useState<string | null>(null)
  const [copyMessage, setCopyMessage] = useState('')
  const [politeAnnouncement, setPoliteAnnouncement] = useState({ id: 0, message: '' })
  const mainRef = useRef<HTMLElement | null>(null)
  const navigationRef = useRef<HTMLElement | null>(null)
  const backlinkSectionRef = useRef<HTMLElement | null>(null)
  const relatedSectionRef = useRef<HTMLElement | null>(null)
  const footerRef = useRef<HTMLElement | null>(null)
  const sameDomainSectionRef = useRef<HTMLElement | null>(null)
  const slug =
    typeof window !== 'undefined'
      ? readSiteSlugFromPath(window.location.pathname)
      : null
  const requestedPath =
    typeof window !== 'undefined'
      ? window.location.pathname
      : slug
        ? `/site/${slug}`
        : '/site'
  const routeApiUrl = slug ? `/api/showcase?slug=${encodeURIComponent(slug)}&limit=500` : null
  const preloadedRouteResult = routeApiUrl ? readPreloadedRouteApi(routeApiUrl) : null
  const initialResolvedState = useMemo(() => {
    if (!slug || !routeApiUrl) {
      return {
        entry: null,
        errorMessage: 'Lien de fiche invalide.',
        isLoading: false,
        redirectPath: null,
      }
    }

    if (!preloadedRouteResult) {
      return {
        entry: null,
        errorMessage: null,
        isLoading: true,
        redirectPath: null,
      }
    }

    try {
      const resolvedState = readSiteProfileStateFromApiResult(preloadedRouteResult, slug)
      return {
        ...resolvedState,
        isLoading: resolvedState.redirectPath ? true : false,
      }
    } catch (error) {
      return {
        entry: null,
        errorMessage: error instanceof Error ? error.message : 'Erreur de chargement.',
        isLoading: false,
        redirectPath: null,
      }
    }
  }, [preloadedRouteResult, routeApiUrl, slug])
  const [entry, setEntry] = useState<ShowcaseEntry | null>(initialResolvedState.entry)
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
  useHashTargetFocus(focusElement)

  const resolvedSlug = useMemo(() => {
    if (entry) {
      return readSafeSlug(entry.slug) ?? slug
    }

    return slug
  }, [entry, slug])
  const profilePath = useMemo(() => {
    if (!entry) {
      return slug ? `/site/${slug}` : '/site'
    }

    return resolveShowcaseProfilePath(entry.normalizedUrl, resolvedSlug)
  }, [entry, resolvedSlug, slug])
  const profileUrl = createAbsoluteUrl(profilePath)
  const profileApiUrl = useMemo(() => {
    if (!resolvedSlug) {
      return createAbsoluteUrl('/api/showcase')
    }

    return `${createAbsoluteUrl('/api/showcase')}?slug=${encodeURIComponent(resolvedSlug)}`
  }, [resolvedSlug])
  const backlinkBadgeUrl = createAbsoluteUrl('/badge-backlink-annuaire-rgaa.svg')
  const backlinkSiteTitle = entry?.siteTitle ?? 'ce site'
  // Label in Name (WCAG 2.5.3) on adopters' sites: the link name is its visible text, or the
  // badge alt starting with the text drawn in the badge.
  const backlinkBadgeAlt = escapeHtmlAttribute(
    `Référencé sur Annuaire RGAA : voir la fiche de ${backlinkSiteTitle}`,
  )
  const backlinkTextSnippet = `<a href="${profileUrl}">Référencé sur Annuaire RGAA</a>`
  const backlinkBadgeSnippet = `<a href="${profileUrl}"><img src="${backlinkBadgeUrl}" alt="${backlinkBadgeAlt}" width="252" height="64" loading="lazy" decoding="async" /></a>`

  const announcePolite = useCallback((message: string) => {
    setPoliteAnnouncement((previous) => ({ id: previous.id + 1, message }))
  }, [])

  useEffect(() => {
    if (entry) {
      const websiteId = `${createAbsoluteUrl('/')}#website`
      const organizationId = `${createAbsoluteUrl('/')}#organization`
      const dataCatalogId = `${createAbsoluteUrl('/')}#data-catalog`
      const referencedSiteId = `${profileUrl}#referenced-site`
      const datasetEntryId = `${profileUrl}#dataset-entry`
      const accessibilityStatementId = `${profileUrl}#accessibility-statement`
      const siteHost = entry.siteHost ?? readSiteHost(entry.normalizedUrl)
      const relatedItemElements = relatedEntries.map((candidate, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: candidate.siteTitle,
        item: createAbsoluteUrl(resolveShowcaseProfilePath(candidate.normalizedUrl, candidate.slug)),
      }))

      applySeo({
        title: `${entry.siteTitle} | Fiche annuaire RGAA`,
        description: `${entry.siteTitle} est référencé sur www.annuaire-rgaa.fr avec catégorie, niveau détecté, score et liens utiles d’accessibilité.`,
        path: profilePath,
        ogType: 'website',
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
                '@id': websiteId,
                url: createAbsoluteUrl('/'),
                name: 'Annuaire RGAA',
              },
              mainEntity: {
                '@id': referencedSiteId,
              },
              about: {
                '@id': datasetEntryId,
              },
            },
            {
              '@type': 'WebSite',
              '@id': referencedSiteId,
              name: entry.siteTitle,
              url: entry.normalizedUrl,
              identifier: entry.slug,
              mainEntityOfPage: {
                '@id': `${profileUrl}#webpage`,
              },
              subjectOf: entry.accessibilityPageUrl
                ? {
                    '@id': accessibilityStatementId,
                  }
                : undefined,
            },
            ...(entry.accessibilityPageUrl
              ? [
                  {
                    '@type': 'WebPage',
                    '@id': accessibilityStatementId,
                    url: entry.accessibilityPageUrl,
                    name: `Déclaration d’accessibilité de ${entry.siteTitle}`,
                    isPartOf: {
                      '@id': referencedSiteId,
                    },
                  },
                ]
              : []),
            {
              '@type': 'Dataset',
              '@id': datasetEntryId,
              name: `Données publiques de la fiche ${entry.siteTitle}`,
              description:
                'Extrait machine-readable de la fiche annuaire: catégorie, score détecté, niveau et URL de référence.',
              inLanguage: 'fr-FR',
              url: profileApiUrl,
              isAccessibleForFree: true,
              license: 'https://opensource.org/license/mit/',
              includedInDataCatalog: {
                '@id': dataCatalogId,
              },
              dateModified: entry.updatedAt,
              about: {
                '@id': referencedSiteId,
              },
              creator: {
                '@id': organizationId,
              },
              measurementTechnique: [
                'Analyse automatisée de métadonnées publiques',
                'Détection de déclaration d’accessibilité',
                'Revue éditoriale de la fiche publiée',
              ],
              variableMeasured: [
                { '@type': 'PropertyValue', name: 'Nom du site référencé', value: entry.siteTitle },
                { '@type': 'PropertyValue', name: 'Hôte du site', value: siteHost ?? entry.normalizedUrl },
                { '@type': 'PropertyValue', name: 'Catégorie éditoriale', value: entry.category },
                {
                  '@type': 'PropertyValue',
                  name: 'Statut de conformité RGAA détecté',
                  value: entry.complianceStatusLabel ?? 'Inconnu',
                },
                {
                  '@type': 'PropertyValue',
                  name: 'Score de conformité détecté',
                  value: entry.complianceScore ?? 'N/A',
                },
                { '@type': 'PropertyValue', name: 'Baseline RGAA', value: entry.rgaaBaseline },
              ],
              keywords: [
                'RGAA',
                'accessibilité numérique',
                entry.category,
                siteHost ?? entry.siteTitle,
              ],
              distribution: [
                {
                  '@type': 'DataDownload',
                  contentUrl: profileApiUrl,
                  encodingFormat: 'application/json',
                },
              ],
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
            ...(relatedItemElements.length > 0
              ? [
                  {
                    '@type': 'ItemList',
                    '@id': `${profileUrl}#related-profiles`,
                    name: 'Fiches associées',
                    numberOfItems: relatedItemElements.length,
                    itemListElement: relatedItemElements,
                  },
                ]
              : []),
          ],
        },
      })
      return
    }

    if (isLoading && slug) {
      applySeo({
        title: 'Fiche annuaire | Annuaire RGAA',
        description:
          'Consultez les informations publiques d’un site référencé dans l’annuaire RGAA et ses liens utiles d’accessibilité.',
        path: requestedPath,
        ogType: 'website',
        structuredData: {
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          '@id': `${createAbsoluteUrl(requestedPath)}#webpage`,
          url: createAbsoluteUrl(requestedPath),
          name: 'Fiche annuaire | Annuaire RGAA',
          inLanguage: 'fr-FR',
          description:
            'Fiche publique d’un site référencé dans l’annuaire RGAA avec informations de conformité et liens utiles.',
        },
      })
      return
    }

    applySeo({
      title: 'Fiche annuaire introuvable | Annuaire RGAA',
      description:
        'La fiche demandée n’a pas été trouvée dans l’annuaire RGAA. Retournez à l’accueil pour parcourir les sites référencés.',
      path: requestedPath,
      robots: 'noindex,follow',
      structuredData: null,
    })
  }, [entry, isLoading, profileApiUrl, profilePath, profileUrl, relatedEntries, requestedPath, slug])

  useEffect(() => {
    if (!resolvedSlug) {
      document.getElementById(PROFILE_API_LINK_ID)?.remove()
      document.getElementById(PROFILE_UP_LINK_ID)?.remove()
      return
    }

    upsertHeadLink(PROFILE_API_LINK_ID, {
      rel: 'alternate',
      type: 'application/json',
      href: profileApiUrl,
    })
    upsertHeadLink(PROFILE_UP_LINK_ID, {
      rel: 'up',
      href: createAbsoluteUrl('/'),
    })

    return () => {
      document.getElementById(PROFILE_API_LINK_ID)?.remove()
      document.getElementById(PROFILE_UP_LINK_ID)?.remove()
    }
  }, [profileApiUrl, resolvedSlug])

  useEffect(() => {
    if (!slug || !routeApiUrl) {
      setEntry(null)
      setIsLoading(false)
      setErrorMessage('Lien de fiche invalide.')
      return
    }
    const siteSlug = slug
    const safeRouteApiUrl = routeApiUrl

    let cancelled = false

    async function loadEntry() {
      if (!initialResolvedState.entry && !initialResolvedState.errorMessage) {
        setIsLoading(true)
      }
      setErrorMessage(null)

      try {
        const routeApiResult =
          readPreloadedRouteApi(safeRouteApiUrl) ?? (await preloadRouteApi(safeRouteApiUrl))
        const resolvedState = readSiteProfileStateFromApiResult(routeApiResult, siteSlug)
        const redirectPath = resolvedState.redirectPath

        if (redirectPath && redirectPath !== `/site/${siteSlug}`) {
          if (!cancelled) {
            announcePolite('Cette fiche a été déplacée. Redirection vers la version à jour.')
            window.location.replace(redirectPath)
          }
          return
        }

        if (!cancelled) {
          setEntry(resolvedState.entry)
          if (resolvedState.entry) {
            announcePolite(`Chargement terminé. Fiche ouverte: ${resolvedState.entry.siteTitle}.`)
          }
        }
      } catch (error) {
        if (!cancelled) {
          const localizedMessage = error instanceof Error ? error.message : 'Erreur de chargement.'
          setEntry(null)
          setErrorMessage(localizedMessage)
          announcePolite('Chargement terminé avec erreur sur la fiche demandée.')
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    if (initialResolvedState.entry || initialResolvedState.errorMessage) {
      return
    }

    void loadEntry()

    return () => {
      cancelled = true
    }
  }, [announcePolite, initialResolvedState.entry, initialResolvedState.errorMessage, routeApiUrl, slug])

  useEffect(() => {
    if (!entry) {
      setRelatedEntries([])
      setRelatedErrorMessage(null)
      setIsLoadingRelated(false)
      return
    }

    const activeEntry = entry
    let cancelled = false

    async function loadRelatedEntries() {
      setIsLoadingRelated(true)
      setRelatedErrorMessage(null)

      try {
        const response = await fetch(
          `/api/showcase?category=${encodeURIComponent(activeEntry.category)}&limit=${MAX_RELATED_FETCH_LIMIT}`,
        )
        const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''
        const rawBody = await response.text()
        let payload: Record<string, unknown>

        if (!rawBody.trim()) {
          payload = {}
        } else if (contentType.includes('application/json')) {
          try {
            payload = JSON.parse(rawBody) as Record<string, unknown>
          } catch {
            payload = { error: 'Réponse JSON invalide du serveur.' }
          }
        } else {
          const compactBody = rawBody.trim().replace(/\s+/g, ' ')
          payload = /<!doctype html|<html[\s>]/i.test(compactBody)
            ? {
                error:
                  'Réponse HTML reçue à la place de JSON API. Vérifiez le routage des endpoints /api/*.',
              }
            : { error: compactBody.slice(0, 220) || 'Réponse serveur non JSON.' }
        }

        if (!response.ok) {
          throw new Error(typeof payload.error === 'string' ? payload.error : 'Chargement des fiches associées impossible.')
        }

        const responseEntries = Array.isArray(payload.entries)
          ? payload.entries
          : Array.isArray(payload)
            ? payload
            : null

        if (!responseEntries) {
          throw new Error('Réponse annuaire invalide.')
        }

        const candidates = responseEntries
          .filter((candidate) => isShowcaseEntry(candidate))
          .map((candidate) => normalizeShowcaseEntry(candidate))
          .filter((candidate) => candidate.normalizedUrl !== activeEntry.normalizedUrl)
          .slice(0, MAX_RELATED_ENTRIES)

        if (!cancelled) {
          setRelatedEntries(candidates)
          announcePolite(
            candidates.length > 0
              ? `${candidates.length} fiche${candidates.length > 1 ? 's' : ''} associée${candidates.length > 1 ? 's' : ''} chargée${candidates.length > 1 ? 's' : ''}.`
              : 'Chargement terminé. Aucune fiche associée disponible.',
          )
        }
      } catch (error) {
        if (!cancelled) {
          setRelatedEntries([])
          setRelatedErrorMessage(
            error instanceof Error ? error.message : 'Chargement des fiches associées impossible.',
          )
          announcePolite('Chargement des fiches associées terminé avec erreur.')
        }
      } finally {
        if (!cancelled) {
          setIsLoadingRelated(false)
        }
      }
    }

    void loadRelatedEntries()

    return () => {
      cancelled = true
    }
  }, [announcePolite, entry])

  const handleCopyBacklink = useCallback(async (snippet: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(snippet)
      setCopyMessage(successMessage)
    } catch {
      setCopyMessage('Copie automatique indisponible. Sélectionnez puis copiez le code manuellement.')
    }
  }, [])

  return (
    <>
      <nav
        className={skipLinksContainerClass}
        aria-label="Liens d’évitement"
      >
        <a href="#contenu-fiche" className={skipLinkClass} onClick={(event) => handleSkipLinkClick(event, mainRef)}>
          Aller au contenu
        </a>
        <a href="#navigation-principale" className={skipLinkClass} onClick={(event) => handleSkipLinkClick(event, navigationRef)}>
          Aller à la navigation principale
        </a>
        <a href="#moteur-recherche-global" className={skipLinkClass}>
          Aller à la recherche annuaire
        </a>
        {/* RGAA 12.7: only link to sections that are rendered (they depend on the loaded entry). */}
        {!isLoading && entry ? (
          <a href="#backlink-fiche" className={skipLinkClass} onClick={(event) => handleSkipLinkClick(event, backlinkSectionRef)}>
            Aller au lien retour
          </a>
        ) : null}
        {entry?.domainContext && entry.domainContext.siteCount > 1 ? (
          <a
            href="#meme-domaine"
            className={skipLinkClass}
            onClick={(event) => handleSkipLinkClick(event, sameDomainSectionRef)}
          >
            Aller aux sous-sites du même domaine
          </a>
        ) : null}
        {!isLoading && entry ? (
          <a href="#fiches-associees" className={skipLinkClass} onClick={(event) => handleSkipLinkClick(event, relatedSectionRef)}>
            Aller aux fiches associées
          </a>
        ) : null}
        <a href="#pied-page" className={skipLinkClass} onClick={(event) => handleSkipLinkClick(event, footerRef)}>
          Aller au pied de page
        </a>
      </nav>

      <div className="min-h-screen bg-white text-brand-ink">
        <SecondaryPageHeader
          title="Fiche annuaire"
          navigationRef={navigationRef}
          description="Consultez les informations publiques d’un site référencé et ses liens utiles d’accessibilité."
        />
        {politeAnnouncement.message ? (
          <div className="ui-container mt-4">
            <p
              key={`fiche-annonce-${politeAnnouncement.id}`}
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
          id="contenu-fiche"
          ref={mainRef}
          tabIndex={-1}
          className={`ui-container space-y-12 py-10 ${focusTargetScrollMarginClass} ${focusTargetClass}`}
          aria-busy={isLoading}
        >
          {isLoading && <p role="status" aria-live="polite">Chargement de la fiche en cours...</p>}

          {!isLoading && errorMessage && (
            <p className="ui-alert" role="alert">
              {errorMessage}
            </p>
          )}

          {!isLoading && entry && (
            <article className="space-y-12">
              <div className="space-y-4">
                <h2 className="ui-section-title wrap-anywhere">{entry.siteTitle}</h2>
                <p className="ui-muted wrap-anywhere text-sm">{entry.normalizedUrl}</p>
                <dl className="ui-dl ui-prose">
                  <div>
                    <dt>Niveau détecté :</dt>
                    <dd>
                      <span
                        className={
                          entry.complianceStatus
                            ? statusClassByValue[entry.complianceStatus]
                            : 'ui-badge ui-badge-unknown'
                        }
                      >
                        {entry.complianceStatusLabel ?? 'N/A'}
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt>Score détecté :</dt>
                    <dd className="[font-variant-numeric:tabular-nums]">{formatScore(entry.complianceScore)}</dd>
                  </div>
                  <div>
                    <dt>Référentiel déclaré :</dt>
                    <dd>{formatRgaaBaseline(entry.rgaaBaseline)}</dd>
                  </div>
                  <div>
                    <dt>Catégorie :</dt>
                    <dd>{entry.category}</dd>
                  </div>
                  <div>
                    <dt>Dernière mise à jour :</dt>
                    <dd>{formatDate(entry.updatedAt)}</dd>
                  </div>
                </dl>

                <ul className="ui-actions border-t border-slate-200 pt-2">
                  <li>
                    <a
                      href={entry.normalizedUrl}
                      target="_blank"
                      rel="noopener external"
                      referrerPolicy="strict-origin-when-cross-origin"
                      className="ui-action-link"
                    >
                      Visiter le site d’origine (nouvel onglet)
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
                      </a>
                    ) : (
                      <span className="ui-muted inline-flex min-h-11 items-center">
                        Déclaration non détectée
                      </span>
                    )}
                  </li>
                </ul>
              </div>

              {entry.domainContext && entry.domainContext.siteCount > 1 ? (
                <section
                  id="meme-domaine"
                  ref={sameDomainSectionRef}
                  tabIndex={-1}
                  className={`space-y-3 ${focusTargetScrollMarginClass} ${focusTargetClass}`}
                  aria-labelledby="meme-domaine-titre"
                >
                  <h3 id="meme-domaine-titre" className="ui-h3">
                    Autres sous-sites du même domaine
                  </h3>
                  <p className="ui-prose">
                    Le domaine <strong>{entry.domainContext.registrableDomain}</strong> compte{' '}
                    <strong>{entry.domainContext.siteCount}</strong> fiche(s) publique(s).
                  </p>
                  {entry.domainContext.groupPath ? (
                    <p>
                      <a href={entry.domainContext.groupPath} className="ui-action-link">
                        Ouvrir la page domaine
                      </a>
                    </p>
                  ) : null}
                  {entry.domainContext.siblings.length > 0 ? (
                    <ul className="divide-y divide-slate-200 border-y border-slate-200">
                      {entry.domainContext.siblings.map((candidate) => (
                        <li key={candidate.normalizedUrl} className="min-w-0 py-2">
                          <a
                            href={
                              candidate.profilePath ??
                              resolveShowcaseProfilePath(candidate.normalizedUrl, candidate.slug)
                            }
                            className="ui-action-link whitespace-normal wrap-anywhere"
                          >
                            {candidate.siteTitle}
                          </a>
                          <p className="ui-muted wrap-anywhere text-sm">{candidate.normalizedUrl}</p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="ui-muted">
                      Aucune autre fiche publique n’est listée pour ce domaine pour le moment.
                    </p>
                  )}
                </section>
              ) : null}

              <section
                id="backlink-fiche"
                ref={backlinkSectionRef}
                tabIndex={-1}
                className={`space-y-3 ${focusTargetScrollMarginClass} ${focusTargetClass}`}
                aria-labelledby="backlink-fiche-titre"
              >
                <h3 id="backlink-fiche-titre" className="ui-h3">
                  Lien retour recommandé
                </h3>
                <p className="ui-prose">
                  Pour faciliter la découverte mutuelle, vous pouvez publier ce lien vers votre fiche annuaire.
                </p>

                <div className="ui-panel space-y-2">
                  <p className="font-semibold">Aperçu en texte stylé</p>
                  <a href={profileUrl} className="inline-flex min-h-11 max-w-full flex-col text-start">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em]">Annuaire RGAA</span>
                    <span className="text-base font-bold">Référencé sur l’annuaire</span>
                    <span className="text-sm">Voir la fiche de {backlinkSiteTitle}</span>
                  </a>
                  <p className="ui-muted text-sm">
                    Le code HTML du badge image reste disponible en option pour les intégrations qui souhaitent
                    reprendre le visuel de marque.
                  </p>
                </div>

                <h4 id="backlink-code-badge-label" className="ui-h4 pt-3">
                  Code HTML du badge (recommandé)
                </h4>
                <div role="region" aria-labelledby="backlink-code-badge-label" className="ui-panel">
                  <pre className="font-mono text-sm whitespace-pre-wrap wrap-anywhere">
                    <code>{backlinkBadgeSnippet}</code>
                  </pre>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    void handleCopyBacklink(
                      backlinkBadgeSnippet,
                      'Code du badge copié. Vous pouvez le coller dans votre site.',
                    )
                  }}
                  className="ui-button ui-button-primary"
                >
                  Copier le code du badge
                </button>

                <h4 id="backlink-code-text-label" className="ui-h4 pt-3">
                  Alternative texte seule
                </h4>
                <div role="region" aria-labelledby="backlink-code-text-label" className="ui-panel">
                  <pre className="font-mono text-sm whitespace-pre-wrap wrap-anywhere">
                    <code>{backlinkTextSnippet}</code>
                  </pre>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    void handleCopyBacklink(
                      backlinkTextSnippet,
                      'Code texte copié. Vous pouvez le coller dans votre site.',
                    )
                  }}
                  className="ui-button ui-button-secondary"
                >
                  Copier le code texte
                </button>
                {copyMessage && (
                  <p className="text-sm" role="status" aria-live="polite">
                    {copyMessage}
                  </p>
                )}
              </section>

              <section
                id="fiches-associees"
                ref={relatedSectionRef}
                tabIndex={-1}
                className={`space-y-3 ${focusTargetScrollMarginClass} ${focusTargetClass}`}
                aria-labelledby="fiches-associees-titre"
                aria-busy={isLoadingRelated}
              >
                <h3 id="fiches-associees-titre" className="ui-h3">
                  Fiches associées
                </h3>
                <p className="ui-prose">
                  Autres sites référencés dans la catégorie <strong>{entry.category}</strong>.
                </p>
                {isLoadingRelated && (
                  <p className="ui-muted text-sm" role="status" aria-live="polite">
                    Chargement des fiches associées...
                  </p>
                )}
                {!isLoadingRelated && relatedErrorMessage && (
                  <p className="rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900" role="status" aria-live="polite">
                    {relatedErrorMessage}
                  </p>
                )}
                {!isLoadingRelated && !relatedErrorMessage && relatedEntries.length === 0 && (
                  <p className="ui-muted">
                    Aucune autre fiche de cette catégorie n’est disponible pour le moment.
                  </p>
                )}
                {relatedEntries.length > 0 && (
                  <ul className="divide-y divide-slate-200 border-y border-slate-200">
                    {relatedEntries.map((candidate) => {
                      const candidateProfilePath = resolveShowcaseProfilePath(
                        candidate.normalizedUrl,
                        candidate.slug,
                      )
                      return (
                        <li key={candidate.normalizedUrl} className="min-w-0 py-2">
                          <a
                            href={candidateProfilePath}
                            className="ui-action-link whitespace-normal wrap-anywhere"
                          >
                            {candidate.siteTitle}
                          </a>
                          <p className="ui-muted wrap-anywhere text-sm">{candidate.normalizedUrl}</p>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </section>
            </article>
          )}
        </main>

        <SiteFooter id="pied-page" footerRef={footerRef} />
      </div>
    </>
  )
}

export default SiteProfilePage
