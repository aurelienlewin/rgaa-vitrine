import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'

type ComplianceStatus = 'full' | 'partial' | 'none' | null

type SiteInsight = {
  normalizedUrl: string
  siteTitle: string
  thumbnailUrl: string | null
  accessibilityPageUrl: string | null
  complianceStatus: ComplianceStatus
  complianceStatusLabel: string | null
  complianceScore: number | null
  updatedAt: string
}

type ShowcaseEntry = SiteInsight & {
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

const showcaseStatusFilterLabels: Record<ShowcaseStatusFilter, string> = {
  all: 'Tous les niveaux',
  full: 'Totalement conforme',
  partial: 'Partiellement conforme',
  none: 'Non conforme',
}

const rgaaValues = [
  'Inclure toutes les personnes, sans discrimination de handicap ou de contexte d usage.',
  'Permettre une autonomie reelle en navigation clavier, lecteur d ecran et zoom.',
  'Publier une information claire sur le niveau de conformite et les limites connues.',
]

const rgaaRules = [
  'Utiliser une structure HTML semantique avant d ajouter ARIA.',
  'Garantir un focus visible, un ordre de tabulation coherent et aucun piege clavier.',
  'Associer chaque champ de formulaire a une etiquette explicite.',
  'Ne jamais transmettre une information uniquement par la couleur ou la forme.',
  'Conserver une page utilisable sans styles et avec agrandissement des caracteres.',
  'Controler les mises a jour dynamiques avec une strategie focus ou aria-live adaptee.',
]

const rgaaAwareness = [
  'Verifier chaque livraison avec des tests rapides: titre de page, lang, validite HTML, clavier.',
  'Tester des composants riches avec des technologies d assistance de reference.',
  'Documenter en PR les choix accessibilite, limites et preuves de verification.',
]

const officialResources = [
  {
    label: 'Guide du developpeur RGAA',
    url: 'https://disic.github.io/guide-developpeur/',
    summary:
      'Bonnes pratiques JavaScript/ARIA: tabulation, acces clavier, changements de contexte, motifs de conception.',
  },
  {
    label: 'Guide de l integrateur RGAA',
    url: 'https://disic.github.io/guide-integrateur/',
    summary: 'Regles structurelles: gabarit, navigation, contenus, tableaux, liens, formulaires, focus, images.',
  },
  {
    label: 'Memo dev',
    url: 'https://design.numerique.gouv.fr/outils/memo-dev/',
    summary: 'Resume operationnel des recommandations techniques prioritaires a appliquer en implementation.',
  },
  {
    label: 'Checklist dev',
    url: 'https://design.numerique.gouv.fr/outils/checklist-dev/',
    summary: 'Controle rapide avant livraison: titre, lang, HTML valide, clavier, semantique, etiquettes.',
  },
  {
    label: 'Bibliotheque de reference ARIA',
    url: 'https://www.info.gouv.fr/accessibilite/developpement/bibliotheque-de-reference-des-restitutions-des-composants-javascript-aria',
    summary: 'Reference de restitution des composants JS ARIA avec technologies d assistance.',
  },
  {
    label: 'Guide des composants JavaScript accessibles',
    url: 'https://www.info.gouv.fr/accessibilite/developpement/le-guide-des-composants-javascript-accessibles',
    summary:
      'Tutoriels et correctifs de composants (accordion, tabs, menu, modal, slider, etc.) selon frameworks.',
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
      return { error: 'Reponse JSON invalide du serveur.' }
    }
  }

  const compactBody = rawBody.trim().replace(/\s+/g, ' ')
  return { error: compactBody.slice(0, 220) || 'Reponse serveur non JSON.' }
}

