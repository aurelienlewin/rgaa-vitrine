export type ShowcaseStatusFilter = 'all' | 'full' | 'partial' | 'none'

export const showcaseCategories = [
  'Administration',
  'E-commerce',
  'Media',
  'Sante',
  'Education',
  'Associatif',
  'Coopérative et services',
  'Autre',
]

export const categoryLabels: Record<string, string> = {
  Administration: 'Administration',
  'E-commerce': 'E-commerce',
  Media: 'Média',
  Sante: 'Santé',
  Education: 'Éducation',
  Associatif: 'Associatif',
  'Cooperative et services': 'Coopérative et services',
  'Coopérative et services': 'Coopérative et services',
  Autre: 'Autre',
}

export const showcaseStatusFilterLabels: Record<ShowcaseStatusFilter, string> = {
  all: 'Tous les niveaux',
  full: 'Totalement conforme',
  partial: 'Partiellement conforme',
  none: 'Non conforme',
}

export function formatCategory(value: string) {
  return categoryLabels[value] ?? value
}

export function readStatusFilterFromQuery(value: string | null): ShowcaseStatusFilter {
  if (value === 'full' || value === 'partial' || value === 'none') {
    return value
  }
  return 'all'
}

