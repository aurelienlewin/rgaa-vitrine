import { useCallback, useMemo } from 'react'
import type { ReactNode } from 'react'
import type { RefObject } from 'react'
import GlobalSearchForm from './GlobalSearchForm'
import PrimaryNavigation from './PrimaryNavigation'
import { formatCategory, readStatusFilterFromQuery, showcaseCategories } from './showcaseFilters'

type SecondaryPageHeaderProps = {
  title: string
  description?: ReactNode
  currentPath?: '/plan-du-site' | '/accessibilite' | '/moderation' | null
  navigationRef?: RefObject<HTMLElement | null>
}

const focusRingClass =
  'focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-brand-focus'

function SecondaryPageHeader({
  title,
  description,
  currentPath = null,
  navigationRef,
}: SecondaryPageHeaderProps) {
  const defaultSearchValues = useMemo(() => {
    const params =
      typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams('')
    const requestedCategory = params.get('categorie') ?? ''
    const hasKnownCategory = showcaseCategories.includes(requestedCategory)

    return {
      searchQuery: (params.get('recherche') ?? '').slice(0, 120),
      statusFilter: readStatusFilterFromQuery(params.get('statut')),
      categoryFilter: hasKnownCategory ? requestedCategory : 'all',
    }
  }, [])

  const handleResetSearch = useCallback(() => {
    window.location.assign('/')
  }, [])

  return (
    <header className="app-secondary-header border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-950 dark:text-slate-50">
      <div className="app-secondary-header__inner mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="app-secondary-header__top flex flex-wrap items-center gap-3">
          <h1 className="app-secondary-header__title text-2xl font-bold">{title}</h1>
        </div>
        <PrimaryNavigation
          currentPath={currentPath === null ? null : currentPath}
          navRef={navigationRef}
          className="app-secondary-nav mt-4"
          listClassName="app-secondary-nav__list flex flex-wrap items-center gap-2"
          linkClassName={`app-secondary-nav__link inline-flex min-h-11 items-center rounded-xl border border-slate-600 dark:border-slate-500 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-900 dark:text-slate-50 hover:bg-slate-100 dark:hover:bg-slate-800 ${focusRingClass}`}
        />
        <GlobalSearchForm
          inputId="header-recherche-annuaire"
          searchValue={defaultSearchValues.searchQuery}
          statusValue={defaultSearchValues.statusFilter}
          categoryValue={defaultSearchValues.categoryFilter}
          categoryOptions={showcaseCategories.map((category) => ({ value: category, label: formatCategory(category) }))}
          onReset={handleResetSearch}
          helperTextId="header-recherche-aide"
          helperText="Astuce clavier: appuyez sur Échap dans le champ recherche pour effacer la saisie."
        />
        {description ? (
          <p className="app-secondary-header__description mt-2 max-w-3xl text-slate-700 dark:text-slate-300">
            {description}
          </p>
        ) : null}
        <p className="app-secondary-header__glossary mt-2 text-sm text-slate-700 dark:text-slate-300">
          Glossaire: RGAA = Référentiel général d’amélioration de l’accessibilité, WCAG = Web Content Accessibility
          Guidelines, UX = expérience utilisateur.
        </p>
      </div>
    </header>
  )
}

export default SecondaryPageHeader
