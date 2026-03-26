import { expect, test, type Page } from '@playwright/test'

type ComplianceStatus = 'full' | 'partial' | 'none'

type ShowcaseEntryPayload = {
  normalizedUrl: string
  siteTitle: string
  updatedAt: string
  category: string
  complianceStatus: ComplianceStatus
  complianceStatusLabel: string
  complianceScore: number
  rgaaBaseline: '4.1' | '5.0-ready'
  thumbnailUrl: string | null
  accessibilityPageUrl: string | null
  upvoteCount: number
  hasUpvoted: boolean
  votesBlocked: boolean
}

function toComplianceLabel(status: ComplianceStatus) {
  if (status === 'full') {
    return 'Totalement conforme'
  }
  if (status === 'partial') {
    return 'Partiellement conforme'
  }
  return 'Non conforme'
}

function createShowcaseEntry(
  index: number,
  overrides: Partial<ShowcaseEntryPayload> = {},
): ShowcaseEntryPayload {
  const status: ComplianceStatus = overrides.complianceStatus ?? 'full'
  const domainSegment = String(index).padStart(3, '0')
  return {
    normalizedUrl: overrides.normalizedUrl ?? `https://site-${domainSegment}.exemple-${domainSegment}.fr/`,
    siteTitle: overrides.siteTitle ?? `Site ${domainSegment}`,
    updatedAt: overrides.updatedAt ?? new Date(Date.UTC(2026, 2, (index % 27) + 1, 12, 0, 0)).toISOString(),
    category: overrides.category ?? 'Administration',
    complianceStatus: status,
    complianceStatusLabel: overrides.complianceStatusLabel ?? toComplianceLabel(status),
    complianceScore: overrides.complianceScore ?? Math.max(1, 100 - index),
    rgaaBaseline: overrides.rgaaBaseline ?? '4.1',
    thumbnailUrl: overrides.thumbnailUrl ?? null,
    accessibilityPageUrl: overrides.accessibilityPageUrl ?? null,
    upvoteCount: overrides.upvoteCount ?? 0,
    hasUpvoted: overrides.hasUpvoted ?? false,
    votesBlocked: overrides.votesBlocked ?? false,
  }
}

async function mockShowcaseApis(page: Page, entries: ShowcaseEntryPayload[]) {
  await page.route(/\/api\/maintenance$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        enabled: false,
        message: null,
        effectiveMessage: 'Nous revenons très vite. Merci de réessayer dans quelques instants.',
      }),
    })
  })

  await page.route(/\/api\/showcase(?:\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ entries }),
    })
  })

  await page.route(/\/api\/showcase\/vote-state(?:\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        votedUrls: [],
        countsByUrl: {},
      }),
    })
  })
}

test('initialise les filtres depuis l’URL et place le focus sur le résumé', async ({ page }) => {
  const entries = [
    createShowcaseEntry(1, {
      siteTitle: 'Alpha Accessibilité',
      normalizedUrl: 'https://alpha-accessibilite.fr/',
      category: 'Administration',
      complianceStatus: 'full',
      complianceScore: 95,
    }),
    createShowcaseEntry(2, {
      siteTitle: 'Alpha Partiel',
      normalizedUrl: 'https://alpha-partiel.fr/',
      category: 'Administration',
      complianceStatus: 'partial',
      complianceScore: 82,
    }),
    createShowcaseEntry(3, {
      siteTitle: 'Beta Complet',
      normalizedUrl: 'https://beta-complet.fr/',
      category: 'E-commerce',
      complianceStatus: 'full',
      complianceScore: 88,
    }),
  ]

  await mockShowcaseApis(page, entries)
  await page.goto('/?recherche=alpha&statut=full&categorie=Administration&tri=score-desc')

  await expect(page.locator('#accueil-recherche-annuaire')).toHaveValue('alpha')
  await expect(page.locator('#accueil-recherche-annuaire-statut')).toHaveValue('full')
  await expect(page.locator('#accueil-recherche-annuaire-categorie')).toHaveValue('Administration')
  await expect(page.locator('#annuaire-tri-resultats')).toHaveValue('score-desc')
  await expect(page.locator('#liste-vitrines > li')).toHaveCount(1)
  await expect(page.locator('#liste-vitrines')).toContainText('Alpha Accessibilité')
  await expect(page.locator('#annuaire-resultats-resume')).toContainText('Tri actuel : score le plus élevé d’abord.')
  await expect
    .poll(async () => page.evaluate(() => document.activeElement?.id))
    .toBe('annuaire-resultats-resume')
})

