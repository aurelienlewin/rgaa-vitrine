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
              className={`inline-flex min-h-11 items-center rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-900 dark:text-slate-50 ${focusRingClass}`}
            />
            <a
              href="/"
              className={`inline-flex min-h-11 items-center rounded-xl border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm font-semibold ${focusRingClass}`}
            >
              Retour à l’annuaire
            </a>
            <a
              href="/plan-du-site"
              aria-current={currentPath === '/plan-du-site' ? 'page' : undefined}
              className={`inline-flex min-h-11 items-center rounded-xl border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm font-semibold ${focusRingClass}`}
            >
              Plan du site
            </a>
            <a
              href="/accessibilite"
              aria-current={currentPath === '/accessibilite' ? 'page' : undefined}
              className={`inline-flex min-h-11 items-center rounded-xl border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm font-semibold ${focusRingClass}`}
            >
              Accessibilité
            </a>
            <a
              href="/moderation"
              aria-current={currentPath === '/moderation' ? 'page' : undefined}
              className={`inline-flex min-h-11 items-center rounded-xl border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm font-semibold ${focusRingClass}`}
            >
              Modération
            </a>
          </div>
        </div>
        {description ? <p className="mt-2 max-w-3xl text-slate-700 dark:text-slate-300">{description}</p> : null}
      </div>
    </header>
  )
}

export default SecondaryPageHeader
