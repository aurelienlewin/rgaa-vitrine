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
  const backlinkLinkAriaLabel = escapeHtmlAttribute(
    `Voir la fiche de ${backlinkSiteTitle} sur Annuaire RGAA`,
  )
  const backlinkBadgeAlt = escapeHtmlAttribute(
    `Badge Annuaire RGAA : voir la fiche de ${backlinkSiteTitle}`,
  )
  const backlinkTextSnippet = `<a href="${profileUrl}" aria-label="${backlinkLinkAriaLabel}">Référencé sur Annuaire RGAA</a>`
  const backlinkBadgeSnippet = `<a href="${profileUrl}" aria-label="${backlinkLinkAriaLabel}"><img src="${backlinkBadgeUrl}" alt="${backlinkBadgeAlt}" width="252" height="64" loading="lazy" decoding="async" /></a>`

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
        description: `${entry.siteTitle} est référencé sur annuaire-rgaa.fr avec catégorie, niveau détecté, score et liens utiles d’accessibilité.`,
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
      title: 'Données publiques de la fiche',
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
      <div
        className={skipLinksContainerClass}
        aria-label="Liens d’évitement"
      >
        <a href="#contenu-fiche" className={skipLinkClass} onClick={(event) => handleSkipLinkClick(event, mainRef)}>
          Aller au contenu
        </a>
        <a href="#navigation-principale" className={skipLinkClass} onClick={(event) => handleSkipLinkClick(event, navigationRef)}>
          Aller à la navigation principale
        </a>
        <a href="/#moteur-recherche-global" className={skipLinkClass}>
          Aller à la recherche annuaire
        </a>
        <a href="#backlink-fiche" className={skipLinkClass} onClick={(event) => handleSkipLinkClick(event, backlinkSectionRef)}>
          Aller au lien retour
        </a>
        {entry?.domainContext && entry.domainContext.siteCount > 1 ? (
          <a
            href="#meme-domaine"
            className={skipLinkClass}
            onClick={(event) => handleSkipLinkClick(event, sameDomainSectionRef)}
          >
            Aller aux sous-sites du même domaine
          </a>
        ) : null}
        <a href="#fiches-associees" className={skipLinkClass} onClick={(event) => handleSkipLinkClick(event, relatedSectionRef)}>
          Aller aux fiches associées
        </a>
        <a href="#pied-page" className={skipLinkClass} onClick={(event) => handleSkipLinkClick(event, footerRef)}>
          Aller au pied de page
        </a>
      </div>

      <div className="min-h-screen bg-brand-surface text-brand-ink">
        {politeAnnouncement.message ? (
          <p
            key={`fiche-annonce-${politeAnnouncement.id}`}
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="mx-auto mt-4 max-w-5xl rounded-xl border border-sky-300 dark:border-sky-700 bg-sky-50 dark:bg-sky-950 px-4 py-3 text-sm text-sky-900 dark:text-sky-100"
          >
            {politeAnnouncement.message}
          </p>
        ) : null}
        <SecondaryPageHeader
          title="Fiche annuaire"
          navigationRef={navigationRef}
          description="Consultez les informations publiques d’un site référencé et ses liens utiles d’accessibilité."
        />

        <main
          id="contenu-fiche"
          ref={mainRef}
          tabIndex={-1}
          className={`mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 ${focusTargetScrollMarginClass} ${focusTargetClass}`}
          aria-busy={isLoading}
        >
          {isLoading && <p role="status" aria-live="polite">Chargement de la fiche en cours...</p>}

          {!isLoading && errorMessage && (
            <p className="rounded-xl border border-rose-300 dark:border-rose-700 bg-rose-50 dark:bg-rose-950 p-4 text-rose-900 dark:text-rose-100" role="alert">
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
              <p className="mt-1 text-slate-700 dark:text-slate-300">
                Référentiel déclaré: <strong>{formatRgaaBaseline(entry.rgaaBaseline)}</strong>
              </p>

              <div className="mt-4 flex flex-wrap gap-3">
                <a
                  href={entry.normalizedUrl}
                  target="_blank"
                  rel="noopener external"
                  referrerPolicy="strict-origin-when-cross-origin"
                  className={`inline-flex min-h-11 items-center rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-2 font-semibold text-slate-900 dark:text-slate-50 hover:bg-slate-100 dark:hover:bg-slate-800 ${focusRingClass}`}
                >
                  Visiter le site d’origine (nouvel onglet)
                </a>
                {entry.accessibilityPageUrl ? (
                  <a
                    href={entry.accessibilityPageUrl}
                    target="_blank"
                    rel="noopener external"
                    referrerPolicy="strict-origin-when-cross-origin"
                    className={`inline-flex min-h-11 items-center rounded-xl border border-emerald-700 dark:border-emerald-300 bg-emerald-50 dark:bg-emerald-950 px-4 py-2 font-semibold text-emerald-900 dark:text-emerald-100 hover:bg-emerald-100 dark:hover:bg-emerald-900 ${focusRingClass}`}
                  >
                    Déclaration d’accessibilité (nouvel onglet)
                  </a>
                ) : (
                  <span className="inline-flex min-h-11 items-center rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 px-4 py-2 text-slate-700 dark:text-slate-300">
                    Déclaration non détectée
                  </span>
                )}
              </div>

              {entry.domainContext && entry.domainContext.siteCount > 1 ? (
                <section
                  id="meme-domaine"
                  ref={sameDomainSectionRef}
                  tabIndex={-1}
                  className={`mt-6 rounded-xl border border-sky-300 dark:border-sky-700 bg-sky-50 dark:bg-sky-950 p-4 ${focusTargetScrollMarginClass} ${focusTargetClass}`}
                  aria-labelledby="meme-domaine-titre"
                >
                  <h3 id="meme-domaine-titre" className="text-lg font-semibold text-sky-900 dark:text-sky-100">
                    Autres sous-sites du même domaine
                  </h3>
                  <p className="mt-2 text-sm text-sky-900 dark:text-sky-100">
                    Le domaine <strong>{entry.domainContext.registrableDomain}</strong> compte{' '}
                    <strong>{entry.domainContext.siteCount}</strong> fiche(s) publique(s).
                  </p>
                  {entry.domainContext.groupPath ? (
                    <p className="mt-2 text-sm text-sky-900 dark:text-sky-100">
                      <a
                        href={entry.domainContext.groupPath}
                        className={`font-semibold underline ${focusRingClass}`}
                      >
                        Ouvrir la page domaine
                      </a>
                    </p>
                  ) : null}
                  {entry.domainContext.siblings.length > 0 ? (
                    <ul className="mt-3 grid gap-3">
                      {entry.domainContext.siblings.map((candidate) => (
                        <li
                          key={candidate.normalizedUrl}
                          className="min-w-0 rounded-xl border border-sky-200 dark:border-sky-700 bg-white dark:bg-slate-900 p-3"
                        >
                          <a
                            href={
                              candidate.profilePath ??
                              resolveShowcaseProfilePath(candidate.normalizedUrl, candidate.slug)
                            }
                            className={`inline-flex min-h-11 w-full items-center rounded-xl border border-sky-700 dark:border-sky-300 bg-sky-50 dark:bg-sky-950 px-3 py-2 text-start font-semibold text-sky-900 dark:text-sky-100 whitespace-normal wrap-anywhere ${focusRingClass}`}
                          >
                            {candidate.siteTitle}
                          </a>
                          <p className="mt-1 wrap-anywhere text-sm text-slate-700 dark:text-slate-300">
                            {candidate.normalizedUrl}
                          </p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-sm text-sky-900 dark:text-sky-100">
                      Aucune autre fiche publique n’est listée pour ce domaine pour le moment.
                    </p>
                  )}
                </section>
              ) : null}

              <section id="backlink-fiche" ref={backlinkSectionRef} tabIndex={-1} className={`mt-6 rounded-xl border border-sky-300 dark:border-sky-700 bg-sky-50 dark:bg-sky-950 p-4 ${focusTargetScrollMarginClass} ${focusTargetClass}`} aria-labelledby="backlink-fiche-titre">
                <h3 id="backlink-fiche-titre" className="text-lg font-semibold text-sky-900 dark:text-sky-100">
                  Lien retour recommandé
                </h3>
                <p className="mt-2 text-sm text-sky-900 dark:text-sky-100">
                  Pour faciliter la découverte mutuelle, vous pouvez publier ce lien vers votre fiche annuaire.
                </p>

                <div className="mt-3 rounded-xl border border-sky-300 dark:border-sky-700 bg-white dark:bg-slate-900 p-3">
                  <p className="text-sm font-semibold text-sky-900 dark:text-sky-100">Aperçu en texte stylé</p>
                  <a
                    href={profileUrl}
                    aria-label={`Voir la fiche de ${backlinkSiteTitle} sur Annuaire RGAA`}
                    className={`mt-2 inline-flex max-w-full flex-col rounded-2xl border border-sky-700 dark:border-sky-300 bg-sky-50 dark:bg-sky-950 px-4 py-3 text-start text-sky-950 dark:text-sky-50 ${focusRingClass}`}
                  >
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-900 dark:text-sky-100">
                      Annuaire RGAA
                    </span>
                    <span className="mt-1 text-base font-bold">
                      Référencé sur l’annuaire
                    </span>
                    <span className="mt-1 text-sm text-sky-900 dark:text-sky-100">
                      Voir la fiche de {backlinkSiteTitle}
                    </span>
                  </a>
                  <p className="mt-2 text-xs text-sky-900 dark:text-sky-100">
                    Le code HTML du badge image reste disponible ci-dessous pour les intégrations qui souhaitent
                    reprendre le visuel de marque.
                  </p>
                </div>

                <label htmlFor="backlink-code-badge" className="mt-3 block text-sm font-semibold text-sky-900 dark:text-sky-100">
                  Code HTML du badge (recommandé)
                </label>
                <textarea
                  id="backlink-code-badge"
                  readOnly
                  value={backlinkBadgeSnippet}
                  className={`mt-1 min-h-28 w-full rounded-xl border border-sky-300 dark:border-sky-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-50 ${focusRingClass}`}
                />
                <button
                  type="button"
                  onClick={() => {
                    void handleCopyBacklink(
                      backlinkBadgeSnippet,
                      'Code du badge copié. Vous pouvez le coller dans votre site.',
                    )
                  }}
                  className={`mt-3 inline-flex min-h-11 items-center rounded-xl bg-sky-700 px-4 py-2 font-semibold text-white ${focusRingClass}`}
                >
                  Copier le code du badge
                </button>

                <label htmlFor="backlink-code-text" className="mt-4 block text-sm font-semibold text-sky-900 dark:text-sky-100">
                  Alternative texte seule
                </label>
                <textarea
                  id="backlink-code-text"
                  readOnly
                  value={backlinkTextSnippet}
                  className={`mt-1 min-h-24 w-full rounded-xl border border-sky-300 dark:border-sky-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-50 ${focusRingClass}`}
                />
                <button
                  type="button"
                  onClick={() => {
                    void handleCopyBacklink(
                      backlinkTextSnippet,
                      'Code texte copié. Vous pouvez le coller dans votre site.',
                    )
                  }}
                  className={`mt-3 inline-flex min-h-11 items-center rounded-xl border border-sky-700 dark:border-sky-300 bg-sky-50 dark:bg-sky-950 px-4 py-2 font-semibold text-sky-900 dark:text-sky-100 hover:bg-sky-100 dark:hover:bg-sky-900 ${focusRingClass}`}
                >
                  Copier le code texte
                </button>
                {copyMessage && (
                  <p className="mt-3 text-sm text-sky-900 dark:text-sky-100" role="status" aria-live="polite">
                    {copyMessage}
                  </p>
                )}
              </section>

              <section id="fiches-associees" ref={relatedSectionRef} tabIndex={-1} className={`mt-6 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-4 ${focusTargetScrollMarginClass} ${focusTargetClass}`} aria-labelledby="fiches-associees-titre" aria-busy={isLoadingRelated}>
                <h3 id="fiches-associees-titre" className="text-lg font-semibold">
                  Fiches associées
                </h3>
                <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
                  Autres sites référencés dans la catégorie <strong>{entry.category}</strong>.
                </p>
                {isLoadingRelated && (
                  <p className="mt-3 text-sm text-slate-700 dark:text-slate-300" role="status" aria-live="polite">
                    Chargement des fiches associées...
                  </p>
                )}
                {!isLoadingRelated && relatedErrorMessage && (
                  <p className="mt-3 rounded-lg border border-rose-300 dark:border-rose-700 bg-rose-50 dark:bg-rose-950 p-3 text-sm text-rose-900 dark:text-rose-100" role="status" aria-live="polite">
                    {relatedErrorMessage}
                  </p>
                )}
                {!isLoadingRelated && !relatedErrorMessage && relatedEntries.length === 0 && (
                  <p className="mt-3 text-sm text-slate-700 dark:text-slate-300">
                    Aucune autre fiche de cette catégorie n’est disponible pour le moment.
                  </p>
                )}
                {relatedEntries.length > 0 && (
                  <ul className="mt-3 grid gap-3">
                    {relatedEntries.map((candidate) => {
                      const candidateProfilePath = resolveShowcaseProfilePath(
                        candidate.normalizedUrl,
                        candidate.slug,
                      )
                      return (
                        <li key={candidate.normalizedUrl} className="min-w-0 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3">
                          <a
                            href={candidateProfilePath}
                            className={`inline-flex min-h-11 w-full items-center rounded-xl border border-slate-700 dark:border-slate-300 bg-white dark:bg-slate-900 px-3 py-2 text-start font-semibold text-slate-900 dark:text-slate-50 whitespace-normal wrap-anywhere ${focusRingClass}`}
                          >
                            {candidate.siteTitle}
                          </a>
                          <p className="mt-1 wrap-anywhere text-sm text-slate-700 dark:text-slate-300">
                            {candidate.normalizedUrl}
                          </p>
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
