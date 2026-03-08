import type { RefObject } from 'react'

type SiteFooterProps = {
  id?: string
  footerRef?: RefObject<HTMLElement | null>
  helpHref?: string
}

const githubProfile = {
  name: 'Aurélien Lewin',
  login: 'aurelienlewin',
  avatarUrl: 'https://avatars.githubusercontent.com/u/45093822?v=4',
  profileUrl: 'https://github.com/aurelienlewin',
}

const supportProfile = {
  buyMeACoffeeUrl: 'https://buymeacoffee.com/aurelienlewin',
}

const buildVersion = import.meta.env.VITE_BUILD_VERSION ?? '0.0.0'
const buildTimestampRaw = import.meta.env.VITE_BUILD_TIMESTAMP ?? 'unknown'
const buildTimestampDisplay =
  buildTimestampRaw !== 'unknown' ? buildTimestampRaw.replace('T', ' ').replace('Z', ' UTC') : buildTimestampRaw

const focusRingClass =
  'focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-brand-focus'

function SiteFooter({ id = 'pied-page', footerRef, helpHref = '/#aide-accessibilite' }: SiteFooterProps) {
  return (
    <footer
      id={id}
      ref={footerRef}
      tabIndex={-1}
      role="contentinfo"
      className="mt-12 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
      aria-label="Informations de bas de page"
    >
      <div className="mx-auto grid max-w-5xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[1.4fr_1fr_1fr] lg:py-8 lg:px-8">
        <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-4">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
            Projet
          </p>
          <div className="mt-3 flex items-center gap-3">
            <img
              src={githubProfile.avatarUrl}
              alt={`Avatar GitHub de ${githubProfile.name}`}
              className="h-12 w-12 rounded-full border border-slate-300 dark:border-slate-600"
              loading="lazy"
              referrerPolicy="no-referrer"
            />
            <p className="text-sm text-slate-800 dark:text-slate-200">
              Créé et maintenu par{' '}
              <a
                href={githubProfile.profileUrl}
                target="_blank"
                rel="noreferrer noopener"
                className={`font-semibold underline ${focusRingClass}`}
              >
                {githubProfile.name} (@{githubProfile.login})
              </a>
            </p>
          </div>
        </section>

        <nav
          className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-4"
          aria-label="Navigation rapide du pied de page"
        >
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
            Navigation rapide
          </p>
          <ul className="mt-3 grid gap-2">
            <li>
              <a
                href="/#moteur-recherche-global"
                className={`inline-flex min-h-11 items-center rounded-xl border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm font-semibold text-slate-900 dark:text-slate-50 ${focusRingClass}`}
              >
                Recherche annuaire
              </a>
            </li>
            <li>
              <a
                href={helpHref}
                className={`inline-flex min-h-11 items-center rounded-xl border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm font-semibold text-slate-900 dark:text-slate-50 ${focusRingClass}`}
              >
                Aide accessibilité
              </a>
            </li>
            <li>
              <a
                href="/plan-du-site"
                className={`inline-flex min-h-11 items-center rounded-xl border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm font-semibold text-slate-900 dark:text-slate-50 ${focusRingClass}`}
              >
                Plan du site
              </a>
            </li>
            <li>
              <a
                href="/accessibilite"
                className={`inline-flex min-h-11 items-center rounded-xl border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm font-semibold text-slate-900 dark:text-slate-50 ${focusRingClass}`}
              >
                Accessibilité
              </a>
            </li>
            <li>
              <a
                href="/moderation"
                className={`inline-flex min-h-11 items-center rounded-xl border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm font-semibold text-slate-900 dark:text-slate-50 ${focusRingClass}`}
              >
                Modération
              </a>
            </li>
          </ul>
        </nav>

        <section className="rounded-2xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950 p-4">
          <p className="text-sm font-semibold uppercase tracking-wide text-amber-900 dark:text-amber-100">
            Soutien
          </p>
          <p className="mt-3 text-sm text-amber-900 dark:text-amber-100">
            J’ai lancé cet annuaire pour que le RGAA ne reste pas un sigle, mais une promesse tenue à chaque
            personne. Quand l’empathie guide les choix, l’activité progresse et l’équité devient concrète.
          </p>
          <p className="mt-3 text-sm font-semibold text-amber-900 dark:text-amber-100">
            Le score est une boussole, pas la destination: la priorité reste de libérer les parcours et l’usage.
          </p>
          <a
            href={supportProfile.buyMeACoffeeUrl}
            target="_blank"
            rel="noreferrer noopener"
            className={`mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl border border-amber-900 dark:border-amber-100 bg-transparent px-4 py-2 text-sm font-semibold text-amber-900 dark:text-amber-100 ${focusRingClass}`}
            aria-label="M’offrir un café via Buy Me a Coffee"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-current">
              <path d="M3 5h14a1 1 0 0 1 1 1v2h2a2 2 0 0 1 2 2v1a4 4 0 0 1-4 4h-1.1a5 5 0 0 1-4.9 4H8a5 5 0 0 1-5-5V6a1 1 0 0 1 1-1Zm15 8h1a2 2 0 0 0 2-2v-1h-3v3Zm-4 6a1 1 0 1 1 0 2H7a1 1 0 1 1 0-2h7Z" />
            </svg>
            M’offrir un café
          </a>
          <p
            className="mt-3 text-sm text-slate-700 dark:text-slate-200"
            aria-label={`Version ${buildVersion}, build ${buildTimestampDisplay}`}
          >
            v{buildVersion} · {buildTimestampDisplay}
          </p>
        </section>
      </div>
    </footer>
  )
}

export default SiteFooter
