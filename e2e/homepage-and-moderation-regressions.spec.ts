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
  await page.route(/\/api\/site-insight\/failure-report$/, async (route) => {
    await route.fulfill({ status: 202, contentType: 'application/json', body: '{"reference":"SUB-TEST"}' })
  })
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

test('affiche la référence serveur d’un échec identifié sans relais navigateur', async ({ page }) => {
  await mockShowcaseApis(page, [createShowcaseEntry(1)])
  let relayCalls = 0
  await page.route(/\/api\/site-insight\/failure-report$/, async (route) => {
    relayCalls += 1
    await route.fulfill({ status: 202, contentType: 'application/json', body: '{"reference":"SUB-RELAY"}' })
  })
  await page.route(/\/api\/site-insight\?preview=1$/, async (route) => {
    await route.fulfill({
      status: 502,
      contentType: 'application/json',
      body: JSON.stringify({
        error: 'Le certificat HTTPS du site est invalide ou incomplet (chaîne de certificats non vérifiable).',
        errorCode: 'tls-error',
        reference: 'SUB-SERVEUR01',
      }),
    })
  })

  await page.goto('/')
  await page.fill('#url', 'https://certificat-casse.fr/')
  await page.getByRole('button', { name: 'Lancer la pré-analyse' }).click()

  const errorPanel = page.locator('section[aria-labelledby="url-error-title"]')
  await expect(errorPanel).toBeFocused()
  await expect(page.locator('#url-error-reference')).toContainText('SUB-SERVEUR01')
  await expect(errorPanel).toHaveAttribute('aria-describedby', /url-error-reference/)
  expect(relayCalls).toBe(0)
})

test('relaie un timeout plateforme non JSON et affiche la référence du relais', async ({ page }) => {
  await mockShowcaseApis(page, [createShowcaseEntry(1)])
  let relayedPayload: Record<string, unknown> | null = null
  await page.route(/\/api\/site-insight\/failure-report$/, async (route) => {
    relayedPayload = route.request().postDataJSON() as Record<string, unknown>
    await route.fulfill({ status: 202, contentType: 'application/json', body: '{"reference":"SUB-RELAIS01"}' })
  })
  await page.route(/\/api\/site-insight\?preview=1$/, async (route) => {
    await route.fulfill({
      status: 504,
      contentType: 'text/plain',
      body: 'An error occurred with your deployment FUNCTION_INVOCATION_TIMEOUT',
    })
  })

  await page.goto('/')
  await page.fill('#url', 'https://site-lent.fr/')
  await page.getByRole('button', { name: 'Lancer la pré-analyse' }).click()

  await expect(page.locator('#url-error-message')).toContainText('prend plus de temps que prévu')
  await expect(page.locator('#url-error-reference')).toContainText('SUB-RELAIS01')
  expect(relayedPayload).toMatchObject({
    url: 'https://site-lent.fr/',
    stage: 'preview',
    kind: 'timeout',
    statusCode: 504,
  })
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

test('met à jour une fiche publiée dont le score a changé et la présente comme mise à jour', async ({ page }) => {
  const publishedEntry = createShowcaseEntry(7, {
    siteTitle: 'Site déjà publié',
    normalizedUrl: 'https://site-deja-publie.fr/',
    complianceStatus: 'partial',
    complianceScore: 72,
  })
  const updatedEntry = {
    ...publishedEntry,
    complianceStatus: 'partial' as const,
    complianceStatusLabel: 'Partiellement conforme',
    complianceScore: 88,
    updatedAt: new Date().toISOString(),
  }
  const scoreUpdate = {
    changed: true,
    previousScore: 72,
    previousStatusLabel: 'Partiellement conforme',
    nextScore: 88,
    nextStatusLabel: 'Partiellement conforme',
    requiresReview: false,
  }

  await mockShowcaseApis(page, [publishedEntry])
  await page.route(/\/api\/site-insight\?preview=1$/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ...updatedEntry,
        submissionStatus: 'update',
        preview: true,
        previewToken: 'a'.repeat(32),
        scoreUpdate,
        message: 'Score de conformité modifié depuis la publication : 72 % → 88 %. Confirmez l’envoi pour mettre à jour la fiche publiée.',
      }),
    }),
  )
  let confirmBody: Record<string, unknown> | null = null
  await page.route(/\/api\/site-insight$/, (route) => {
    confirmBody = route.request().postDataJSON() as Record<string, unknown>
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ...updatedEntry,
        submissionStatus: 'updated',
        scoreUpdate,
        message: 'Score de conformité modifié depuis la publication : 72 % → 88 %. La fiche est mise à jour.',
      }),
    })
  })

  await page.goto('/')
  await page.fill('#url', 'https://site-deja-publie.fr/')
  await page.getByRole('button', { name: 'Lancer la pré-analyse' }).click()

  await expect(page.getByText('Score actuel de la fiche publiée')).toBeVisible()
  await expect(page.getByText('Mise à jour de la fiche publiée')).toBeVisible()
  await expect(page.getByText('Nouveau score détecté')).toBeVisible()

  await page.getByRole('button', { name: /Confirmer/ }).first().click()
  await expect.poll(() => confirmBody?.previewToken).toBe('a'.repeat(32))

  const panel = page.locator('section[aria-labelledby="site-ajoute-titre"]')
  await expect(page.locator('#site-ajoute-titre')).toHaveText('Fiche mise à jour')
  await expect(panel).toBeFocused()
  await expect(page.locator('#site-ajoute-detail')).toContainText('remonte en tête')
})
