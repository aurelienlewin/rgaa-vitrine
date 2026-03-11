import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent, RefObject } from 'react'
import { normalizeDomainGroup, type DomainGroup } from './domainGroups'
import {
  focusElementWithScroll,
  focusTargetClass,
  focusTargetScrollMarginClass,
  useHashTargetFocus,
} from './hashNavigation'
import { applySeo, createAbsoluteUrl } from './seo'
import { resolveShowcaseProfilePath } from './siteProfiles'
import SecondaryPageHeader from './SecondaryPageHeader'
import SiteFooter from './SiteFooter'
import { visuallyHiddenStyle } from './visuallyHidden'

const focusRingClass =
  'focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-brand-focus'
const skipLinksContainerClass =
  'fixed start-2 top-2 z-60 flex max-w-[calc(100vw-1rem)] -translate-y-[120%] flex-col items-start gap-2 transition-transform duration-150 motion-reduce:transition-none focus-within:translate-y-0 hover:translate-y-0 sm:start-4 sm:top-4 sm:max-w-none'
const skipLinkClass = `inline-flex min-h-11 items-center rounded-lg border border-slate-900 bg-slate-950 px-3 py-2 text-slate-50 underline decoration-2 underline-offset-2 shadow-lg dark:border-slate-50 dark:bg-slate-50 dark:text-slate-950 ${focusRingClass}`

type SiteLink = {
  href: string
  label: string
  description: string
}

type ShowcaseEntry = {
  normalizedUrl: string
  slug?: string
  profilePath?: string
  siteTitle: string
  category: string
  updatedAt: string
}

const primaryPages: SiteLink[] = [
  {
    href: '/',
    label: 'Accueil de l’annuaire',
    description: 'Page principale avec recherche, filtres et formulaire de soumission.',
  },
  {
    href: '/plan-du-site',
    label: 'Plan du site',
    description: 'Vue d’ensemble des pages et sections publiques.',
  },
  {
    href: '/accessibilite',
    label: 'Déclaration d’accessibilité',
    description: 'Statut de conformité, engagements de suivi et contact.',
  },
]

const directorySections: SiteLink[] = [
  {
    href: '/#moteur-recherche-global',
    label: 'Moteur de recherche global',
    description: 'Accès identique à la recherche annuaire depuis toutes les pages.',
  },
  {
    href: '/#ajout-site',
    label: 'Section ajout de site',
    description: 'Formulaire de soumission avec validation serveur.',
  },
  {
    href: '/#aide-accessibilite',
    label: 'Section aide accessibilité',
    description: 'Repères WCAG 2.2 et ressources officielles.',
  },
  {
    href: '/#ressources-officielles',
    label: 'Ressources officielles RGAA',
    description: 'Liens de référence pour les équipes design et développement.',
  },
  {
    href: '/#resultats-annuaire',
    label: 'Fiches par site',
    description: 'Chaque carte mène à une fiche dédiée (`/site/{slug}`) indexable et partageable.',
  },
  {
    href: '/#resultats-annuaire',
    label: 'Pages domaine multi-sites',
    description: 'Les domaines déjà présents avec plusieurs sous-sites disposent d’une page dédiée (`/domaine/{slug}`).',
  },
]

const technicalLinks: SiteLink[] = [
  {
    href: '/sitemap.xml',
    label: 'Sitemap XML',
    description: 'Endpoint XML généré automatiquement pour l’indexation des pages publiques.',
  },
  {
    href: '/ai-context.json',
    label: 'Contexte IA JSON',
    description: 'Endpoint JSON généré automatiquement avec les pages publiques et les endpoints de données.',
  },
  {
    href: '/llms.txt',
    label: 'LLMs.txt',
    description: 'Fichier texte versionné avec les consignes de découverte rapides pour crawlers et agents IA.',
  },
  {
    href: '/llms-full.txt',
    label: 'LLMs full.txt',
    description: 'Fichier texte versionné avec le contexte détaillé, le schéma de données et les conseils d’usage.',
  },
  {
    href: '/robots.txt',
    label: 'Fichier robots.txt',
    description: 'Fichier statique versionné avec les consignes d’exploration des robots pour le site.',
  },
  {
    href: '/api/showcase',
    label: 'API annuaire JSON',
    description: 'Endpoint public en lecture seule listant les fiches publiées.',
  },
  {
    href: '/api/domain-groups',
    label: 'API domaines JSON',
    description: 'Endpoint public en lecture seule listant les domaines multi-sites.',
  },
]

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

