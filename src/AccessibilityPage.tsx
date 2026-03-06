import { useCallback, useEffect, useRef } from 'react'
import type { MouseEvent as ReactMouseEvent, RefObject } from 'react'
import { applySeo, createAbsoluteUrl } from './seo'
import SecondaryPageHeader from './SecondaryPageHeader'
import SiteFooter from './SiteFooter'

const focusRingClass =
  'focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-brand-focus'
const skipLinksContainerClass =
  'fixed start-2 top-2 z-60 flex max-w-[calc(100vw-1rem)] -translate-y-[120%] flex-col items-start gap-2 transition-transform duration-150 motion-reduce:transition-none focus-within:translate-y-0 sm:start-4 sm:top-4 sm:max-w-none'
const skipLinkClass = `inline-flex min-h-11 items-center rounded-lg bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-50 shadow-lg ${focusRingClass}`

const auditSummary = {
  score: '92,5 %',
  auditDate: '6 mars 2026',
  scope: '3 pages auditées',
  auditedPages: [
    'https://annuaire-rgaa.fr/',
    'https://annuaire-rgaa.fr/plan-du-site',
    'https://annuaire-rgaa.fr/accessibilite',
  ],
  applicableCriteria: '151',
  conclusiveCriteria: '147',
  reviewCriteria: '4',
  nonConformitiesCount: '11',
}

const nonConformities = [
  {
    id: '3.1',
    title: 'Informations perçues uniquement par la couleur sur des liens textuels',
    detail:
      'Des liens intégrés au texte ne sont pas assez distingués du texte environnant lorsqu’aucun soulignement permanent n’est présent.',
    impactedPages: 'Accessibilité',
  },
  {
    id: '3.2',
    title: 'Contraste texte/fond insuffisant sur un statut',
    detail:
      'Un libellé de statut affiche un contraste trop faible entre texte et arrière-plan.',
    impactedPages: 'Accueil',
  },
  {
    id: '3.3',
    title: 'Contraste non textuel insuffisant sur des composants d’interface',
    detail:
      'Certaines bordures et limites visuelles de contrôles interactifs ne sont pas suffisamment contrastées.',
    impactedPages: 'Accueil, Plan du site, Accessibilité',
  },
  {
    id: '7.2',
    title: 'Alternative aux scripts non pertinente',
    detail:
      'Le contenu sans script n’offrait pas d’accès fonctionnel équivalent aux pages et ressources publiques essentielles.',
    impactedPages: 'Accueil, Plan du site, Accessibilité',
  },
  {
    id: '10.5',
    title: 'Association couleur de texte / couleur de fond à renforcer',
    detail:
      'Certaines règles CSS utilisées sur la page doivent mieux expliciter le couple couleur de texte et couleur de fond.',
    impactedPages: 'Accessibilité',
  },
  {
    id: '10.6',
    title: 'Liens en contexte textuel insuffisamment distinguables',
    detail:
      'Des liens non évidents ne sont pas visuellement assez différenciés du texte adjacent.',
    impactedPages: 'Accessibilité',
  },
  {
    id: '10.11',
    title: 'Reflow en petite largeur à sécuriser',
    detail:
      'À 320 px de large, certains contenus peuvent nécessiter un défilement horizontal selon les cas.',
    impactedPages: 'Accessibilité',
  },
]

