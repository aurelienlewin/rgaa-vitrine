import type { ReactNode } from 'react'
import ThemeToggle from './ThemeToggle'

type SecondaryPageHeaderProps = {
  title: string
  description?: ReactNode
  currentPath?: '/plan-du-site' | '/accessibilite' | '/moderation' | null
}

const focusRingClass =
  'focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-brand-focus'

function SecondaryPageHeader({ title, description, currentPath = null }: SecondaryPageHeaderProps) {
  return (
    <header className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">{title}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <ThemeToggle
              className={`inline-flex min-h-11 items-center rounded-xl border border-slate-600 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-900 dark:text-slate-50 ${focusRingClass}`}
            />
            <a
              href="/"
              className={`inline-flex min-h-11 items-center rounded-xl border border-slate-600 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-900 dark:text-slate-50 ${focusRingClass}`}
            >
              Retour à l’annuaire
            </a>
            <a
              href="/#filtres-annuaire"
              className={`inline-flex min-h-11 items-center rounded-xl border border-slate-600 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-900 dark:text-slate-50 ${focusRingClass}`}
            >
              Recherche annuaire
            </a>
            <a
              href="/plan-du-site"
              aria-current={currentPath === '/plan-du-site' ? 'page' : undefined}
              className={`inline-flex min-h-11 items-center rounded-xl border border-slate-600 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-900 dark:text-slate-50 ${focusRingClass}`}
            >
              Plan du site
            </a>
            <a
              href="/accessibilite"
              aria-current={currentPath === '/accessibilite' ? 'page' : undefined}
              className={`inline-flex min-h-11 items-center rounded-xl border border-slate-600 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-900 dark:text-slate-50 ${focusRingClass}`}
            >
              Accessibilité
            </a>
            <a
              href="/moderation"
              aria-current={currentPath === '/moderation' ? 'page' : undefined}
              className={`inline-flex min-h-11 items-center rounded-xl border border-slate-600 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-900 dark:text-slate-50 ${focusRingClass}`}
            >
              Modération
            </a>
          </div>
        </div>
        <form
          action="/"
          method="get"
          role="search"
          aria-label="Recherche globale dans l’annuaire"
          className="mt-4 grid gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 p-3 sm:grid-cols-[minmax(0,1fr)_auto]"
        >
          <label htmlFor="header-recherche-annuaire" className="text-sm font-semibold text-slate-900 dark:text-slate-50 sm:col-span-2">
            Rechercher un site dans l’annuaire
          </label>
          <input
            id="header-recherche-annuaire"
            name="recherche"
            type="search"
            placeholder="Titre, URL, catégorie…"
            className={`min-h-11 rounded-xl border border-slate-600 dark:border-slate-600 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-50 ${focusRingClass}`}
          />
          <button
            type="submit"
            className={`min-h-11 rounded-xl border border-slate-950 dark:border-slate-50 bg-slate-950 dark:bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-50 dark:text-slate-950 ${focusRingClass}`}
          >
            Rechercher
          </button>
        </form>
        {description ? <p className="mt-2 max-w-3xl text-slate-700 dark:text-slate-300">{description}</p> : null}
        <p className="mt-2 text-xs text-slate-700 dark:text-slate-300">
          Glossaire: RGAA = Référentiel général d’amélioration de l’accessibilité, WCAG = Web Content Accessibility
          Guidelines, UX = expérience utilisateur.
        </p>
      </div>
    </header>
  )
}

export default SecondaryPageHeader
