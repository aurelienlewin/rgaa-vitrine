import type { RefObject } from 'react'
import { focusTargetClass, focusTargetScrollMarginClass } from './hashNavigation'

type SiteFooterProps = {
  id?: string
  footerRef?: RefObject<HTMLElement | null>
  helpHref?: string
}

const githubProfile = {
  name: 'Aurélien Lewin',
  login: 'aurelienlewin',
  avatarUrl: '/avatar-aurelien-lewin.png',
  profileUrl: 'https://github.com/aurelienlewin',
}

const supportProfile = {
  koFiUrl: 'https://ko-fi.com/aurelienlewin',
}

const buildVersion = import.meta.env.VITE_BUILD_VERSION ?? '0.0.0'
const buildTimestampRaw = import.meta.env.VITE_BUILD_TIMESTAMP ?? 'unknown'
const buildTimestampDisplay =
  buildTimestampRaw !== 'unknown'
    ? buildTimestampRaw.replace('T', ' à ').replace('Z', ' (heure UTC)')
    : 'date technique indisponible'

const footerLabelClass = 'text-sm font-bold text-slate-900'

function SiteFooter({ id = 'pied-page', footerRef, helpHref = '/#aide-accessibilite' }: SiteFooterProps) {
  return (
    <footer
      id={id}
      ref={footerRef}
      tabIndex={-1}
      role="contentinfo"
      className={`mt-12 ${focusTargetScrollMarginClass} border-t border-slate-200 bg-white ${focusTargetClass}`}
      aria-label="Informations de bas de page"
    >
      <div className="ui-container ui-grid py-10 text-slate-800">
        <section className="ui-span-4">
          <p className={footerLabelClass}>Projet</p>
          <div className="mt-2 flex items-center gap-3">
            <img
              src={githubProfile.avatarUrl}
              alt={`Avatar GitHub de ${githubProfile.name}`}
              width={32}
              height={32}
              className="h-8 w-8 rounded-full"
              loading="lazy"
            />
            <p className="ui-small">
              Créé et maintenu par{' '}
              <a href={githubProfile.profileUrl} target="_blank" rel="noreferrer noopener">
                {githubProfile.name} (@{githubProfile.login}) (nouvel onglet)
              </a>
            </p>
          </div>
        </section>

        <nav aria-label="Navigation rapide du pied de page" className="ui-span-4">
          <p className={footerLabelClass}>Navigation rapide</p>
          <ul className="ui-small mt-1">
            <li>
              <a href="/#moteur-recherche-global" className="ui-action-link">
                Recherche annuaire
              </a>
            </li>
            <li>
              <a href={helpHref} className="ui-action-link">
                Aide accessibilité
              </a>
            </li>
            <li>
              <a href="/plan-du-site" className="ui-action-link">
                Plan du site
              </a>
            </li>
            <li>
              <a href="/accessibilite" className="ui-action-link">
                Accessibilité
              </a>
            </li>
            <li>
              <a href="/moderation" className="ui-action-link">
                Modération
              </a>
            </li>
          </ul>
        </nav>

        <section className="ui-span-4">
          <p className={footerLabelClass}>Soutien</p>
          <p className="ui-small mt-2">
            J’ai lancé cet annuaire pour que le RGAA ne reste pas un sigle, mais une promesse tenue à chaque
            personne. Quand l’empathie guide les choix, l’activité progresse et l’équité devient concrète.
          </p>
          <p className="ui-small mt-2">
            Le score est une boussole, pas la destination: la priorité reste de libérer les parcours et l’usage.
          </p>
          <a
            href={supportProfile.koFiUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="ui-action-link ui-small"
          >
            M’offrir un café via Ko-fi (nouvel onglet)
          </a>
        </section>
        <p className="ui-span-full ui-small ui-muted border-t border-slate-200 pt-4">
          Version publique {buildVersion} · générée le {buildTimestampDisplay}
        </p>
      </div>
    </footer>
  )
}

export default SiteFooter