function App() {
  const [inputUrl, setInputUrl] = useState('')
  const [inputCategory, setInputCategory] = useState(showcaseCategories[0])
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [insight, setInsight] = useState<SiteInsight | null>(null)
  const [showcaseEntries, setShowcaseEntries] = useState<ShowcaseEntry[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<ShowcaseStatusFilter>('all')
  const [categoryFilter, setCategoryFilter] = useState('all')

  const loadingMessage = useMemo(
    () => (loading ? 'Analyse en cours de l URL...' : 'Analyse terminee.'),
    [loading],
  )

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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage(null)
    setLoading(true)

    try {
      const response = await fetch('/api/site-insight', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({ url: inputUrl }),
      })

      const payload = await readApiPayload(response)

      if (!response.ok) {
        throw new Error(typeof payload?.error === 'string' ? payload.error : 'Analyse impossible.')
      }

      if (
        typeof payload.normalizedUrl !== 'string' ||
        typeof payload.siteTitle !== 'string' ||
        typeof payload.updatedAt !== 'string'
      ) {
        throw new Error('Reponse serveur invalide.')
      }

      const parsedInsight = payload as unknown as SiteInsight
      setInsight(parsedInsight)

      const nextEntry: ShowcaseEntry = {
        ...parsedInsight,
        category: inputCategory,
      }

      setShowcaseEntries((previousEntries) => {
        const existingIndex = previousEntries.findIndex(
          (entry) => entry.normalizedUrl === nextEntry.normalizedUrl,
        )

        if (existingIndex === -1) {
          return [nextEntry, ...previousEntries]
        }

        const updatedEntries = [...previousEntries]
        updatedEntries[existingIndex] = nextEntry
        return updatedEntries
      })
    } catch (error) {
      setInsight(null)
      setErrorMessage(error instanceof Error ? error.message : 'Erreur reseau.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <a href="#contenu" className="skip-link">
        Aller au contenu principal
      </a>

      <div className="min-h-screen bg-slate-50 text-slate-900">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-600">Vitrine FR</p>
            <img
              src="/logo-rgaa-vitrine.svg"
              alt="Logo RGAA Vitrine"
              className="mt-2 h-auto w-full max-w-md"
              loading="eager"
            />
            <h1 className="sr-only">Fierte RGAA</h1>
            <p className="mt-3 max-w-3xl text-base text-slate-700">
              Valorisez votre conformite accessibilite. Saisissez une URL pour afficher le titre du site,
              une vignette, la page accessibilite detectee et le niveau de conformite lorsque disponible.
            </p>
          </div>
        </header>

        <main id="contenu" className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
          <section aria-labelledby="formulaire-titre" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 id="formulaire-titre" className="text-xl font-semibold">
              Analyser un site
            </h2>
            <p id="url-help" className="mt-2 text-sm text-slate-700">
              Entrez l adresse du site a valoriser. Exemple: <span className="font-medium">https://www.exemple.fr</span>
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
                  aria-describedby="url-help"
                  value={inputUrl}
                  onChange={(event) => setInputUrl(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-base shadow-sm"
                />
              </div>

              <div>
                <label htmlFor="categorie-site" className="block text-sm font-medium">
                  Categorie
                </label>
                <select
                  id="categorie-site"
                  name="categorie"
                  value={inputCategory}
                  onChange={(event) => setInputCategory(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-base shadow-sm"
                >
                  {showcaseCategories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="rounded-xl bg-slate-900 px-5 py-2.5 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 md:self-end"
              >
                {loading ? 'Analyse...' : 'Afficher la vitrine'}
              </button>
            </form>

            <p className="sr-only" aria-live="polite">
              {loadingMessage}
            </p>

            {errorMessage && (
              <p className="mt-4 rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800" role="alert">
                {errorMessage}
              </p>
            )}
          </section>

          <section className="mt-8" aria-labelledby="resultat-titre">
            <h2 id="resultat-titre" className="text-xl font-semibold">
              Resultat
            </h2>

            {!insight && !errorMessage && (
              <p className="mt-3 text-slate-700">
                Aucun resultat pour l instant. Lancez une analyse pour afficher la carte de fierte RGAA.
              </p>
            )}

            {insight && (
              <article className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="grid gap-0 md:grid-cols-[1fr_2fr]">
                  <div className="border-b border-slate-200 bg-slate-100 p-4 md:border-b-0 md:border-r">
                    {insight.thumbnailUrl ? (
                      <img
                        src={insight.thumbnailUrl}
                        alt={`Apercu du site ${insight.siteTitle}`}
                        className="h-48 w-full rounded-lg object-cover"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-slate-400 bg-white px-3 text-center text-sm text-slate-600">
                        Aucune vignette disponible
                      </div>
                    )}
                  </div>

                  <div className="p-5">
                    <h3 className="text-2xl font-bold">{insight.siteTitle}</h3>
                    <p className="mt-1 text-sm text-slate-700">
                      Analyse effectuee le {formatDate(insight.updatedAt)}
                    </p>

                    <dl className="mt-5 space-y-4">
                      <div>
                        <dt className="text-sm font-semibold text-slate-700">URL analysee</dt>
                        <dd>
                          <a
                            className="break-all"
                            href={insight.normalizedUrl}
                            target="_blank"
                            rel="noreferrer noopener"
                          >
                            {insight.normalizedUrl}
                          </a>
                        </dd>
                      </div>

                      <div>
                        <dt className="text-sm font-semibold text-slate-700">Page accessibilite detectee</dt>
                        <dd>
                          {insight.accessibilityPageUrl ? (
                            <a
                              className="break-all"
                              href={insight.accessibilityPageUrl}
                              target="_blank"
                              rel="noreferrer noopener"
                            >
                              {insight.accessibilityPageUrl}
                            </a>
                          ) : (
                            <span>Non detectee automatiquement.</span>
                          )}
                        </dd>
                      </div>

                      <div>
                        <dt className="text-sm font-semibold text-slate-700">Niveau de conformite</dt>
                        <dd className="mt-1">
                          {insight.complianceStatus ? (
                            <span
                              className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${statusClassByValue[insight.complianceStatus]}`}
                            >
                              {insight.complianceStatusLabel}
                            </span>
                          ) : (
                            <span>Information indisponible.</span>
                          )}
                        </dd>
                      </div>

                      <div>
                        <dt className="text-sm font-semibold text-slate-700">Score de conformite</dt>
                        <dd>
                          {insight.complianceScore !== null ? (
                            <div className="mt-2">
                              <label htmlFor="score-progress" className="sr-only">
                                Score de conformite
                              </label>
                              <progress
                                id="score-progress"
                                max={100}
                                value={insight.complianceScore}
                                className="h-3 w-full overflow-hidden rounded-full"
                              />
                              <p className="mt-1 text-sm">{insight.complianceScore}%</p>
                            </div>
                          ) : (
                            <span>Score non trouve.</span>
                          )}
                        </dd>
                      </div>
                    </dl>
                  </div>
                </div>
              </article>
            )}
          </section>

          <section className="mt-8" aria-labelledby="galerie-titre">
            <div className="flex flex-col gap-2">
              <h2 id="galerie-titre" className="text-xl font-semibold">
                Galerie des vitrines
              </h2>
              <p className="text-slate-700">
                Recherchez et filtrez les sites analyses par categorie et niveau de conformite.
              </p>
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
                  placeholder="Titre, URL, categorie..."
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm shadow-sm"
                />
              </div>

              <div>
                <label htmlFor="filtre-statut" className="block text-sm font-medium">
                  Filtre conformite
                </label>
                <select
                  id="filtre-statut"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as ShowcaseStatusFilter)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm shadow-sm"
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
                  Filtre categorie
                </label>
                <select
                  id="filtre-categorie"
                  value={categoryFilter}
                  onChange={(event) => setCategoryFilter(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm shadow-sm"
                >
                  <option value="all">Toutes les categories</option>
                  {showcaseCategories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <p className="mt-3 text-sm text-slate-700">
              {filteredShowcaseEntries.length} vitrine(s) affichee(s) sur {showcaseEntries.length}.
            </p>

            {showcaseEntries.length === 0 && (
              <p className="mt-3 text-slate-700">
                Aucune vitrine enregistree pour le moment. Analysez un site pour alimenter la galerie.
              </p>
            )}

            {showcaseEntries.length > 0 && filteredShowcaseEntries.length === 0 && (
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
                            alt={`Apercu du site ${entry.siteTitle}`}
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
                        <p className="text-xs text-slate-600">Categorie: {entry.category}</p>
                        <p className="text-xs text-slate-600">Mise a jour: {formatDate(entry.updatedAt)}</p>
                        <p className="text-sm">
                          <a href={entry.normalizedUrl} target="_blank" rel="noreferrer noopener" className="break-all">
                            {entry.normalizedUrl}
                          </a>
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          {entry.complianceStatus ? (
                            <span
                              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClassByValue[entry.complianceStatus]}`}
                            >
                              {entry.complianceStatusLabel}
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-800">
                              Niveau inconnu
                            </span>
                          )}
                          <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-800">
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

          <section
            className="mt-10 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            aria-labelledby="rgaa-culture-titre"
          >
            <h2 id="rgaa-culture-titre" className="text-xl font-semibold">
              Valeurs et culture RGAA
            </h2>
            <p className="mt-2 text-slate-700">
              Cette vitrine diffuse aussi les fondamentaux RGAA pour renforcer la qualite, la confiance et la
              sensibilisation des equipes.
            </p>

            <div className="mt-6 grid gap-6 md:grid-cols-3">
              <article aria-labelledby="valeurs-titre">
                <h3 id="valeurs-titre" className="text-lg font-semibold">
                  Valeurs
                </h3>
                <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-800">
                  {rgaaValues.map((value) => (
                    <li key={value}>{value}</li>
                  ))}
                </ul>
              </article>

              <article aria-labelledby="regles-titre">
                <h3 id="regles-titre" className="text-lg font-semibold">
                  Regles prioritaires
                </h3>
                <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-800">
                  {rgaaRules.map((rule) => (
                    <li key={rule}>{rule}</li>
                  ))}
                </ul>
              </article>

              <article aria-labelledby="sensibilisation-titre">
                <h3 id="sensibilisation-titre" className="text-lg font-semibold">
                  Sensibilisation
                </h3>
                <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-800">
                  {rgaaAwareness.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            </div>
          </section>

          <section className="mt-8" aria-labelledby="sources-titre">
            <h2 id="sources-titre" className="text-xl font-semibold">
              Sources officielles de reference
            </h2>
            <p className="mt-2 text-slate-700">
              Les recommandations affichees sur cette page sont alignees sur les ressources officielles suivantes.
            </p>
            <ul className="mt-4 grid gap-3">
              {officialResources.map((resource) => (
                <li key={resource.url} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <h3 className="text-base font-semibold">{resource.label}</h3>
                  <p className="mt-1 text-sm text-slate-700">{resource.summary}</p>
                  <p className="mt-2 text-sm">
                    <a href={resource.url} target="_blank" rel="noreferrer noopener">
                      {resource.url}
                    </a>
                  </p>
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
                Cree et maintenu par{' '}
                <a href={githubProfile.profileUrl} target="_blank" rel="noreferrer noopener">
                  {githubProfile.name} (@{githubProfile.login})
                </a>
              </p>
            </div>

            <a
              href={supportProfile.buyMeACoffeeUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900"
              aria-label="M offrir un cafe via Buy Me a Coffee"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                <path d="M3 5h14a1 1 0 0 1 1 1v2h2a2 2 0 0 1 2 2v1a4 4 0 0 1-4 4h-1.1a5 5 0 0 1-4.9 4H8a5 5 0 0 1-5-5V6a1 1 0 0 1 1-1Zm15 8h1a2 2 0 0 0 2-2v-1h-3v3Zm-4 6a1 1 0 1 1 0 2H7a1 1 0 1 1 0-2h7Z" />
              </svg>
              M'offrir un cafe
            </a>
          </div>
        </footer>
      </div>
    </>
  )
}

export default App
