import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'

type ComplianceStatus = 'full' | 'partial' | 'none' | null

type ShowcaseEntry = {
  normalizedUrl: string
  siteTitle: string
  thumbnailUrl: string | null
  accessibilityPageUrl: string | null
  complianceStatus: ComplianceStatus
  complianceStatusLabel: string | null
  complianceScore: number | null
  updatedAt: string
  category: string
}

type ShowcaseStatusFilter = 'all' | Exclude<ComplianceStatus, null>

const statusClassByValue: Record<Exclude<ComplianceStatus, null>, string> = {
  full: 'bg-emerald-100 text-emerald-900',
  partial: 'bg-amber-100 text-amber-900',
  none: 'bg-rose-100 text-rose-900',
}

const showcaseCategories = [
  'Administration',
  'E-commerce',
  'Media',
  'Sante',
  'Education',
  'Associatif',
  'Autre',
]

const categoryLabels: Record<string, string> = {
  Administration: 'Administration',
  'E-commerce': 'E-commerce',
  Media: 'Média',
  Sante: 'Santé',
  Education: 'Éducation',
  Associatif: 'Associatif',
  Autre: 'Autre',
}

const showcaseStatusFilterLabels: Record<ShowcaseStatusFilter, string> = {
  all: 'Tous les niveaux',
  full: 'Totalement conforme',
  partial: 'Partiellement conforme',
  none: 'Non conforme',
}

const officialResources = [
  {
    label: 'Article : RGAA 5 arrive fin 2026 (État)',
    url: 'https://design.numerique.gouv.fr/articles/2026-03-02-rgaa5/',
  },
  {
    label: 'Guide du développeur RGAA',
    url: 'https://disic.github.io/guide-developpeur/',
  },
  {
    label: "Guide de l'intégrateur RGAA",
    url: 'https://disic.github.io/guide-integrateur/',
  },
  {
    label: 'Mémo dev',
    url: 'https://design.numerique.gouv.fr/outils/memo-dev/',
  },
  {
    label: 'Checklist dev',
    url: 'https://design.numerique.gouv.fr/outils/checklist-dev/',
  },
  {
    label: 'Bibliothèque de référence ARIA',
    url: 'https://www.info.gouv.fr/accessibilite/developpement/bibliotheque-de-reference-des-restitutions-des-composants-javascript-aria',
  },
  {
    label: 'Guide des composants JavaScript accessibles',
    url: 'https://www.info.gouv.fr/accessibilite/developpement/le-guide-des-composants-javascript-accessibles',
  },
]

const wcagResources = [
  {
    label: "WCAG 2 - Vue d'ensemble (français)",
    url: 'https://www.w3.org/WAI/standards-guidelines/wcag/fr',
  },
  {
    label: 'WCAG 2.2 - Quoi de neuf',
    url: 'https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/',
  },
  {
    label: 'WCAG 2.2 - Référence rapide (QuickRef)',
    url: 'https://www.w3.org/WAI/WCAG22/quickref/',
  },
]

const githubProfile = {
  name: 'Aurélien Lewin',
  login: 'aurelienlewin',
  avatarUrl: 'https://avatars.githubusercontent.com/u/45093822?v=4',
  profileUrl: 'https://github.com/aurelienlewin',
}

const supportProfile = {
  buyMeACoffeeUrl: 'https://buymeacoffee.com/aurelienlewin',
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(new Date(value))
}

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function formatCategory(value: string) {
  return categoryLabels[value] ?? value
}

function isShowcaseEntry(payload: unknown): payload is ShowcaseEntry {
  if (!payload || typeof payload !== 'object') {
    return false
  }

  const candidate = payload as Record<string, unknown>
  return (
    typeof candidate.normalizedUrl === 'string' &&
    typeof candidate.siteTitle === 'string' &&
    typeof candidate.updatedAt === 'string' &&
    typeof candidate.category === 'string'
  )
}

async function readApiPayload(response: Response) {
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''
  const rawBody = await response.text()

  if (!rawBody.trim()) {
    return {}
  }

  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(rawBody) as Record<string, unknown>
    } catch {
      return { error: 'Réponse JSON invalide du serveur.' }
    }
  }

  const compactBody = rawBody.trim().replace(/\s+/g, ' ')
  return { error: compactBody.slice(0, 220) || 'Réponse serveur non JSON.' }
}