test('réinitialise la pagination par page après changement de filtre', async ({ page }) => {
  const entries = Array.from({ length: 40 }, (_, index) =>
    createShowcaseEntry(index + 1, {
      complianceStatus: index < 30 ? 'full' : 'partial',
      complianceStatusLabel: index < 30 ? 'Totalement conforme' : 'Partiellement conforme',
      category: 'Administration',
    }),
  )

  await mockShowcaseApis(page, entries)
  await page.goto('/')

  const cards = page.locator('#liste-vitrines > li')
  const paginationInfo = page.locator('#annuaire-pagination-info')
  await expect(cards).toHaveCount(24)
  await expect(paginationInfo).toHaveText('Page 1 sur 2')

  await page.getByRole('button', { name: 'Page suivante' }).click()
  await expect(cards).toHaveCount(16)
  await expect(paginationInfo).toHaveText('Page 2 sur 2')

  await page.selectOption('#accueil-recherche-annuaire-statut', 'full')
  await expect(cards).toHaveCount(24)
  await expect(paginationInfo).toHaveText('Page 1 sur 2')
})

test('affiche une erreur de pré-analyse et déplace le focus sur le panneau', async ({ page }) => {
  await mockShowcaseApis(page, [createShowcaseEntry(1)])
  await page.route(/\/api\/site-insight\?preview=1$/, async (route) => {
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Pré-analyse impossible pour test e2e.' }),
    })
  })

  await page.goto('/')
  await page.fill('#url', 'https://nouveau-site-test.fr/')
  await page.getByRole('button', { name: 'Lancer la pré-analyse' }).click()

  const errorPanel = page.locator('section[aria-labelledby="url-error-title"]')
  await expect(errorPanel).toBeVisible()
  await expect(errorPanel).toBeFocused()
  await expect(page.locator('#url-error-title')).toContainText('Analyse interrompue')
})

test('affiche un retour duplicate et place le focus sur le panneau contextuel', async ({ page }) => {
  await mockShowcaseApis(page, [createShowcaseEntry(1)])
  await page.route(/\/api\/site-insight\?preview=1$/, async (route) => {
    const duplicateEntry = createShowcaseEntry(901, {
      siteTitle: 'Site déjà présent',
      normalizedUrl: 'https://site-deja-present.fr/',
      complianceStatus: 'partial',
      complianceScore: 77,
      category: 'Administration',
    })
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ...duplicateEntry,
        submissionStatus: 'duplicate',
        message: 'Ce site est déjà référencé.',
      }),
    })
  })

  await page.goto('/')
  await page.fill('#url', 'https://site-deja-present.fr/')
  await page.getByRole('button', { name: 'Lancer la pré-analyse' }).click()

  const duplicatePanel = page.locator('section[aria-labelledby="soumission-deja-presente-titre"]')
  await expect(duplicatePanel).toBeVisible()
  await expect(duplicatePanel).toBeFocused()
  await expect(page.locator('#soumission-deja-presente-titre')).toContainText('Site déjà référencé')
})

test('restaure le jeton de modération depuis le stockage local au chargement', async ({ page }) => {
  const storageKey = 'annuaire-rgaa-moderation-session'
  const token = 'token-moderation-e2e-123456'
  await page.addInitScript(
    ({ key, value }) => {
      window.localStorage.setItem(key, value)
    },
    {
      key: storageKey,
      value: JSON.stringify({
        token,
        expiresAt: Date.now() + 60 * 60 * 1000,
      }),
    },
  )

  await page.goto('/moderation')

  await expect(page.locator('#token-moderation')).toHaveValue(token)
  await expect(page.getByRole('checkbox')).toBeChecked()
  await expect(page.getByText('Jeton restauré. Activez le chargement pour ouvrir la modération.')).toBeVisible()
})
