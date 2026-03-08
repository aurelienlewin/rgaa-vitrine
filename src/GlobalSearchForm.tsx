type GlobalSearchFormProps = {
  id?: string
  inputId?: string
  className?: string
}

const focusRingClass =
  'focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-brand-focus'

function GlobalSearchForm({
  id = 'moteur-recherche-global',
  inputId = 'header-recherche-annuaire',
  className = '',
}: GlobalSearchFormProps) {
  return (
    <form
      id={id}
      action="/"
      method="get"
      role="search"
      aria-label="Recherche globale dans l’annuaire"
      className={`@container mt-4 rounded-2xl border border-slate-600 dark:border-slate-500 bg-slate-50 dark:bg-slate-800 p-4 shadow-sm ${className}`.trim()}
    >
      <div className="grid grid-cols-1 gap-3 @lg:grid-cols-[minmax(0,1fr)_auto] @lg:items-end">
        <div>
          <label
            htmlFor={inputId}
            className="block bg-transparent text-sm font-semibold text-slate-900 dark:text-slate-50"
          >
            Rechercher un site dans l’annuaire
          </label>
          <input
            id={inputId}
            name="recherche"
            type="search"
            placeholder="Titre, URL, catégorie…"
            className={`mt-1 min-h-11 w-full rounded-xl border border-slate-700 dark:border-slate-400 bg-transparent px-3 py-2 text-base text-slate-900 dark:text-slate-50 shadow-sm ${focusRingClass}`}
          />
        </div>
        <button
          type="submit"
          className={`min-h-11 rounded-xl border border-slate-950 dark:border-slate-50 bg-slate-950 dark:bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-50 dark:text-slate-950 hover:bg-slate-800 dark:hover:bg-slate-200 ${focusRingClass}`}
        >
          Rechercher
        </button>
      </div>
    </form>
  )
}

export default GlobalSearchForm
