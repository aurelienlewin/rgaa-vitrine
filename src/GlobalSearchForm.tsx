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

const focusRingClass =
  'focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-brand-focus'

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
      className={`app-global-search-form @container mt-4 ${focusTargetScrollMarginClass} rounded-2xl border border-slate-600 dark:border-slate-500 bg-slate-50 dark:bg-slate-800 p-4 text-slate-950 dark:text-slate-50 shadow-sm ${focusTargetClass} ${className}`.trim()}
    >
      <div className="app-global-search-form__grid grid grid-cols-1 gap-4 @md:grid-cols-2 @lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto_auto] @lg:items-end">
        <div className="app-global-search-form__field app-global-search-form__field--search">
          <label
            htmlFor={inputId}
            className="app-global-search-form__label block bg-slate-50 dark:bg-slate-800 text-sm font-semibold text-slate-900 dark:text-slate-50"
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
            className={`app-global-search-form__control app-global-search-form__control--search mt-1 min-h-11 w-full rounded-xl border border-slate-700 dark:border-slate-400 bg-white dark:bg-slate-900 px-3 py-2 text-base text-slate-900 dark:text-slate-50 shadow-sm ${focusRingClass}`}
          />
        </div>
        <div className="app-global-search-form__field app-global-search-form__field--status">
          <label
            htmlFor={`${inputId}-statut`}
            className="app-global-search-form__label block bg-slate-50 dark:bg-slate-800 text-sm font-semibold text-slate-900 dark:text-slate-50"
          >
            Niveau de conformité
          </label>
          <select
            id={`${inputId}-statut`}
            name="statut"
            {...statusSelectProps}
            {...controlsAttributes}
            className={`app-global-search-form__control app-global-search-form__control--status mt-1 min-h-11 w-full rounded-xl border border-slate-700 dark:border-slate-400 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-50 shadow-sm ${focusRingClass}`}
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
            className="app-global-search-form__label block bg-slate-50 dark:bg-slate-800 text-sm font-semibold text-slate-900 dark:text-slate-50"
          >
            Catégorie
          </label>
          <select
            id={`${inputId}-categorie`}
            name="categorie"
            {...categorySelectProps}
            {...controlsAttributes}
            className={`app-global-search-form__control app-global-search-form__control--category mt-1 min-h-11 w-full rounded-xl border border-slate-700 dark:border-slate-400 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-50 shadow-sm ${focusRingClass}`}
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
          className={`app-global-search-form__button app-global-search-form__button--submit min-h-11 rounded-xl border border-slate-950 dark:border-slate-50 bg-slate-950 dark:bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-50 dark:text-slate-950 hover:bg-slate-800 dark:hover:bg-slate-200 ${focusRingClass}`}
        >
          Rechercher
        </button>
        <button
          type={onReset ? 'button' : 'reset'}
          onClick={onReset}
          className={`app-global-search-form__button app-global-search-form__button--reset min-h-11 rounded-xl border border-slate-700 dark:border-slate-300 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-900 dark:text-slate-50 hover:bg-slate-100 dark:hover:bg-slate-800 ${focusRingClass}`}
        >
          Réinitialiser
        </button>
      </div>
      {helperTextId && helperText ? (
        <p
          id={helperTextId}
          className="app-global-search-form__helper mt-3 text-sm text-slate-700 dark:text-slate-300"
        >
          {helperText}
        </p>
      ) : null}
    </form>
  )
}

export default GlobalSearchForm
