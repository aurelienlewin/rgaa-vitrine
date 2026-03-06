import { useCallback, useEffect, useRef } from 'react'
import type { MouseEvent as ReactMouseEvent, RefObject } from 'react'
import ThemeToggle from './ThemeToggle'
import { applySeo, createAbsoluteUrl } from './seo'

const focusRingClass =
  'focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-brand-focus'
const skipLinkClass = `inline-flex min-h-11 items-center rounded-lg bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-50 shadow-lg -translate-y-[220%] transition-transform duration-150 motion-reduce:transition-none focus-visible:translate-y-0 ${focusRingClass}`

type SiteLink = {
  href: string
  label: string
  description: string
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
]

const directorySections: SiteLink[] = [
  {
    href: '/#filtres-annuaire',
    label: 'Section filtres',
    description: 'Recherche par nom, catégorie et niveau de conformité.',
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
]

const technicalLinks: SiteLink[] = [
  {
    href: '/sitemap.xml',
    label: 'Sitemap XML',
    description: 'Fichier généré automatiquement pour l’indexation des pages publiques.',
  },
  {
    href: '/robots.txt',
    label: 'Fichier robots.txt',
    description: 'Consignes d’exploration des robots pour le site.',
  },
]

function SiteMapPage() {
  const mainContentRef = useRef<HTMLElement | null>(null)
  const primaryNavRef = useRef<HTMLElement | null>(null)

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

  useEffect(() => {
    applySeo({
      title: 'Plan du site | Annuaire RGAA',
      description:
        'Plan du site de l’annuaire RGAA: pages publiques, sections principales et ressources techniques SEO.',
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
            '@type': 'SiteNavigationElement',
            name: 'Navigation du site Annuaire RGAA',
            inLanguage: 'fr-FR',
            url: [
              createAbsoluteUrl('/'),
              createAbsoluteUrl('/plan-du-site'),
              createAbsoluteUrl('/sitemap.xml'),
              createAbsoluteUrl('/robots.txt'),
            ],
          },
        ],
      },
    })
  }, [])

  return (
    <>
      <div className="fixed left-4 top-4 z-60 flex flex-wrap gap-2" aria-label="Liens d’évitement">
        <a
          href="#contenu-plan"
          className={skipLinkClass}
          onClick={(event) => handleSkipLinkClick(event, mainContentRef)}
        >
          Aller au contenu
        </a>
        <a
          href="#navigation-principale"
          className={skipLinkClass}
          onClick={(event) => handleSkipLinkClick(event, primaryNavRef)}
        >
          Aller aux liens principaux
        </a>
      </div>

      <div className="min-h-screen bg-brand-surface text-brand-ink">
        <header className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
          <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h1 className="text-2xl font-bold">Plan du site</h1>
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
              </div>
            </div>
            <p className="mt-2 max-w-3xl text-slate-700 dark:text-slate-300">
              Cette page liste les entrées publiques et techniques de l’annuaire RGAA pour simplifier la navigation
              clavier, l’orientation et l’indexation.
            </p>
          </div>
        </header>

        <main
          id="contenu-plan"
          ref={mainContentRef}
          tabIndex={-1}
          className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8"
        >
          <nav
            id="navigation-principale"
            ref={primaryNavRef}
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
                  className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-4"
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
                  className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-4"
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
            aria-labelledby="liens-techniques-titre"
            className="mt-8 rounded-2xl border border-sky-200 dark:border-sky-700 bg-sky-50 dark:bg-sky-950/40 p-6"
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
      </div>
    </>
  )
}

export default SiteMapPage
