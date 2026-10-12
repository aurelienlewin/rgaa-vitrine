import { expect, test, type Page } from '@playwright/test'

const failureRecord = {
  reference: 'SUB-53F0E63AB4',
  occurredAt: '2026-10-12T19:40:00.000Z',
  stage: 'preview',
  source: 'server',
  host: 'lenord.fr',
  inputUrl: 'http://lenord.fr/',
  errorCode: 'internal-error',
  statusCode: 500,
  message: 'Erreur interne lors de l’analyse.',
  userAgent: 'Mozilla/5.0',
  alert: { status: 'failed', reason: 'github-error', detail: 'GitHub notifier error: Bad credentials' },
}

async function mockModerationApis(page: Page) {
  const json = (body: unknown, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) })
  await page.route(/\/api\/maintenance$/, (route) => route.fulfill(json({ enabled: false })))
  await page.route(/\/api\/moderation\/pending(?:\?.*)?$/, (route) =>
    route.fulfill(json({ entries: [], pendingEntries: [], publishedGroups: [] })),
  )
  await page.route(/\/api\/moderation\/showcase(?:\?.*)?$/, (route) => route.fulfill(json({ entries: [] })))
  await page.route(/\/api\/moderation\/blocklist$/, (route) =>
    route.fulfill(json({ siteBlocklist: [], voteBlocklist: [] })),
  )
  await page.route(/\/api\/moderation\/maintenance$/, (route) =>
    route.fulfill(json({ enabled: false, message: null, effectiveMessage: 'Message', updatedAt: null })),
  )
  await page.route(/\/api\/moderation\/submission-failures(?:\?.*)?$/, (route) => {
    const reference = new URL(route.request().url()).searchParams.get('reference')
    if (!reference) {
      return route.fulfill(json({ failures: [failureRecord], retentionDays: 30 }))
    }
    if (reference === failureRecord.reference) {
      return route.fulfill(json({ failure: failureRecord }))
    }
    return route.fulfill(
      json({ error: 'Aucun incident enregistré pour cette référence (inconnue ou expirée après 30 jours).' }, 404),
    )
  })
}

async function unlockModeration(page: Page) {
  await mockModerationApis(page)
  await page.goto('/moderation')
  await page.fill('#token-moderation', 'token-moderation-e2e-123456')
  await page.getByRole('button', { name: 'Charger la modération' }).click()
  await expect(page.locator('#echecs-soumission-titre')).toBeVisible()
}

test('liste les derniers échecs de soumission avec le statut d’alerte', async ({ page }) => {
  await unlockModeration(page)

  const section = page.locator('#echecs-soumission')
  await expect(section.getByRole('heading', { name: /SUB-53F0E63AB4 · lenord\.fr · internal-error/ })).toBeVisible()
  await expect(section.getByText('Échec de l’alerte GitHub (GitHub notifier error: Bad credentials)')).toBeVisible()
})

test('retrouve un incident par sa référence et place le focus sur le résultat', async ({ page }) => {
  await unlockModeration(page)

  await page.fill('#failure-reference', 'sub-53f0e63ab4')
  await page.getByRole('button', { name: 'Rechercher l’incident' }).click()

  const resultHeading = page.getByRole('heading', { name: 'Incident SUB-53F0E63AB4' })
  await expect(resultHeading).toBeFocused()
  await expect(page.locator('#echecs-soumission').getByText('http://lenord.fr/').first()).toBeVisible()
})

test('signale une référence mal formée ou inconnue et rend le focus au champ', async ({ page }) => {
  await unlockModeration(page)
  const input = page.locator('#failure-reference')

  await input.fill('SUB-XYZ')
  await page.getByRole('button', { name: 'Rechercher l’incident' }).click()
  await expect(page.locator('#failure-reference-error')).toContainText('Référence invalide')
  await expect(input).toHaveAttribute('aria-invalid', 'true')
  await expect(input).toHaveAttribute('aria-describedby', /failure-reference-error/)
  await expect(input).toBeFocused()

  await input.fill('SUB-EA82279803')
  await page.getByRole('button', { name: 'Rechercher l’incident' }).click()
  await expect(page.locator('#failure-reference-error')).toContainText('Aucun incident enregistré')
  await expect(input).toBeFocused()
})
