import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent, RefObject } from 'react'
import { applySeo, createAbsoluteUrl } from './seo'
import { resolveShowcaseProfilePath } from './siteProfiles'
import SecondaryPageHeader from './SecondaryPageHeader'
import SiteFooter from './SiteFooter'

const focusRingClass =
  'focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-brand-focus'
const skipLinksContainerClass =
  'fixed start-2 top-2 z-60 flex max-w-[calc(100vw-1rem)] -translate-y-[120%] flex-col items-start gap-2 transition-transform duration-150 motion-reduce:transition-none focus-within:translate-y-0 sm:start-4 sm:top-4 sm:max-w-none'
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
    href: '/#sources-titre',
    label: 'Ressources officielles RGAA',
    description: 'Liens de référence pour les équipes design et développement.',
  },
  {
    href: '/#liste-vitrines',
    label: 'Fiches par site',
    description: 'Chaque carte mène à une fiche dédiée (`/site/{slug}`) indexable et partageable.',
  },
]

const technicalLinks: SiteLink[] = [
  {
    href: '/sitemap.xml',
    label: 'Sitemap XML',
    description: 'Fichier généré automatiquement pour l’indexation des pages publiques.',
  },
  {
    href: '/ai-context.json',
    label: 'Contexte IA JSON',
    description: 'Résumé machine-readable du site, des pages publiques et des endpoints de données.',
  },
  {
    href: '/llms.txt',
    label: 'LLMs.txt',
    description: 'Instructions de découverte rapides pour crawlers et agents IA.',
  },
  {
    href: '/llms-full.txt',
    label: 'LLMs full',
    description: 'Contexte détaillé: schéma de données, limites et conseils d’usage.',
  },
  {
    href: '/robots.txt',
    label: 'Fichier robots.txt',
    description: 'Consignes d’exploration des robots pour le site.',
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
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(true)
  const [profileErrorMessage, setProfileErrorMessage] = useState<string | null>(null)
  const [politeAnnouncement, setPoliteAnnouncement] = useState({ id: 0, message: '' })
  const mainContentRef = useRef<HTMLElement | null>(null)
  const navigationRef = useRef<HTMLElement | null>(null)
  const siteMapSectionsRef = useRef<HTMLElement | null>(null)
  const profileSectionRef = useRef<HTMLElement | null>(null)
  const footerRef = useRef<HTMLElement | null>(null)

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
    setPoliteAnnouncement((previous) => ({ id: previous.id + 1, message }))
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadProfileEntries() {
      setIsLoadingProfiles(true)
      setProfileErrorMessage(null)

      try {
        const response = await fetch('/api/showcase?limit=120')
        const payload = await readApiPayload(response)
        if (!response.ok) {
          throw new Error(typeof payload.error === 'string' ? payload.error : 'Chargement des fiches impossible.')
        }

        const responseEntries = Array.isArray(payload.entries)
          ? payload.entries
          : Array.isArray(payload)
            ? payload
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
        if (!cancelled) {
          setProfileEntries(nextEntries)
          announcePolite(
            nextEntries.length > 0
              ? `Chargement terminé. ${nextEntries.length} fiche${nextEntries.length > 1 ? 's' : ''} publique${nextEntries.length > 1 ? 's' : ''} disponible${nextEntries.length > 1 ? 's' : ''}.`
              : 'Chargement terminé. Aucune fiche publique publiée pour le moment.',
          )
        }
      } catch (error) {
        if (!cancelled) {
          setProfileEntries([])
          const localizedMessage =
            error instanceof Error ? error.message : 'Chargement des fiches impossible.'
          setProfileErrorMessage(localizedMessage)
          announcePolite(`Chargement des fiches publiques terminé avec erreur: ${localizedMessage}`)
        }
      } finally {
        if (!cancelled) {
          setIsLoadingProfiles(false)
        }
      }
    }

    void loadProfileEntries()

    return () => {
      cancelled = true
    }
  }, [announcePolite])

  const profileLinksForSeo = useMemo(
    () => profileEntries.slice(0, 30).map((entry) => createAbsoluteUrl(entry.profilePath ?? '/')),
    [profileEntries],
  )

  const profileLinksForUi = useMemo(() => profileEntries.slice(0, 40), [profileEntries])

  useEffect(() => {
    const profileItemList = profileLinksForUi.map((entry, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: entry.siteTitle,
      item: createAbsoluteUrl(entry.profilePath ?? '/'),
    }))

    applySeo({
      title: 'Plan du site | Annuaire RGAA',
      description:
        'Plan du site de l’annuaire RGAA: pages publiques, fiches site indexables et ressources techniques SEO.',
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
              'Plan du site public de l’annuaire RGAA avec liens vers l’accueil, les sections et les fichiers techniques.',
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
        ],
      },
    })
  }, [profileLinksForSeo, profileLinksForUi])

  return (
    <>
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true" lang="fr">
        {politeAnnouncement.message}
        <span aria-hidden="true">{politeAnnouncement.id}</span>
      </div>

      <div
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
          href="#pied-page"
          className={skipLinkClass}
          onClick={(event) => handleSkipLinkClick(event, footerRef)}
        >
          Aller au pied de page
        </a>
      </div>

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
          className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8"
        >
          <nav
            id="pages-principales-plan"
            ref={siteMapSectionsRef}
            tabIndex={-1}
            aria-labelledby="pages-principales-titre"
            className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm"
          >
            <h2 id="pages-principales-titre" className="text-xl font-semibold">
              Pages principales
            </h2>
            <ul className="mt-4 grid gap-3">
              {primaryPages.map((link) => (
                <li
                  key={link.href}
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
            aria-labelledby="sections-annuaire-titre"
            className="mt-8 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm"
          >
            <h2 id="sections-annuaire-titre" className="text-xl font-semibold">
              Sections de la page d’accueil
            </h2>
            <ul className="mt-4 grid gap-3">
              {directorySections.map((link) => (
                <li
                  key={link.href}
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
          </section>

          <section
            id="fiches-publiques"
            ref={profileSectionRef}
            tabIndex={-1}
            aria-labelledby="fiches-publiques-titre"
            className="mt-8 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm"
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
          </section>

          <section
            aria-labelledby="liens-techniques-titre"
            className="mt-8 rounded-2xl border border-sky-200 dark:border-sky-700 bg-sky-50 dark:bg-sky-950 p-6"
          >
            <h2 id="liens-techniques-titre" className="text-xl font-semibold text-sky-900 dark:text-sky-100">
              Liens techniques SEO
            </h2>
            <p className="mt-2 text-sky-900 dark:text-sky-100">
              Ces fichiers servent à l’exploration des pages publiques. L’espace modération n’est pas listé dans le
              sitemap et reste déclaré en `noindex`.
            </p>
            <ul className="mt-4 grid gap-3">
              {technicalLinks.map((link) => (
                <li
                  key={link.href}
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
          </section>
        </main>

        <SiteFooter id="pied-page" footerRef={footerRef} />
      </div>
    </>
  )
}

export default SiteMapPage
