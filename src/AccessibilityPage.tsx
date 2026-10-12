import { useCallback, useEffect, useRef } from 'react'
import type { MouseEvent as ReactMouseEvent, RefObject } from 'react'
import { applySeo, createAbsoluteUrl } from './seo'
import {
  focusElementWithScroll,
  focusTargetClass,
  focusTargetScrollMarginClass,
  useHashTargetFocus,
} from './hashNavigation'
import SecondaryPageHeader from './SecondaryPageHeader'
import SiteFooter from './SiteFooter'
import {
  accessibilityAuditEnvironment,
  accessibilityAuditSummary as auditSummary,
  accessibilityEvaluationTools,
  accessibilityImplementationTechnologies as implementationTechnologies,
  accessibilityNonConformities as currentNonConformities,
  accessibilityResolvedNonConformities as resolvedNonConformities,
} from '../shared/accessibilityStatement.js'

const focusRingClass =
  'focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-brand-focus'
const skipLinksContainerClass =
  'fixed start-2 top-2 z-60 flex max-w-[calc(100vw-1rem)] -translate-y-[120%] flex-col items-start gap-2 transition-transform duration-150 motion-reduce:transition-none focus-within:translate-y-0 hover:translate-y-0 sm:start-4 sm:top-4 sm:max-w-none'
const skipLinkClass = `inline-flex min-h-11 items-center rounded-lg border border-slate-900 bg-slate-950 px-3 py-2 text-slate-50 underline decoration-2 underline-offset-2 shadow-lg dark:border-slate-50 dark:bg-slate-50 dark:text-slate-950 ${focusRingClass}`

function readAuditedPageLabel(pageUrl: string) {
  try {
    const parsedUrl = new URL(pageUrl)
    if (parsedUrl.pathname === '/') {
      return 'Accueil'
    }
    if (parsedUrl.pathname === '/plan-du-site') {
      return 'Plan du site'
    }
    if (parsedUrl.pathname === '/accessibilite') {
      return 'Déclaration d’accessibilité'
    }
    if (parsedUrl.pathname.startsWith('/domaine/')) {
      return 'Page domaine multi-sites'
    }
    if (parsedUrl.pathname.startsWith('/site/')) {
      return 'Fiche site référencé'
    }
    return `Page ${parsedUrl.pathname}`
  } catch {
    return 'Page auditée'
  }
}