function App() {
  const [inputUrl, setInputUrl] = useState('')
  const [inputCategory, setInputCategory] = useState(showcaseCategories[0])
  const [loadingAdd, setLoadingAdd] = useState(false)
  const [loadingDirectory, setLoadingDirectory] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [lastAddedEntry, setLastAddedEntry] = useState<ShowcaseEntry | null>(null)
  const [showcaseEntries, setShowcaseEntries] = useState<ShowcaseEntry[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<ShowcaseStatusFilter>('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [politeAnnouncement, setPoliteAnnouncement] = useState('')

  const filteredShowcaseEntries = useMemo(() => {
    const normalizedQuery = normalizeText(searchQuery.trim())

    return showcaseEntries.filter((entry) => {
      const statusMatch = statusFilter === 'all' || entry.complianceStatus === statusFilter
      const categoryMatch = categoryFilter === 'all' || entry.category === categoryFilter

      if (!statusMatch || !categoryMatch) {
        return false
      }

      if (!normalizedQuery) {
        return true
      }

      const searchable = normalizeText(
        `${entry.siteTitle} ${entry.normalizedUrl} ${entry.category} ${entry.complianceStatusLabel ?? ''}`,
      )
      return searchable.includes(normalizedQuery)
    })
  }, [categoryFilter, searchQuery, showcaseEntries, statusFilter])

  const directoryStats = useMemo(() => {
    const full = showcaseEntries.filter((entry) => entry.complianceStatus === 'full').length
    const partial = showcaseEntries.filter((entry) => entry.complianceStatus === 'partial').length
    const none = showcaseEntries.filter((entry) => entry.complianceStatus === 'none').length

    return {
      total: showcaseEntries.length,
      full,
      partial,
      none,
    }
  }, [showcaseEntries])

  useEffect(() => {
    setPoliteAnnouncement(
      `${filteredShowcaseEntries.length} site(s) affiché(s) sur ${showcaseEntries.length} dans l'annuaire.`,
    )
  }, [filteredShowcaseEntries.length, showcaseEntries.length])

  async function loadShowcaseEntries() {
    setLoadingDirectory(true)

    try {
      const response = await fetch('/api/showcase')
      const payload = await readApiPayload(response)

      if (!response.ok) {
        throw new Error(typeof payload?.error === 'string' ? payload.error : "Chargement d'annuaire impossible.")
      }

      if (!Array.isArray(payload.entries)) {
        throw new Error("Liste d'annuaire invalide.")
      }

      const parsedEntries = payload.entries.filter(isShowcaseEntry)
      setShowcaseEntries(parsedEntries)
    } catch (error) {
      console.error('Unable to load showcase entries', error)
      setErrorMessage(error instanceof Error ? error.message : "Erreur de chargement de l'annuaire.")
    } finally {
      setLoadingDirectory(false)
    }
  }

  useEffect(() => {
    void loadShowcaseEntries()
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage(null)
    setLoadingAdd(true)

    try {
      const response = await fetch('/api/site-insight', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({ url: inputUrl, category: inputCategory }),
      })

      const payload = await readApiPayload(response)

      if (!response.ok) {
        throw new Error(typeof payload?.error === 'string' ? payload.error : 'Ajout impossible.')
      }

      if (!isShowcaseEntry(payload)) {
        throw new Error('Réponse serveur invalide.')
      }

      setLastAddedEntry(payload)
      setInputUrl('')
      await loadShowcaseEntries()
      setPoliteAnnouncement(`Site ajouté : ${payload.siteTitle}.`)
    } catch (error) {
      setLastAddedEntry(null)
      setErrorMessage(error instanceof Error ? error.message : 'Erreur réseau.')
    } finally {
      setLoadingAdd(false)
    }
  }

  return (
    <>
      <div className="skip-links" aria-label="Liens d'évitement">
        <a href="#contenu" className="skip-link">
          Aller au contenu
        </a>
        <a href="#filtres-annuaire" className="skip-link">
          Aller aux filtres
        </a>
        <a href="#ajout-site" className="skip-link">
          Aller au formulaire d'ajout
        </a>
        <a href="#aide-accessibilite" className="skip-link">
          Aller à l'aide accessibilité
        </a>
      </div>

      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {politeAnnouncement}
      </div>

      <div className="min-h-screen bg-slate-50 text-slate-900">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-600">Annuaire public RGAA</p>
              <a
                href="#aide-accessibilite"
                className="inline-flex min-h-11 items-center rounded-xl border border-sky-300 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-900"
              >
                Aide accessibilité
              </a>
            </div>
            <img
              src="/logo-rgaa-vitrine.svg"
              alt="Logo RGAA Vitrine"
              className="mt-2 h-auto w-full max-w-md"
              loading="eager"
            />
            <h1 className="sr-only">RGAA Vitrine</h1>
            <p className="mt-3 max-w-3xl text-base text-slate-700">
              Une vitrine simple pour référencer et découvrir les sites qui affichent leur conformité RGAA, avec
              filtres et recherche accessibles à tous.
            </p>
          </div>
        </header>

        <main id="contenu" className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
          <section aria-labelledby="annuaire-titre" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 id="annuaire-titre" className="text-xl font-semibold">
              Annuaire
            </h2>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl bg-slate-100 px-4 py-3">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-600">Sites référencés</dt>
                <dd className="mt-1 text-2xl font-bold text-slate-900">{directoryStats.total}</dd>
              </div>
              <div className="rounded-xl bg-emerald-50 px-4 py-3">
                <dt className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Totalement conformes</dt>
                <dd className="mt-1 text-2xl font-bold text-emerald-900">{directoryStats.full}</dd>
              </div>
              <div className="rounded-xl bg-amber-50 px-4 py-3">
                <dt className="text-xs font-semibold uppercase tracking-wide text-amber-700">Partiellement conformes</dt>
                <dd className="mt-1 text-2xl font-bold text-amber-900">{directoryStats.partial}</dd>
              </div>
              <div className="rounded-xl bg-rose-50 px-4 py-3">
                <dt className="text-xs font-semibold uppercase tracking-wide text-rose-700">Non conformes</dt>
                <dd className="mt-1 text-2xl font-bold text-rose-900">{directoryStats.none}</dd>
              </div>
            </dl>
          </section>

          <section id="filtres-annuaire" className="mt-8" aria-labelledby="galerie-titre" aria-busy={loadingDirectory}>
            <div className="flex flex-col gap-2">
              <h2 id="galerie-titre" className="text-xl font-semibold">
                Rechercher et filtrer
              </h2>
              <p className="text-slate-700">Trouvez rapidement un site par nom, catégorie ou niveau de conformité.</p>
            </div>

            <div className="mt-4 grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-3">
              <div>
                <label htmlFor="recherche-vitrine" className="block text-sm font-medium">
                  Recherche
                </label>
                <input
                  id="recherche-vitrine"
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Titre, URL, catégorie..."
                  className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm shadow-sm"
                />
              </div>

              <div>
                <label htmlFor="filtre-statut" className="block text-sm font-medium">
                  Niveau de conformité
                </label>
                <select
                  id="filtre-statut"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as ShowcaseStatusFilter)}
                  className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm shadow-sm"
                >
                  {Object.entries(showcaseStatusFilterLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="filtre-categorie" className="block text-sm font-medium">
                  Catégorie
                </label>
                <select
                  id="filtre-categorie"
                  value={categoryFilter}
                  onChange={(event) => setCategoryFilter(event.target.value)}
                  className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm shadow-sm"
                >
                  <option value="all">Toutes les catégories</option>
                  {showcaseCategories.map((category) => (
                    <option key={category} value={category}>
                      {formatCategory(category)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <p className="mt-3 text-sm text-slate-700">
              {filteredShowcaseEntries.length} site(s) affiché(s) sur {showcaseEntries.length}.
            </p>

            {loadingDirectory && <p className="mt-3 text-slate-700">Chargement de l'annuaire...</p>}

            {!loadingDirectory && showcaseEntries.length === 0 && (
              <p className="mt-3 text-slate-700">Aucun site référencé pour le moment.</p>
            )}

            {!loadingDirectory && showcaseEntries.length > 0 && filteredShowcaseEntries.length === 0 && (
              <p className="mt-3 text-slate-700">Aucun site ne correspond aux filtres actuels.</p>
            )}

            {filteredShowcaseEntries.length > 0 && (
              <ul id="liste-vitrines" className="mt-4 grid gap-4 md:grid-cols-2">
                {filteredShowcaseEntries.map((entry) => (
                  <li key={entry.normalizedUrl} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <article>
                      <div className="h-40 bg-slate-100">
                        {entry.thumbnailUrl ? (
                          <img
                            src={entry.thumbnailUrl}
                            alt={`Aperçu du site ${entry.siteTitle}`}
                            className="h-full w-full object-cover"
                            loading="lazy"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center px-3 text-center text-sm text-slate-600">
                            Aucune vignette disponible
                          </div>
                        )}
                      </div>
                      <div className="space-y-2 p-4">
                        <h3 className="text-lg font-semibold">{entry.siteTitle}</h3>
                        <p className="text-xs text-slate-600">Catégorie : {formatCategory(entry.category)}</p>
                        <p className="text-xs text-slate-600">Mise à jour : {formatDate(entry.updatedAt)}</p>
                        <p className="break-all text-xs text-slate-600">{entry.normalizedUrl}</p>
                        <p className="text-sm">
                          <a
                            href={entry.normalizedUrl}
                            target="_blank"
                            rel="noreferrer noopener"
                            aria-label={`Visiter le site ${entry.siteTitle}`}
                            className="inline-flex min-h-11 items-center rounded-xl border border-slate-300 px-3 py-2 font-semibold text-slate-900"
                          >
                            Visiter le site
                          </a>
                        </p>
                        <p className="text-sm">
                          {entry.accessibilityPageUrl ? (
                            <a
                              href={entry.accessibilityPageUrl}
                              target="_blank"
                              rel="noreferrer noopener"
                              aria-label={`Ouvrir la déclaration d'accessibilité de ${entry.siteTitle}`}
                              className="inline-flex min-h-11 items-center rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 font-semibold text-emerald-900"
                            >
                              Déclaration d'accessibilité
                            </a>
                          ) : (
                            <span className="inline-flex min-h-11 items-center rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-slate-600">
                              Déclaration non détectée
                            </span>
                          )}
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          {entry.complianceStatus ? (
                            <span
                              className={`inline-flex min-h-8 items-center rounded-full px-3 py-1 text-xs font-semibold ${statusClassByValue[entry.complianceStatus]}`}
                            >
                              {entry.complianceStatusLabel}
                            </span>
                          ) : (
                            <span className="inline-flex min-h-8 items-center rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-800">
                              Niveau inconnu
                            </span>
                          )}
                          <span className="inline-flex min-h-8 items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-800">
                            Score: {entry.complianceScore !== null ? `${entry.complianceScore}%` : 'N/A'}
                          </span>
                        </div>
                      </div>
                    </article>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section id="aide-accessibilite" className="mt-8 rounded-2xl border border-sky-200 bg-sky-50 p-6" aria-labelledby="aide-titre">
            <h2 id="aide-titre" className="text-xl font-semibold text-sky-900">
              Aide accessibilité et repères WCAG 2.2
            </h2>
            <p className="mt-2 text-sky-900">
              Cette vitrine suit les recommandations WCAG 2.2 pour un usage clavier, des cibles interactives plus
              confortables et des retours clairs pour toutes et tous.
            </p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-sky-900">
              <li>Focus clavier visible et non masqué sur les contrôles interactifs.</li>
              <li>Cibles pointeur suffisantes pour limiter les erreurs de sélection.</li>
              <li>Point d'aide cohérent et retrouvé au même endroit dans l'interface.</li>
            </ul>
            <div className="mt-4 grid gap-3">
              {wcagResources.map((resource) => (
                <a
                  key={resource.url}
                  href={resource.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex min-h-11 items-center rounded-xl border border-sky-300 bg-white px-4 py-2 font-semibold text-sky-900"
                >
                  {resource.label}
                </a>
              ))}
            </div>
          </section>

          <section id="ajout-site" className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" aria-labelledby="formulaire-titre">
            <h2 id="formulaire-titre" className="text-xl font-semibold">
              Ajouter un site
            </h2>
            <p id="url-help" className="mt-2 text-sm text-slate-700">
              Ajoutez une URL pour enrichir l'annuaire. Les métadonnées publiques seront récupérées automatiquement.
            </p>

            <form className="mt-4 grid gap-4 md:grid-cols-[2fr_1fr_auto]" onSubmit={handleSubmit} noValidate>
              <div>
                <label htmlFor="url" className="block text-sm font-medium">
                  URL du site
                </label>
                <input
                  id="url"
                  name="url"
                  type="url"
                  autoComplete="url"
                  required
                  aria-invalid={Boolean(errorMessage)}
                  aria-describedby={errorMessage ? 'url-help url-error' : 'url-help'}
                  value={inputUrl}
                  onChange={(event) => setInputUrl(event.target.value)}
                  className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2 text-base shadow-sm"
                />
              </div>

              <div>
                <label htmlFor="categorie-site" className="block text-sm font-medium">
                  Catégorie
                </label>
                <select
                  id="categorie-site"
                  name="categorie"
                  value={inputCategory}
                  onChange={(event) => setInputCategory(event.target.value)}
                  className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2 text-base shadow-sm"
                >
                  {showcaseCategories.map((category) => (
                    <option key={category} value={category}>
                      {formatCategory(category)}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={loadingAdd}
                className="min-h-11 rounded-xl bg-slate-900 px-5 py-2.5 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 md:self-end"
              >
                {loadingAdd ? 'Ajout...' : 'Ajouter'}
              </button>
            </form>

            {errorMessage && (
              <p id="url-error" className="mt-4 rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800" role="alert">
                {errorMessage}
              </p>
            )}

            {lastAddedEntry && !errorMessage && (
              <p className="mt-4 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800">
                Site ajouté : <strong>{lastAddedEntry.siteTitle}</strong>
              </p>
            )}
          </section>

          <section className="mt-8" aria-labelledby="sources-titre">
            <h2 id="sources-titre" className="text-xl font-semibold">
              Ressources officielles RGAA
            </h2>
            <p className="mt-2 text-slate-700">
              Pour les personnes concernées, les équipes produit et les passionnés, voici les références publiques
              utilisées pour guider la qualité du répertoire.
            </p>
            <aside
              className="mt-4 rounded-xl border border-sky-200 bg-sky-50 p-4"
              aria-labelledby="rgaa5-focus-titre"
            >
              <h3 id="rgaa5-focus-titre" className="text-base font-semibold text-sky-900">
                Point d'attention : cap RGAA 5
              </h3>
              <p className="mt-1 text-sm text-sky-900">
                L'article officiel du 2 mars 2026 rappelle deux priorités : préparer la transition vers RGAA 5 d'ici
                fin 2026, et maintenir dès maintenant les efforts de conformité RGAA 4.1.2.
              </p>
              <p className="mt-2 text-sm">
                <a
                  href="https://design.numerique.gouv.fr/articles/2026-03-02-rgaa5/"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="font-semibold text-sky-900"
                >
                  Lire l'article "L'arrivée de RGAA 5 est annoncée"
                </a>
              </p>
            </aside>
            <ul className="mt-4 grid gap-3">
              {officialResources.map((resource) => (
                <li key={resource.url} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <a
                    href={resource.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex min-h-11 items-center font-semibold"
                  >
                    {resource.label}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        </main>

        <footer
          role="contentinfo"
          className="mt-12 border-t border-slate-200 bg-white"
          aria-label="Informations de bas de page"
        >
          <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <img
                src={githubProfile.avatarUrl}
                alt={`Avatar GitHub de ${githubProfile.name}`}
                className="h-12 w-12 rounded-full border border-slate-300"
                loading="lazy"
                referrerPolicy="no-referrer"
              />
              <p className="text-sm text-slate-800">
                Créé et maintenu par{' '}
                <a href={githubProfile.profileUrl} target="_blank" rel="noreferrer noopener">
                  {githubProfile.name} (@{githubProfile.login})
                </a>
              </p>
              <a href="#aide-accessibilite" className="text-sm font-semibold text-slate-800 underline">
                Aide accessibilité
              </a>
            </div>

            <a
              href={supportProfile.buyMeACoffeeUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900"
              aria-label="M'offrir un café via Buy Me a Coffee"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                <path d="M3 5h14a1 1 0 0 1 1 1v2h2a2 2 0 0 1 2 2v1a4 4 0 0 1-4 4h-1.1a5 5 0 0 1-4.9 4H8a5 5 0 0 1-5-5V6a1 1 0 0 1 1-1Zm15 8h1a2 2 0 0 0 2-2v-1h-3v3Zm-4 6a1 1 0 1 1 0 2H7a1 1 0 1 1 0-2h7Z" />
              </svg>
              M'offrir un café
            </a>
          </div>
        </footer>
      </div>
    </>
  )
}

export default App