function AccessibilityPage() {
  const mainRef = useRef<HTMLElement | null>(null)
  const reportRef = useRef<HTMLElement | null>(null)
  const contactRef = useRef<HTMLElement | null>(null)
  const legalRef = useRef<HTMLElement | null>(null)
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

  useEffect(() => {
    applySeo({
      title: 'Accessibilité | Annuaire RGAA',
      description:
        'Déclaration d’accessibilité de l’annuaire RGAA: score, critères non conformes, contact et voies de recours.',
      path: '/accessibilite',
      structuredData: {
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'WebPage',
            '@id': createAbsoluteUrl('/accessibilite#webpage'),
            url: createAbsoluteUrl('/accessibilite'),
            name: 'Déclaration d’accessibilité | Annuaire RGAA',
            inLanguage: 'fr-FR',
            isPartOf: {
              '@id': createAbsoluteUrl('/#website'),
            },
            description:
              'Déclaration d’accessibilité incluant score mesuré, non-conformités identifiées, contact et voies de recours.',
          },
          {
            '@type': 'BreadcrumbList',
            '@id': createAbsoluteUrl('/accessibilite#breadcrumb'),
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
                name: 'Accessibilité',
                item: createAbsoluteUrl('/accessibilite'),
              },
            ],
          },
        ],
      },
    })
  }, [])

  return (
    <>
      <div
        className={skipLinksContainerClass}
        aria-label="Liens d’évitement"
      >
        <a href="#contenu-accessibilite" className={skipLinkClass} onClick={(event) => handleSkipLinkClick(event, mainRef)}>
          Aller au contenu
        </a>
        <a href="#non-conformites" className={skipLinkClass} onClick={(event) => handleSkipLinkClick(event, reportRef)}>
          Aller aux non-conformités
        </a>
        <a href="#contact-accessibilite" className={skipLinkClass} onClick={(event) => handleSkipLinkClick(event, contactRef)}>
          Aller au contact
        </a>
        <a href="#voies-recours" className={skipLinkClass} onClick={(event) => handleSkipLinkClick(event, legalRef)}>
          Aller aux recours
        </a>
        <a href="#pied-page" className={skipLinkClass} onClick={(event) => handleSkipLinkClick(event, footerRef)}>
          Aller au pied de page
        </a>
      </div>

      <div className="min-h-screen bg-brand-surface text-brand-ink">
        <SecondaryPageHeader
          title="Déclaration d’accessibilité"
          description={
            <>
              Cette déclaration s’applique au site <strong>https://annuaire-rgaa.fr/</strong>.
            </>
          }
          currentPath="/accessibilite"
        />

        <main
          id="contenu-accessibilite"
          ref={mainRef}
          tabIndex={-1}
          className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8"
        >
          <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm">
            <h2 className="text-xl font-semibold">État actuel</h2>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-slate-100 dark:bg-slate-800 px-4 py-3">
                <dt className="text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                  Score mesuré
                </dt>
                <dd className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-50">{auditSummary.score}</dd>
              </div>
              <div className="rounded-xl bg-slate-100 dark:bg-slate-800 px-4 py-3">
                <dt className="text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                  Non-conformités identifiées
                </dt>
                <dd className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-50">
                  {auditSummary.nonConformitiesCount}
                </dd>
              </div>
            </dl>
            <p className="mt-4 text-slate-700 dark:text-slate-300">
              Audit de référence réalisé le <strong>{auditSummary.auditDate}</strong> sur la version en production
              auditée à la date du contrôle ({auditSummary.scope}).
            </p>
            <ul className="mt-2 grid gap-1 text-sm text-slate-700 dark:text-slate-300">
              {auditSummary.auditedPages.map((pageUrl) => (
                <li key={pageUrl} className="wrap-anywhere">
                  Page auditée: {pageUrl}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
              Critères applicables évalués: {auditSummary.applicableCriteria}.
            </p>
            <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
              Critères conclusifs (conforme ou non conforme): {auditSummary.conclusiveCriteria}. Critères en revue:
              {' '}
              {auditSummary.reviewCriteria}.
            </p>
          </section>

          <section
            id="non-conformites"
            ref={reportRef}
            tabIndex={-1}
            className="mt-8 rounded-2xl border border-rose-300 dark:border-rose-700 bg-rose-50 dark:bg-rose-950/30 p-6"
            aria-labelledby="non-conformites-titre"
          >
            <h2 id="non-conformites-titre" className="text-xl font-semibold text-rose-900 dark:text-rose-100">
              Contenus non accessibles
            </h2>
            <ul className="mt-4 grid gap-3">
              {nonConformities.map((item) => (
                <li key={item.id} className="rounded-xl border border-rose-300 dark:border-rose-700 bg-white dark:bg-slate-900 p-4">
                  <p className="wrap-anywhere text-base font-semibold text-rose-900 dark:text-rose-100">
                    Critère {item.id} · {item.title}
                  </p>
                  <p className="mt-1 wrap-anywhere text-sm text-slate-800 dark:text-slate-200">{item.detail}</p>
                  <p className="mt-2 text-sm text-slate-800 dark:text-slate-200">
                    Pages concernées: <strong>{item.impactedPages}</strong>
                  </p>
                </li>
              ))}
            </ul>
          </section>

          <section
            id="contact-accessibilite"
            ref={contactRef}
            tabIndex={-1}
            className="mt-8 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm"
            aria-labelledby="contact-titre"
          >
            <h2 id="contact-titre" className="text-xl font-semibold">
              Retour d’information et contact
            </h2>
            <p className="mt-2 text-slate-700 dark:text-slate-300">
              Si vous ne parvenez pas à accéder à un contenu ou à une fonctionnalité, contactez le responsable du site
              pour obtenir une alternative accessible.
            </p>
            <ul className="mt-4 grid gap-3">
              <li className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-4">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Contact principal</p>
                <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">Aurélien Lewin</p>
              </li>
              <li className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-4">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">E-mail</p>
                <a
                  href="mailto:aurelienlewin@proton.me"
                  className={`mt-1 inline-flex min-h-11 items-center wrap-anywhere underline decoration-2 underline-offset-2 ${focusRingClass}`}
                >
                  aurelienlewin@proton.me
                </a>
              </li>
              <li className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-4">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Profil public</p>
                <a
                  href="https://github.com/aurelienlewin"
                  target="_blank"
                  rel="noreferrer noopener"
                  className={`mt-1 inline-flex min-h-11 items-center wrap-anywhere underline decoration-2 underline-offset-2 ${focusRingClass}`}
                >
                  github.com/aurelienlewin
                </a>
              </li>
            </ul>
          </section>

          <section
            id="voies-recours"
            ref={legalRef}
            tabIndex={-1}
            className="mt-8 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm"
            aria-labelledby="recours-titre"
          >
            <h2 id="recours-titre" className="text-xl font-semibold">
              Voies de recours
            </h2>
            <p className="mt-2 text-slate-700 dark:text-slate-300">
              Si vous constatez un défaut d’accessibilité bloquant et que vous n’obtenez pas de réponse satisfaisante
              après contact, vous pouvez saisir le Défenseur des droits.
            </p>
            <ul className="mt-4 list-disc space-y-2 ps-5 text-sm text-slate-700 dark:text-slate-300">
              <li>
                Formulaire en ligne:{' '}
                <a
                  href="https://formulaire.defenseurdesdroits.fr/"
                  target="_blank"
                  rel="noreferrer noopener"
                  className={`wrap-anywhere underline decoration-2 underline-offset-2 ${focusRingClass}`}
                >
                  formulaire.defenseurdesdroits.fr
                </a>
              </li>
              <li>Courrier: Défenseur des droits, Libre réponse 71120, 75342 Paris CEDEX 07.</li>
              <li>
                Téléphone:{' '}
                <a href="tel:+33153732900" className={`underline decoration-2 underline-offset-2 ${focusRingClass}`}>
                  01 53 73 29 00
                </a>
              </li>
            </ul>
          </section>
        </main>

        <SiteFooter id="pied-page" footerRef={footerRef} />
      </div>
    </>
  )
}

export default AccessibilityPage
