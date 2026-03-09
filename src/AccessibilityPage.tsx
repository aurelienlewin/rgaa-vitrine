import { useCallback, useEffect, useRef } from 'react'
import type { MouseEvent as ReactMouseEvent, RefObject } from 'react'
import { applySeo, createAbsoluteUrl } from './seo'
import SecondaryPageHeader from './SecondaryPageHeader'
import SiteFooter from './SiteFooter'

const focusRingClass =
  'focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-brand-focus'
const skipLinksContainerClass =
  'fixed start-2 top-2 z-60 flex max-w-[calc(100vw-1rem)] -translate-y-[120%] flex-col items-start gap-2 transition-transform duration-150 motion-reduce:transition-none focus-within:translate-y-0 sm:start-4 sm:top-4 sm:max-w-none'
const skipLinkClass = `inline-flex min-h-11 items-center rounded-lg border border-slate-900 bg-slate-950 px-3 py-2 text-slate-50 underline decoration-2 underline-offset-2 shadow-lg dark:border-slate-50 dark:bg-slate-50 dark:text-slate-950 ${focusRingClass}`

const auditSummary = {
  status: 'Partiellement conforme',
  score: '96,8 % (estimation)',
  auditDate: '8 mars 2026',
  auditDateIso: '2026-03-08',
  scope: '4 pages publiques vérifiées',
  auditedPages: [
    'https://www.annuaire-rgaa.fr/',
    'https://www.annuaire-rgaa.fr/plan-du-site',
    'https://www.annuaire-rgaa.fr/accessibilite',
    'https://www.annuaire-rgaa.fr/site/access42-net-h0nx3j',
  ],
  applicableCriteria: '424 critères vérifiés',
  nonConformitiesCount: '2 critères',
  remediationStatus: 'Plan d’action en cours',
}

const currentNonConformities = [
  {
    id: '10.5',
    title: 'Déclarations de couleurs de texte et de fond à compléter',
    detail:
      'Certaines zones de texte doivent expliciter plus systématiquement leur couleur de fond associée pour garantir une lecture stable quel que soit le contexte d’affichage.',
    impactedPages: 'Accueil de l’annuaire',
    status: 'Correction en cours',
  },
  {
    id: '10.11',
    title: 'Adaptation aux petites hauteurs d’affichage',
    detail:
      'Le contenu doit être ajusté pour limiter le recours au défilement vertical dans des fenêtres de faible hauteur, tout en conservant toutes les informations et fonctionnalités.',
    impactedPages: 'Accueil de l’annuaire',
    status: 'Correction en cours',
  },
]

const implementationTechnologies = [
  'HTML5',
  'CSS (Tailwind CSS 4.2.1)',
  'JavaScript',
  'TypeScript 5.9.3',
  'React 19.2.0',
  'Vite 7.3.1',
  'Node.js 25.2.1',
  'Express 5.2.1',
]

const auditEnvironment = [
  'macOS 26.3.1 (build 25D2128)',
  'Node.js 25.2.1',
  'npm 11.6.2',
  'Audit exécuté avec Chrome DevTools (voir journal horodaté du 8 mars 2026)',
]

const accessibilityEvaluationTools = [
  'rgaa-auditor 2.0.1 (outil interne, dossier ../audit)',
  'Chrome DevTools (captures, snapshots, scripts de vérification ciblés)',
  'Revue assistée Codex modèle gpt-5.3-codex (journal d’audit)',
  'Contrôles de qualité projet: npm run lint et npm run build',
]

