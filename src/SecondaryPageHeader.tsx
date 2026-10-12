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
    <header className="app-secondary-header border-b border-slate-200 bg-white text-slate-950">
      <div className="ui-container py-4">
        <PrimaryNavigation
          currentPath={currentPath === null ? null : currentPath}
          navRef={navigationRef}
          className="app-secondary-nav"
          listClassName="app-secondary-nav__list ui-nav-list"
          linkClassName="app-secondary-nav__link ui-nav-link"
        />
      </div>
      <div className="app-secondary-header__inner ui-container pb-8 pt-4">
        <div className="app-secondary-header__top">
          <h1 className="app-secondary-header__title text-3xl font-bold tracking-tight">{title}</h1>
        </div>
        {description ? (
          <p className="app-secondary-header__description ui-prose ui-muted mt-2">{description}</p>
        ) : null}
        <GlobalSearchForm
          inputId="header-recherche-annuaire"
          searchValue={defaultSearchValues.searchQuery}
          statusValue={defaultSearchValues.statusFilter}
          categoryValue={defaultSearchValues.categoryFilter}
          categoryOptions={showcaseCategories.map((category) => ({ value: category, label: formatCategory(category) }))}
          onReset={handleResetSearch}
          helperTextId="header-recherche-aide"
          helperText="Astuce clavier : appuyez sur Échap dans le champ recherche pour effacer la saisie."
        />
        <p className="app-secondary-header__glossary ui-muted mt-3 text-sm">
          Glossaire : RGAA = Référentiel général d’amélioration de l’accessibilité, WCAG = <span lang="en">Web Content Accessibility Guidelines</span>, UX = expérience utilisateur.
        </p>
      </div>
    </header>
  )
}

export default SecondaryPageHeader
