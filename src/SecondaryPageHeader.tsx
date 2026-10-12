import { useCallback, useMemo } from 'react'
import type { ReactNode } from 'react'
import type { RefObject } from 'react'
import GlobalSearchForm from './GlobalSearchForm'
import SiteHeaderBar from './SiteHeaderBar'
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
    <header className="app-secondary-header bg-white text-slate-950">
      <SiteHeaderBar currentPath={currentPath} navRef={navigationRef} />
      <div className="border-b border-slate-200">
      <div className="app-secondary-header__inner ui-container ui-page-intro">
        <div className="ui-grid">
          <div className="app-secondary-header__top ui-span-8">
            <h1 className="app-secondary-header__title ui-h1">{title}</h1>
            {description ? (
              <p className="app-secondary-header__description ui-lead mt-3">{description}</p>
            ) : null}
          </div>
        </div>
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
        <p className="app-secondary-header__glossary ui-small ui-muted mt-3">
          Glossaire : RGAA = Référentiel général d’amélioration de l’accessibilité, WCAG = <span lang="en">Web Content Accessibility Guidelines</span>, UX = expérience utilisateur.
        </p>
      </div>
      </div>
    </header>
  )
}

export default SecondaryPageHeader