function AccessibilityPage() {
  const mainRef = useRef<HTMLElement | null>(null)
  const navigationRef = useRef<HTMLElement | null>(null)
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
    const websiteId = createAbsoluteUrl('/#website')
    const accessibilityPageId = createAbsoluteUrl('/accessibilite#webpage')
    const accessibilityStatementId = createAbsoluteUrl('/accessibilite#statement')
    applySeo({
      title: 'Accessibilité | Annuaire RGAA',
      description:
        'Déclaration d’accessibilité de l’annuaire RGAA: statut de conformité, méthodologie de test, stack technique, outils, contact et voies de recours.',
      path: '/accessibilite',
      structuredData: {
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'WebPage',
            '@id': accessibilityPageId,
            url: createAbsoluteUrl('/accessibilite'),
            name: 'Déclaration d’accessibilité | Annuaire RGAA',
            inLanguage: 'fr-FR',
            isPartOf: {
              '@id': websiteId,
            },
            description:
              'Déclaration d’accessibilité incluant statut de conformité, méthodologie, technologies, outils, contact et voies de recours.',
            accessibilitySummary:
              'Page de déclaration d’accessibilité avec état de conformité, plan de correction, environnement d’audit et voies de recours.',
            accessibilityFeature: [
              'highContrastDisplay',
              'displayTransformability',
              'largePrint',
            ],
            accessibilityControl: [
              'fullKeyboardControl',
              'fullMouseControl',
              'fullTouchControl',
            ],
            accessMode: ['textual', 'visual'],
            accessModeSufficient: ['textual', 'visual'],
            mainEntity: {
              '@id': accessibilityStatementId,
            },
          },
          {
            '@type': 'CreativeWork',
            '@id': accessibilityStatementId,
            name: 'Déclaration d’accessibilité Annuaire RGAA',
            url: createAbsoluteUrl('/accessibilite'),
            inLanguage: 'fr-FR',
            dateModified: auditSummary.auditDateIso,
            abstract:
              'Déclaration publique de conformité RGAA avec statut partiel, score estimatif, non-conformités connues et moyens de contact.',
            about: [
              {
                '@type': 'Thing',
                name: 'Référentiel général d’amélioration de l’accessibilité (RGAA)',
              },
              {
                '@type': 'Thing',
                name: 'WCAG 2.2',
              },
            ],
            accessibilitySummary: `État déclaré: ${auditSummary.status}. ${auditSummary.nonConformitiesCount} actuellement suivis.`,
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
        <a href="#navigation-principale" className={skipLinkClass} onClick={(event) => handleSkipLinkClick(event, navigationRef)}>
          Aller à la navigation principale
        </a>
        <a href="/#moteur-recherche-global" className={skipLinkClass}>
          Aller à la recherche annuaire
        </a>
        <a href="#non-conformites" className={skipLinkClass} onClick={(event) => handleSkipLinkClick(event, reportRef)}>
          Aller au suivi de conformité
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
          navigationRef={navigationRef}
          description={
            <>
              Cette déclaration s’applique au site <strong>https://annuaire-rgaa.fr/</strong> et couvre les exigences
              du Référentiel général d’amélioration de l’accessibilité (RGAA).
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
                  État de conformité
                </dt>
                <dd className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-50">{auditSummary.status}</dd>
              </div>
              <div className="rounded-xl bg-slate-100 dark:bg-slate-800 px-4 py-3">
                <dt className="text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                  Taux estimé
                </dt>
                <dd className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-50">
                  {auditSummary.score}
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
              {auditSummary.applicableCriteria}.
            </p>
            <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
              Non-conformités en cours: {auditSummary.nonConformitiesCount}.
            </p>
            <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
              Parcours de fiches vérifié sur un échantillon représentatif, incluant notamment Access42 et Temesis.
            </p>
          </section>

          <section
            id="non-conformites"
            ref={reportRef}
            tabIndex={-1}
            className="mt-8 rounded-2xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950 p-6"
            aria-labelledby="non-conformites-titre"
          >
            <h2 id="non-conformites-titre" className="text-xl font-semibold text-amber-900 dark:text-amber-100">
              Non-conformités en cours de traitement
            </h2>
            <p className="mt-2 text-sm text-amber-900 dark:text-amber-100">
              Deux non-conformités sont actuellement suivies sur le périmètre public.
            </p>
            <p className="mt-2 text-sm text-amber-900 dark:text-amber-100">
              État d’avancement: <strong>{auditSummary.remediationStatus}</strong>.
            </p>
            <ul className="mt-4 grid gap-3">
              {currentNonConformities.map((item) => (
                <li key={item.id} className="rounded-xl border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 p-4">
                  <p className="wrap-anywhere text-base font-semibold text-amber-900 dark:text-amber-100">
                    Critère {item.id} · {item.title}
                  </p>
                  <p className="mt-1 wrap-anywhere text-sm text-slate-800 dark:text-slate-200">{item.detail}</p>
                  <p className="mt-2 text-sm text-slate-800 dark:text-slate-200">
                    Pages concernées: <strong>{item.impactedPages}</strong>
                  </p>
                  <p className="mt-2 text-sm text-slate-800 dark:text-slate-200">
                    Statut: <strong>{item.status}</strong>
                  </p>
                </li>
              ))}
            </ul>
          </section>

          <section
            className="mt-8 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm"
            aria-labelledby="methodologie-titre"
          >
            <h2 id="methodologie-titre" className="text-xl font-semibold">
              Technologies, environnement de test et outils
            </h2>
            <p className="mt-2 text-slate-700 dark:text-slate-300">
              Les éléments ci-dessous décrivent la base technique réellement utilisée pour la réalisation du service
              et la campagne d’audit de référence du <strong>8 mars 2026</strong>.
            </p>

            <h3 className="mt-5 text-base font-semibold">Technologies utilisées pour la réalisation du site</h3>
            <ul className="mt-2 list-disc space-y-1 ps-5 text-sm text-slate-700 dark:text-slate-300">
              {implementationTechnologies.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>

            <h3 className="mt-5 text-base font-semibold">Environnement de test de référence</h3>
            <ul className="mt-2 list-disc space-y-1 ps-5 text-sm text-slate-700 dark:text-slate-300">
              {auditEnvironment.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>

            <h3 className="mt-5 text-base font-semibold">Outils utilisés pour évaluer l’accessibilité</h3>
            <ul className="mt-2 list-disc space-y-1 ps-5 text-sm text-slate-700 dark:text-slate-300">
              {accessibilityEvaluationTools.map((item) => (
                <li key={item}>{item}</li>
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
              <li className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-4">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Contact principal</p>
                <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">Aurélien Lewin</p>
              </li>
              <li className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-4">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">E-mail</p>
                <a
                  href="mailto:aurelienlewin@proton.me"
                  className={`mt-1 inline-flex min-h-11 items-center wrap-anywhere underline decoration-2 underline-offset-2 ${focusRingClass}`}
                >
                  aurelienlewin@proton.me
                </a>
              </li>
              <li className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-4">
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