function readSafeSlug(value: unknown) {
  if (typeof value !== 'string') {
    return null
  }

  return /^[a-z0-9-]{4,120}$/.test(value) ? value : null
}

function normalizeShowcaseEntry(entry: ShowcaseEntry): ShowcaseEntry {
  const safeSlug = readSafeSlug(entry.slug)
  return {
    ...entry,
    slug: safeSlug ?? undefined,
    profilePath: resolveShowcaseProfilePath(entry.normalizedUrl, safeSlug),
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

function SiteMapPage() {
  const [profileEntries, setProfileEntries] = useState<ShowcaseEntry[]>([])
  const [domainGroups, setDomainGroups] = useState<DomainGroup[]>([])
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(true)
  const [profileErrorMessage, setProfileErrorMessage] = useState<string | null>(null)
  const [isLoadingDomainGroups, setIsLoadingDomainGroups] = useState(true)
  const [domainGroupErrorMessage, setDomainGroupErrorMessage] = useState<string | null>(null)
  const [politeAnnouncement, setPoliteAnnouncement] = useState({ id: 0, message: '' })
  const mainContentRef = useRef<HTMLElement | null>(null)
  const navigationRef = useRef<HTMLElement | null>(null)
  const siteMapSectionsRef = useRef<HTMLElement | null>(null)
  const homeSectionsRef = useRef<HTMLElement | null>(null)
  const profileSectionRef = useRef<HTMLElement | null>(null)
  const technicalResourcesRef = useRef<HTMLElement | null>(null)
  const footerRef = useRef<HTMLElement | null>(null)

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
    setPoliteAnnouncement((previous) => ({ id: previous.id + 1, message }))
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadProfileEntries() {
      setIsLoadingProfiles(true)
      setProfileErrorMessage(null)
      setIsLoadingDomainGroups(true)
      setDomainGroupErrorMessage(null)

      try {
        const [profilesResponse, domainGroupsResponse] = await Promise.all([
          fetch('/api/showcase?limit=120'),
          fetch('/api/domain-groups'),
        ])
        const [profilesPayload, domainGroupsPayload] = await Promise.all([
          readApiPayload(profilesResponse),
          readApiPayload(domainGroupsResponse),
        ])
        if (!profilesResponse.ok) {
          throw new Error(typeof profilesPayload.error === 'string' ? profilesPayload.error : 'Chargement des fiches impossible.')
        }

        if (!domainGroupsResponse.ok) {
          throw new Error(
            typeof domainGroupsPayload.error === 'string'
              ? domainGroupsPayload.error
              : 'Chargement des pages domaine impossible.',
          )
        }

        const responseEntries = Array.isArray(profilesPayload.entries)
          ? profilesPayload.entries
          : Array.isArray(profilesPayload)
            ? profilesPayload
            : null

        if (!responseEntries) {
          throw new Error('Réponse annuaire invalide.')
        }

        const uniqueByProfilePath = new Map<string, ShowcaseEntry>()
        for (const candidate of responseEntries) {
          if (!isShowcaseEntry(candidate)) {
            continue
          }
          const normalized = normalizeShowcaseEntry(candidate)
          if (!normalized.profilePath) {
            continue
          }
          if (!uniqueByProfilePath.has(normalized.profilePath)) {
            uniqueByProfilePath.set(normalized.profilePath, normalized)
          }
        }

        const nextEntries = Array.from(uniqueByProfilePath.values())
        const nextDomainGroups = Array.isArray(domainGroupsPayload.groups)
          ? domainGroupsPayload.groups
              .map((item) => normalizeDomainGroup(item))
              .filter((item): item is DomainGroup => item !== null)
          : []
        if (!cancelled) {
          setProfileEntries(nextEntries)
          setDomainGroups(nextDomainGroups)
          announcePolite(
            `Chargement terminé. ${nextEntries.length} fiche${nextEntries.length > 1 ? 's' : ''} publique${nextEntries.length > 1 ? 's' : ''} et ${nextDomainGroups.length} page${nextDomainGroups.length > 1 ? 's' : ''} domaine disponible${nextDomainGroups.length > 1 ? 's' : ''}.`,
          )
        }
      } catch (error) {
        if (!cancelled) {
          setProfileEntries([])
          setDomainGroups([])
          const localizedMessage =
            error instanceof Error ? error.message : 'Chargement des fiches impossible.'
          setProfileErrorMessage(localizedMessage)
          setDomainGroupErrorMessage(localizedMessage)
          announcePolite(`Chargement des fiches publiques terminé avec erreur: ${localizedMessage}`)
        }
      } finally {
        if (!cancelled) {
          setIsLoadingProfiles(false)
          setIsLoadingDomainGroups(false)
        }
      }
    }

    void loadProfileEntries()

    return () => {
      cancelled = true
    }
  }, [announcePolite])
  useHashTargetFocus(focusElement)

  const profileLinksForSeo = useMemo(
    () => profileEntries.slice(0, 30).map((entry) => createAbsoluteUrl(entry.profilePath ?? '/')),
    [profileEntries],
  )
  const domainGroupLinksForSeo = useMemo(
    () => domainGroups.slice(0, 30).map((group) => createAbsoluteUrl(group.groupPath)),
    [domainGroups],
  )

  const profileLinksForUi = useMemo(() => profileEntries.slice(0, 40), [profileEntries])
  const domainGroupLinksForUi = useMemo(() => domainGroups.slice(0, 30), [domainGroups])

  useEffect(() => {
    const profileItemList = profileLinksForUi.map((entry, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: entry.siteTitle,
      item: createAbsoluteUrl(entry.profilePath ?? '/'),
    }))
    const domainGroupItemList = domainGroupLinksForUi.map((group, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: group.registrableDomain,
      item: createAbsoluteUrl(group.groupPath),
    }))

    applySeo({
      title: 'Plan du site | Annuaire RGAA',
      description:
        'Plan du site de l’annuaire RGAA: pages publiques, fiches site indexables et ressources techniques et données publiques.',
      path: '/plan-du-site',
      structuredData: {
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'WebSite',
            '@id': createAbsoluteUrl('/#website'),
            url: createAbsoluteUrl('/'),
            name: 'Annuaire RGAA',
            inLanguage: 'fr-FR',
          },
          {
            '@type': 'WebPage',
            '@id': createAbsoluteUrl('/plan-du-site#webpage'),
            url: createAbsoluteUrl('/plan-du-site'),
            name: 'Plan du site | Annuaire RGAA',
            inLanguage: 'fr-FR',
            isPartOf: {
              '@id': createAbsoluteUrl('/#website'),
            },
            description:
              'Plan du site public de l’annuaire RGAA avec liens vers l’accueil, les sections, les ressources techniques et les données publiques.',
          },
          {
            '@type': 'BreadcrumbList',
            '@id': createAbsoluteUrl('/plan-du-site#breadcrumb'),
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
                name: 'Plan du site',
                item: createAbsoluteUrl('/plan-du-site'),
              },
            ],
          },
          {
            '@type': 'SiteNavigationElement',
            name: 'Navigation du site Annuaire RGAA',
            inLanguage: 'fr-FR',
            url: [
              createAbsoluteUrl('/'),
              createAbsoluteUrl('/plan-du-site'),
              createAbsoluteUrl('/accessibilite'),
              createAbsoluteUrl('/sitemap.xml'),
              createAbsoluteUrl('/ai-context.json'),
              createAbsoluteUrl('/llms.txt'),
              createAbsoluteUrl('/llms-full.txt'),
              createAbsoluteUrl('/robots.txt'),
              ...domainGroupLinksForSeo,
              ...profileLinksForSeo,
            ],
          },
          ...(profileItemList.length > 0
            ? [
                {
                  '@type': 'ItemList',
                  '@id': createAbsoluteUrl('/plan-du-site#fiches'),
                  name: 'Fiches publiques référencées',
                  numberOfItems: profileItemList.length,
                  itemListElement: profileItemList,
                },
              ]
            : []),
          ...(domainGroupItemList.length > 0
            ? [
                {
                  '@type': 'ItemList',
                  '@id': createAbsoluteUrl('/plan-du-site#domaines'),
                  name: 'Pages domaine multi-sites',
                  numberOfItems: domainGroupItemList.length,
                  itemListElement: domainGroupItemList,
                },
              ]
            : []),
        ],
      },
    })
  }, [domainGroupLinksForSeo, domainGroupLinksForUi, profileLinksForSeo, profileLinksForUi])

  return (
    <>
      <div className="sr-only" style={visuallyHiddenStyle} role="status" aria-live="polite" aria-atomic="true" lang="fr">
        {politeAnnouncement.message}
        <span aria-hidden="true">{politeAnnouncement.id}</span>
      </div>

      <nav
        className={skipLinksContainerClass}
        aria-label="Liens d’évitement"
      >
        <a
          href="#contenu-plan"
          className={skipLinkClass}
          onClick={(event) => handleSkipLinkClick(event, mainContentRef)}
        >
          Aller au contenu
        </a>
        <a href="/#moteur-recherche-global" className={skipLinkClass}>
          Aller à la recherche annuaire
        </a>
        <a href="#navigation-principale" className={skipLinkClass} onClick={(event) => handleSkipLinkClick(event, navigationRef)}>
          Aller à la navigation principale
        </a>
        <a
          href="#sections-annuaire"
          className={skipLinkClass}
          onClick={(event) => handleSkipLinkClick(event, homeSectionsRef)}
        >
          Aller aux sections de l’accueil
        </a>
        <a
          href="#pages-principales-plan"
          className={skipLinkClass}
          onClick={(event) => handleSkipLinkClick(event, siteMapSectionsRef)}
        >
          Aller aux pages principales du plan
        </a>
        <a
          href="#fiches-publiques"
          className={skipLinkClass}
          onClick={(event) => handleSkipLinkClick(event, profileSectionRef)}
        >
          Aller aux fiches publiées
        </a>
        <a
          href="#ressources-techniques"
          className={skipLinkClass}
          onClick={(event) => handleSkipLinkClick(event, technicalResourcesRef)}
        >
          Aller aux ressources techniques
        </a>
        <a
          href="#pied-page"
          className={skipLinkClass}
          onClick={(event) => handleSkipLinkClick(event, footerRef)}
        >
          Aller au pied de page
        </a>
      </nav>

      <div className="min-h-screen bg-brand-surface text-brand-ink">
        <SecondaryPageHeader
          title="Plan du site"
          navigationRef={navigationRef}
          description="Cette page liste les entrées publiques et techniques de l’annuaire RGAA pour simplifier la navigation clavier, l’orientation et l’indexation."
          currentPath="/plan-du-site"
        />

        <main
          id="contenu-plan"
          ref={mainContentRef}
          tabIndex={-1}
          className={`mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 ${focusTargetScrollMarginClass} ${focusTargetClass}`}
        >
          <nav
            id="pages-principales-plan"
            ref={siteMapSectionsRef}
            tabIndex={-1}
            aria-labelledby="pages-principales-titre"
            className={`rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm ${focusTargetScrollMarginClass} ${focusTargetClass}`}
          >
            <h2 id="pages-principales-titre" className="text-xl font-semibold">
              Pages principales
            </h2>
            <ul className="mt-4 grid gap-3">
              {primaryPages.map((link) => (
                <li
                  key={`${link.href}-${link.label}`}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-4"
                >
                  <a
                    href={link.href}
                    className={`inline-flex min-h-11 items-center font-semibold underline ${focusRingClass}`}
                  >
                    {link.label}
                  </a>
                  <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">{link.description}</p>
                </li>
              ))}
            </ul>
          </nav>

          <nav
            id="sections-annuaire"
            ref={homeSectionsRef}
            tabIndex={-1}
            aria-labelledby="sections-annuaire-titre"
            className={`mt-8 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm ${focusTargetScrollMarginClass} ${focusTargetClass}`}
          >
            <h2 id="sections-annuaire-titre" className="text-xl font-semibold">
              Sections de la page d’accueil
            </h2>
            <ul className="mt-4 grid gap-3">
              {directorySections.map((link) => (
                <li
                  key={`${link.href}-${link.label}`}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-4"
                >
                  <a
                    href={link.href}
                    className={`inline-flex min-h-11 items-center font-semibold underline ${focusRingClass}`}
                  >
                    {link.label}
                  </a>
                  <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">{link.description}</p>
                </li>
              ))}
            </ul>
          </nav>

          <section
            id="fiches-publiques"
            ref={profileSectionRef}
            tabIndex={-1}
            aria-labelledby="fiches-publiques-titre"
            className={`mt-8 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm ${focusTargetScrollMarginClass} ${focusTargetClass}`}
            aria-busy={isLoadingProfiles || isLoadingDomainGroups}
          >
            <h2 id="fiches-publiques-titre" className="text-xl font-semibold">
              Fiches publiques indexables
            </h2>
            <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
              Extrait des fiches `/site/{'{'}slug{'}'}` disponibles pour l’indexation et le maillage interne.
            </p>
            {isLoadingProfiles && (
              <p className="mt-3 text-sm text-slate-700 dark:text-slate-300" role="status" aria-live="polite">
                Chargement des fiches publiques...
              </p>
            )}
            {!isLoadingProfiles && profileErrorMessage && (
              <p className="mt-3 rounded-lg border border-rose-300 dark:border-rose-700 bg-rose-50 dark:bg-rose-950 p-3 text-sm text-rose-900 dark:text-rose-100" role="status" aria-live="polite">
                {profileErrorMessage}
              </p>
            )}
            {!isLoadingProfiles && !profileErrorMessage && profileLinksForUi.length === 0 && (
              <p className="mt-3 text-sm text-slate-700 dark:text-slate-300">
                Aucune fiche n’est encore publiée.
              </p>
            )}
            {profileLinksForUi.length > 0 && (
              <ul className="mt-4 grid gap-3 md:grid-cols-2">
                {profileLinksForUi.map((entry) => (
                  <li
                    key={entry.normalizedUrl}
                    className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-4"
                  >
                    <a
                      href={entry.profilePath}
                      className={`inline-flex min-h-11 items-center font-semibold underline ${focusRingClass}`}
                    >
                      {entry.siteTitle}
                    </a>
                    <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                      Catégorie: {entry.category}
                    </p>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-6">
              <h3 className="text-lg font-semibold">Pages domaine multi-sites</h3>
              <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
                Pages `/domaine/{'{'}slug{'}'}` disponibles pour les domaines déjà référencés avec plusieurs fiches publiques.
              </p>
              {isLoadingDomainGroups && (
                <p className="mt-3 text-sm text-slate-700 dark:text-slate-300" role="status" aria-live="polite">
                  Chargement des pages domaine...
                </p>
              )}
              {!isLoadingDomainGroups && domainGroupErrorMessage && (
                <p className="mt-3 rounded-lg border border-rose-300 dark:border-rose-700 bg-rose-50 dark:bg-rose-950 p-3 text-sm text-rose-900 dark:text-rose-100" role="status" aria-live="polite">
                  {domainGroupErrorMessage}
                </p>
              )}
              {!isLoadingDomainGroups && !domainGroupErrorMessage && domainGroupLinksForUi.length === 0 && (
                <p className="mt-3 text-sm text-slate-700 dark:text-slate-300">
                  Aucune page domaine multi-sites n’est encore publiée.
                </p>
              )}
              {domainGroupLinksForUi.length > 0 && (
                <ul className="mt-4 grid gap-3 md:grid-cols-2">
                  {domainGroupLinksForUi.map((group) => (
                    <li
                      key={group.groupSlug}
                      className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-4"
                    >
                      <a
                        href={group.groupPath}
                        className={`inline-flex min-h-11 items-center font-semibold underline ${focusRingClass}`}
                      >
                        {group.registrableDomain}
                      </a>
                      <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                        {group.siteCount} fiche(s) publique(s)
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <nav
            id="ressources-techniques"
            ref={technicalResourcesRef}
            tabIndex={-1}
            aria-labelledby="liens-techniques-titre"
            className={`mt-8 rounded-2xl border border-sky-200 dark:border-sky-700 bg-sky-50 dark:bg-sky-950 p-6 ${focusTargetScrollMarginClass} ${focusTargetClass}`}
          >
            <h2 id="liens-techniques-titre" className="text-xl font-semibold text-sky-900 dark:text-sky-100">
              Ressources techniques et données publiques
            </h2>
            <p className="mt-2 text-sky-900 dark:text-sky-100">
              Ces fichiers et endpoints publics en lecture seule servent à l’exploration des pages publiques et à la
              découverte des données. L’espace modération n’est pas listé dans le sitemap et reste déclaré en
              `noindex`.
            </p>
            <ul className="mt-4 grid gap-3">
              {technicalLinks.map((link) => (
                <li
                  key={`${link.href}-${link.label}`}
                  className="rounded-xl border border-sky-300 dark:border-sky-700 bg-white dark:bg-slate-900 p-4"
                >
                  <a
                    href={link.href}
                    className={`inline-flex min-h-11 items-center font-semibold text-sky-900 dark:text-sky-100 underline ${focusRingClass}`}
                  >
                    {link.label}
                  </a>
                  <p className="mt-1 text-sm text-sky-900 dark:text-sky-100">{link.description}</p>
                </li>
              ))}
            </ul>
          </nav>
        </main>

        <SiteFooter id="pied-page" footerRef={footerRef} />
      </div>
    </>
  )
}

export default SiteMapPage