function AccessibilityPage() {
  const mainRef = useRef<HTMLElement | null>(null)
  const navigationRef = useRef<HTMLElement | null>(null)
  const reportRef = useRef<HTMLElement | null>(null)
  const contactRef = useRef<HTMLElement | null>(null)
  const legalRef = useRef<HTMLElement | null>(null)
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
  useHashTargetFocus(focusElement)

  return (
    <>
      <nav
        className={skipLinksContainerClass}
        aria-label="Liens d’évitement"
      >
        <a href="#contenu-accessibilite" className={skipLinkClass} onClick={(event) => handleSkipLinkClick(event, mainRef)}>
          Aller au contenu
        </a>
        <a href="#navigation-principale" className={skipLinkClass} onClick={(event) => handleSkipLinkClick(event, navigationRef)}>
          Aller à la navigation principale
        </a>
        <a href="#moteur-recherche-global" className={skipLinkClass}>
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
      </nav>

      <div className="min-h-screen bg-white text-brand-ink">
        <SecondaryPageHeader
          title="Déclaration d’accessibilité"
          navigationRef={navigationRef}
          description={
            <>
              Cette déclaration s’applique au site{' '}
              <a href="https://www.annuaire-rgaa.fr/" className="font-semibold">
                www.annuaire-rgaa.fr
              </a>{' '}
              et couvre les exigences du Référentiel général d’amélioration de l’accessibilité (RGAA).
            </>
          }
          currentPath="/accessibilite"
        />

        <main
          id="contenu-accessibilite"
          ref={mainRef}
          tabIndex={-1}
          className={`ui-container space-y-12 py-10 ${focusTargetScrollMarginClass} ${focusTargetClass}`}
        >
          <section aria-labelledby="etat-titre">
            <h2 id="etat-titre" className="ui-section-title">
              État actuel
            </h2>
            <div className="ui-panel ui-prose mt-4">
              <dl className="grid gap-2">
                <div className="flex flex-wrap gap-x-2">
                  <dt className="font-bold">État de conformité :</dt>
                  <dd className="m-0">{auditSummary.status}</dd>
                </div>
                <div className="flex flex-wrap gap-x-2">
                  <dt className="font-bold">Taux estimé :</dt>
                  <dd className="m-0">{auditSummary.score}</dd>
                </div>
              </dl>
            </div>
            <div className="ui-prose mt-4 space-y-3">
              <p>
                Audit de référence réalisé le <strong>{auditSummary.auditDate}</strong> sur la version en production
                auditée à la date du contrôle ({auditSummary.scope}).
              </p>
              <ul className="list-disc space-y-1 ps-5">
                {auditSummary.auditedPages.map((pageUrl) => (
                  <li key={pageUrl} className="wrap-anywhere">
                    Page auditée : <a href={pageUrl}>{readAuditedPageLabel(pageUrl)}</a>
                  </li>
                ))}
              </ul>
              <p>{auditSummary.applicableCriteria}.</p>
              <p>Non-conformités en cours : {auditSummary.nonConformitiesCount}.</p>
              <p className="ui-muted">
                Échantillon couvrant l’accueil, une page domaine multi-sites, une fiche site, le plan du site et la
                déclaration d’accessibilité.
              </p>
            </div>
          </section>

          <section
            id="non-conformites"
            ref={reportRef}
            tabIndex={-1}
            className={`${focusTargetScrollMarginClass} ${focusTargetClass}`}
            aria-labelledby="non-conformites-titre"
          >
            <h2 id="non-conformites-titre" className="ui-section-title">
              {auditSummary.nonConformitiesTotal > 0 ? 'Non-conformités en cours de traitement' : 'Non-conformités'}
            </h2>
            <div className="ui-prose mt-4 space-y-3">
              <p>
                {auditSummary.nonConformitiesTotal > 0
                  ? `${auditSummary.nonConformitiesTotal} non-conformité(s) issues de l’audit de référence restent suivies jusqu’au recontrôle.`
                  : `Aucune non-conformité relevée lors de l’audit du ${auditSummary.auditDate} (${auditSummary.applicableCriteria}).`}
              </p>
              <p>
                État d’avancement : <strong>{auditSummary.remediationStatus}</strong>
              </p>
            </div>
            {resolvedNonConformities.length > 0 ? (
              <>
                <h3 className="mt-6 text-lg font-bold">Non-conformités levées depuis l’audit précédent</h3>
                <ul className="ui-prose mt-3 list-none space-y-4 p-0">
                  {resolvedNonConformities.map((item) => (
                    <li key={item.id} className="border-t border-slate-200 pt-3">
                      <p className="font-bold">
                        Critère {item.id} · {item.title}
                      </p>
                      <p className="mt-1 wrap-anywhere text-slate-800">{item.detail}</p>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
            <ul className="ui-prose mt-6 list-none space-y-6 p-0 empty:hidden">
              {currentNonConformities.map((item) => (
                <li key={item.id} className="border-t border-slate-200 pt-4">
                  <h3 className="wrap-anywhere text-lg font-bold text-slate-900">
                    Critère {item.id} · {item.title}
                  </h3>
                  <p className="mt-1 wrap-anywhere text-slate-800">{item.detail}</p>
                  <dl className="ui-meta mt-2">
                    <div>
                      <dt>Pages concernées :</dt>
                      <dd className="wrap-anywhere">{item.impactedPages}</dd>
                    </div>
                    <div>
                      <dt>Statut :</dt>
                      <dd>{item.status}</dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="methodologie-titre">
            <h2 id="methodologie-titre" className="ui-section-title">
              Technologies, environnement de test et outils
            </h2>
            <p className="ui-prose mt-4">
              Les éléments suivants décrivent la base technique réellement utilisée pour la réalisation du service
              et la campagne d’audit de référence du <strong>{auditSummary.auditDate}</strong>.
            </p>

            <h3 className="mt-6 text-lg font-bold">Technologies utilisées pour la réalisation du site</h3>
            <ul className="ui-prose mt-2 list-disc space-y-1 ps-5">
              {implementationTechnologies.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>

            <h3 className="mt-6 text-lg font-bold">Environnement de test de référence</h3>
            <ul className="ui-prose mt-2 list-disc space-y-1 ps-5">
              {accessibilityAuditEnvironment.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>

            <h3 className="mt-6 text-lg font-bold">Outils utilisés pour évaluer l’accessibilité</h3>
            <ul className="ui-prose mt-2 list-disc space-y-1 ps-5">
              {accessibilityEvaluationTools.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section
            id="contact-accessibilite"
            ref={contactRef}
            tabIndex={-1}
            className={`${focusTargetScrollMarginClass} ${focusTargetClass}`}
            aria-labelledby="contact-titre"
          >
            <h2 id="contact-titre" className="ui-section-title">
              Retour d’information et contact
            </h2>
            <div className="ui-prose mt-4 space-y-3">
              <p>
                Si vous ne parvenez pas à accéder à un contenu ou à une fonctionnalité, contactez le responsable du
                site pour obtenir une alternative accessible.
              </p>
              <p className="ui-muted">
                Les scores publiés dans l’annuaire sont déclarés par les organismes qui soumettent leur site. Ils sont
                affichés à titre informatif et peuvent être réévalués sur demande motivée auprès de la modération.
              </p>
            </div>
            <dl className="ui-prose mt-4 grid gap-3">
              <div>
                <dt className="font-bold">Contact principal</dt>
                <dd className="m-0">Aurélien Lewin</dd>
              </div>
              <div>
                <dt className="font-bold">E-mail</dt>
                <dd className="m-0">
                  <a href="mailto:aurelienlewin@proton.me" className="ui-action-link wrap-anywhere">
                    aurelienlewin@proton.me
                  </a>
                </dd>
              </div>
              <div>
                <dt className="font-bold">Profil public</dt>
                <dd className="m-0">
                  <a
                    href="https://github.com/aurelienlewin"
                    target="_blank"
                    rel="noreferrer noopener"
                    className="ui-action-link wrap-anywhere"
                  >
                    Profil GitHub d’Aurélien Lewin (nouvel onglet)
                  </a>
                </dd>
              </div>
            </dl>
          </section>

          <section
            id="voies-recours"
            ref={legalRef}
            tabIndex={-1}
            className={`${focusTargetScrollMarginClass} ${focusTargetClass}`}
            aria-labelledby="recours-titre"
          >
            <h2 id="recours-titre" className="ui-section-title">
              Voies de recours
            </h2>
            <p className="ui-prose mt-4">
              Si vous constatez un défaut d’accessibilité bloquant et que vous n’obtenez pas de réponse satisfaisante
              après contact, vous pouvez saisir le Défenseur des droits.
            </p>
            <ul className="ui-prose mt-4 list-disc space-y-1 ps-5">
              <li>
                Formulaire en ligne :{' '}
                <a
                  href="https://formulaire.defenseurdesdroits.fr/"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="ui-action-link wrap-anywhere"
                >
                  Formulaire du Défenseur des droits (nouvel onglet)
                </a>
              </li>
              <li>Courrier : Défenseur des droits, Libre réponse 71120, 75342 Paris CEDEX 07.</li>
              <li>
                Téléphone :{' '}
                <a href="tel:+33153732900" className="ui-action-link">
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
