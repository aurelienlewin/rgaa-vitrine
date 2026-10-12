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
  await page.route(/\/api\/moderation\/github-issues$/, (route) =>
    route.fulfill(json({ enabled: true, repo: 'owner/repo', issues: [] })),
  )
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

// Playwright runs the most recently registered matching route first: test-specific routes go after the defaults.
async function unlockModeration(page: Page, registerTestRoutes?: () => Promise<void>) {
  await mockModerationApis(page)
  await registerTestRoutes?.()
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

test.describe('issues GitHub de notification', () => {
  const issues = [
    {
      number: 13,
      title: '[ÉCHEC SOUMISSION] verification-jeton-github-2.invalid - client-network',
      kind: 'submission-failure',
      createdAt: '2026-10-12T20:42:16.000Z',
      url: 'https://github.com/aurelienlewin/rgaa-vitrine/issues/13',
      labels: ['bug'],
    },
    {
      number: 12,
      title: '[INFO PUBLICATION AUTO] Infogreen Factory',
      kind: 'auto-approved-publication',
      createdAt: '2026-05-12T06:53:32.000Z',
      url: 'https://github.com/aurelienlewin/rgaa-vitrine/issues/12',
      labels: [],
    },
  ]

  test('ferme la sélection après confirmation en deux temps et annonce le résultat', async ({ page }) => {
    let openIssues = [...issues]
    let closeRequest: Record<string, unknown> | null = null
    await unlockModeration(page, async () => {
      await page.route(/\/api\/moderation\/github-issues$/, (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ enabled: true, repo: 'aurelienlewin/rgaa-vitrine', issues: openIssues }),
        }),
      )
      await page.route(/\/api\/moderation\/github-issues\/close$/, async (route) => {
        closeRequest = route.request().postDataJSON() as Record<string, unknown>
        openIssues = openIssues.filter((issue) => issue.number !== 13)
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ results: [{ number: 13, ok: true, alreadyClosed: false }], closedCount: 1, failedCount: 0 }),
        })
      })
    })
    const section = page.locator('#issues-github')
    await expect(section.getByRole('link', { name: 'Voir l’issue #13 sur GitHub (nouvel onglet)' })).toBeVisible()

    await section.getByRole('checkbox', { name: /#13 \[ÉCHEC SOUMISSION\]/ }).check()
    await section.getByRole('radio', { name: /Sans suite/ }).check()
    const closeButton = section.getByRole('button', { name: 'Fermer la sélection (1)' })
    await closeButton.click()
    expect(closeRequest).toBeNull()

    await section.getByRole('button', { name: 'Confirmer la fermeture de 1 issue(s)' }).click()
    await expect.poll(() => closeRequest).toEqual({ numbers: [13], reason: 'not_planned' })

    const status = section.getByRole('status')
    await expect(status).toHaveText('1 issue(s) fermée(s) comme sans suite.')
    await expect(status).toBeFocused()
    await expect(section.getByRole('checkbox', { name: /#13/ })).toHaveCount(0)
    await expect(section.getByRole('checkbox', { name: /#12/ })).toBeVisible()
  })

  test('annuler la confirmation n’envoie aucune fermeture', async ({ page }) => {
    let closeCalls = 0
    await unlockModeration(page, async () => {
      await page.route(/\/api\/moderation\/github-issues$/, (route) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ enabled: true, issues }) }),
      )
      await page.route(/\/api\/moderation\/github-issues\/close$/, (route) => {
        closeCalls += 1
        return route.fulfill({ status: 200, contentType: 'application/json', body: '{"results":[]}' })
      })
    })
    const section = page.locator('#issues-github')
    await section.getByRole('button', { name: /Tout sélectionner/ }).click()
    await section.getByRole('button', { name: 'Fermer la sélection (2)' }).click()
    await section.getByRole('button', { name: 'Annuler' }).click()
    await expect(section.getByRole('button', { name: 'Fermer la sélection (2)' })).toBeVisible()
    expect(closeCalls).toBe(0)
  })
})

test.describe('suppression des échecs de soumission', () => {
  const second = { ...failureRecord, reference: 'SUB-0BA4BFC9EF', host: 'verification-jeton-github.invalid' }

  test('supprime un incident après confirmation et annonce le résultat', async ({ page }) => {
    let deleteBody: Record<string, unknown> | null = null
    await unlockModeration(page, async () => {
      await page.route(/\/api\/moderation\/submission-failures(?:\?.*)?$/, (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ failures: [failureRecord, second], retentionDays: 30 }),
        }),
      )
      await page.route(/\/api\/moderation\/submission-failures\/delete$/, (route) => {
        deleteBody = route.request().postDataJSON() as Record<string, unknown>
        return route.fulfill({ status: 200, contentType: 'application/json', body: '{"deletedCount":1}' })
      })
    })

    const section = page.locator('#echecs-soumission')
    await section.getByRole('button', { name: 'Supprimer l’incident SUB-53F0E63AB4' }).click()
    expect(deleteBody).toBeNull()
    await section.getByRole('button', { name: 'Confirmer la suppression de SUB-53F0E63AB4' }).click()

    await expect.poll(() => deleteBody).toEqual({ references: ['SUB-53F0E63AB4'] })
    const status = section.getByRole('status')
    await expect(status).toHaveText('Incident SUB-53F0E63AB4 supprimé.')
    await expect(status).toBeFocused()
    await expect(section.getByRole('button', { name: /SUB-53F0E63AB4/ })).toHaveCount(0)
    await expect(section.getByRole('button', { name: 'Supprimer l’incident SUB-0BA4BFC9EF' })).toBeVisible()
  })

  test('vide tout le journal après confirmation, annuler ne supprime rien', async ({ page }) => {
    const deleteBodies: Array<Record<string, unknown>> = []
    await unlockModeration(page, async () => {
      await page.route(/\/api\/moderation\/submission-failures(?:\?.*)?$/, (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ failures: [failureRecord, second], retentionDays: 30 }),
        }),
      )
      await page.route(/\/api\/moderation\/submission-failures\/delete$/, (route) => {
        deleteBodies.push(route.request().postDataJSON() as Record<string, unknown>)
        return route.fulfill({ status: 200, contentType: 'application/json', body: '{"deletedCount":2,"cleared":true}' })
      })
    })

    const section = page.locator('#echecs-soumission')
    await section.getByRole('button', { name: 'Vider la liste des échecs' }).click()
    await section.getByRole('button', { name: 'Annuler' }).click()
    expect(deleteBodies).toHaveLength(0)

    await section.getByRole('button', { name: 'Vider la liste des échecs' }).click()
    await section.getByRole('button', { name: 'Confirmer : supprimer tout le journal des échecs' }).click()
    await expect.poll(() => deleteBodies).toEqual([{ all: true }])
    await expect(section.getByRole('status')).toHaveText('Liste des échecs vidée : 2 incident(s) supprimé(s).')
    await expect(section.getByText('Aucun échec de soumission enregistré sur les 30 derniers jours.')).toBeVisible()
    await expect(section.getByRole('button', { name: 'Vider la liste des échecs' })).toBeDisabled()
  })
})
