import type { ChangeEvent, FormEvent, KeyboardEvent, RefObject } from 'react'
import { focusTargetClass, focusTargetScrollMarginClass } from './hashNavigation'
import { showcaseStatusFilterLabels } from './showcaseFilters'
import type { ShowcaseStatusFilter } from './showcaseFilters'

type GlobalSearchFormProps = {
  id?: string
  inputId?: string
  className?: string
  searchValue?: string
  statusValue?: ShowcaseStatusFilter
  categoryValue?: string
  categoryOptions?: Array<{
    value: string
    label: string
  }>
  searchInputRef?: RefObject<HTMLInputElement | null>
  resultsTargetId?: string
  helperTextId?: string
  helperText?: string
  action?: string
  onSearchChange?: (nextValue: string) => void
  onStatusChange?: (nextValue: ShowcaseStatusFilter) => void
  onCategoryChange?: (nextValue: string) => void
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void
  onReset?: () => void
  onEscapeClear?: () => void
}


function GlobalSearchForm({
  id = 'moteur-recherche-global',
  inputId = 'header-recherche-annuaire',
  className = '',
  searchValue,
  statusValue = 'all',
  categoryValue = 'all',
  categoryOptions = [],
  searchInputRef,
  resultsTargetId,
  helperTextId,
  helperText,
  action = '/',
  onSearchChange,
  onStatusChange,
  onCategoryChange,
  onSubmit,
  onReset,
  onEscapeClear,
}: GlobalSearchFormProps) {
  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    onSearchChange?.(event.target.value)
  }

  const handleStatusChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextValue = event.target.value as ShowcaseStatusFilter
    onStatusChange?.(nextValue)
  }

  const handleCategoryChange = (event: ChangeEvent<HTMLSelectElement>) => {
    onCategoryChange?.(event.target.value)
  }

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape' && onEscapeClear) {
      onEscapeClear()
    }
  }

  const controlsAttributes =
    typeof resultsTargetId === 'string' && resultsTargetId
      ? { 'aria-controls': resultsTargetId }
      : {}

  const describedByAttributes =
    typeof helperTextId === 'string' && helperTextId ? { 'aria-describedby': helperTextId } : {}

  const searchInputValue = searchValue ?? ''
  const searchInputProps = onSearchChange
    ? { value: searchInputValue, onChange: handleSearchChange }
    : { defaultValue: searchInputValue }
  const statusSelectProps = onStatusChange
    ? { value: statusValue, onChange: handleStatusChange }
    : { defaultValue: statusValue }
  const categorySelectProps = onCategoryChange
    ? { value: categoryValue, onChange: handleCategoryChange }
    : { defaultValue: categoryValue }

  return (
    <form
      id={id}
      tabIndex={-1}
      action={action}
      method="get"
      role="search"
      aria-label="Recherche globale dans l’annuaire"
      onSubmit={onSubmit}
      className={`app-global-search-form ui-panel @container mt-6 ${focusTargetScrollMarginClass} ${focusTargetClass} ${className}`.trim()}
    >
      <div className="app-global-search-form__grid grid grid-cols-1 gap-4 @md:grid-cols-2 @lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto_auto] @lg:items-end">
        <div className="app-global-search-form__field app-global-search-form__field--search">
          <label
            htmlFor={inputId}
            className="app-global-search-form__label ui-label"
          >
            Rechercher un site dans l’annuaire
          </label>
          <input
            ref={searchInputRef}
            id={inputId}
            name="recherche"
            type="search"
            placeholder="Titre, URL, catégorie…"
            {...searchInputProps}
            onKeyDown={handleSearchKeyDown}
            {...controlsAttributes}
            {...describedByAttributes}
            className="app-global-search-form__control app-global-search-form__control--search ui-field mt-1"
          />
        </div>
        <div className="app-global-search-form__field app-global-search-form__field--status">
          <label
            htmlFor={`${inputId}-statut`}
            className="app-global-search-form__label ui-label"
          >
            Niveau de conformité
          </label>
          <select
            id={`${inputId}-statut`}
            name="statut"
            {...statusSelectProps}
            {...controlsAttributes}
            className="app-global-search-form__control app-global-search-form__control--status ui-field mt-1"
          >
            {Object.entries(showcaseStatusFilterLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
              ))}
          </select>
        </div>
        <div className="app-global-search-form__field app-global-search-form__field--category">
          <label
            htmlFor={`${inputId}-categorie`}
            className="app-global-search-form__label ui-label"
          >
            Catégorie
          </label>
          <select
            id={`${inputId}-categorie`}
            name="categorie"
            {...categorySelectProps}
            {...controlsAttributes}
            className="app-global-search-form__control app-global-search-form__control--category ui-field mt-1"
          >
            <option value="all">Toutes les catégories</option>
            {categoryOptions.map((categoryOption) => (
              <option key={categoryOption.value} value={categoryOption.value}>
                {categoryOption.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="app-global-search-form__button app-global-search-form__button--submit ui-button ui-button-primary"
        >
          Rechercher
        </button>
        <button
          type={onReset ? 'button' : 'reset'}
          onClick={onReset}
          className="app-global-search-form__button app-global-search-form__button--reset ui-button ui-button-secondary"
        >
          Réinitialiser
        </button>
      </div>
      {helperTextId && helperText ? (
        <p
          id={helperTextId}
          className="app-global-search-form__helper ui-muted mt-3 text-sm"
        >
          {helperText}
        </p>
      ) : null}
    </form>
  )
}

export default GlobalSearchForm
