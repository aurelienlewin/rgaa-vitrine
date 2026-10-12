import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

// RGAA 4.1.2 regression filters for the « Sobre » design system (docs/design-system.md):
// axe-core WCAG 2.2 AA + best practices, status messages (7.5), skip links (12.7) and focus continuity (12.8).

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']
const PUBLIC_ROUTES = ['/', '/plan-du-site', '/accessibilite', '/site/site-0-exemple-fr']
const SKIP_LINK_ORDER = ['Aller au contenu', 'Aller à la navigation principale', 'Aller à la recherche annuaire']

const entries = Array.from({ length: 14 }, (_, index) => ({
  normalizedUrl: `https://site-${index}.exemple${index}.fr/`,
  siteTitle: index % 3 === 0 ? `Accessibilité ${index}` : `Site ${index}`,
  slug: `site-${index}-exemple-fr`,
  profilePath: `/site/site-${index}-exemple-fr`,
  updatedAt: new Date(Date.UTC(2026, 2, index + 1, 12)).toISOString(),
  category: 'Administration',
  complianceStatus: index % 2 === 0 ? 'full' : 'partial',
  complianceStatusLabel: index % 2 === 0 ? 'Totalement conforme' : 'Partiellement conforme',
  complianceScore: index % 2 === 0 ? 100 : 80,
  rgaaBaseline: '4.1',
  thumbnailUrl: null,
  accessibilityPageUrl: `https://site-${index}.exemple${index}.fr/accessibilite`,
  upvoteCount: index,
  hasUpvoted: false,
  votesBlocked: false,
}))

async function mockPublicApis(page: Page) {
  const json = (body: unknown, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) })
  await page.route(/\/api\/maintenance$/, (route) => route.fulfill(json({ enabled: false })))
  await page.route(/\/api\/showcase(?:\?.*)?$/, (route) => {
    const slug = new URL(route.request().url()).searchParams.get('slug')
    const entry = slug ? entries.find((candidate) => candidate.slug === slug) : null
    return route.fulfill(json(slug ? { entries: entry ? [entry] : [], entry } : { entries }))
  })
  await page.route(/\/api\/showcase\/vote-state(?:\?.*)?$/, (route) =>
    route.fulfill(json({ votedUrls: [], countsByUrl: {} })),
  )
  await page.route(/\/api\/domain-groups(?:\?.*)?$/, (route) => route.fulfill(json({ groups: [] })))
}

for (const width of [1280, 320]) {
  for (const route of PUBLIC_ROUTES) {
    test(`axe WCAG 2.2 AA sans violation sur ${route} à ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await mockPublicApis(page)
      await page.goto(route)
      await expect(page.locator('main')).toBeVisible()
      await page.waitForLoadState('networkidle')
      const { violations } = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze()
      expect(violations.map((violation) => `${violation.id} (${violation.nodes.length})`)).toEqual([])
    })
  }
}

test('RGAA 12.7 : les liens d’évitement suivent le même ordre et restent dans la page', async ({ page }) => {
  for (const route of PUBLIC_ROUTES) {
    await mockPublicApis(page)
    await page.goto(route)
    // The tray is translated off-screen until focused: query it by structure rather than accessible role.
    const skipLinks = page.locator('nav[aria-label="Liens d’évitement"] a')
    await expect(skipLinks.first()).toBeAttached()
    const names = (await skipLinks.allTextContents()).map((name) => name.trim())
    expect(names.slice(0, SKIP_LINK_ORDER.length), route).toEqual(SKIP_LINK_ORDER)
    const hrefs = await skipLinks.evaluateAll((links) => links.map((link) => link.getAttribute('href') ?? ''))
    expect(hrefs.filter((href) => !href.startsWith('#')), route).toEqual([])
  }
})

test('RGAA 7.5 : la recherche annonce le nombre de résultats sans déplacer le focus', async ({ page }) => {
  await mockPublicApis(page)
  await page.goto('/')
  await expect(page.locator('#liste-vitrines > li').first()).toBeVisible()

  const search = page.locator('#accueil-recherche-annuaire')
  await search.fill('accessibilité')
  await expect(page.getByRole('status').filter({ hasText: 'fiche(s) filtrée(s)' })).toHaveCount(1)
  await expect(search).toBeFocused()
})

test('RGAA 12.8 : le focus reste sur le bouton de vote pendant l’envoi', async ({ page }) => {
  await mockPublicApis(page)
  let releaseVote: () => void = () => {}
  await page.route(/\/api\/showcase\/upvote$/, async (route) => {
    await new Promise<void>((resolve) => {
      releaseVote = resolve
    })
    await route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"Votes indisponibles."}' })
  })
  await page.goto('/')
  const voteButton = page.getByRole('button', { name: /Soutenir ce site/ }).first()
  await voteButton.click()

  await expect(voteButton).toHaveAttribute('aria-disabled', 'true')
  await expect(voteButton).toBeFocused()
  releaseVote()
  await expect(page.getByRole('alert').filter({ hasText: 'Impossible d’enregistrer le vote' })).toHaveCount(1)
  await expect(voteButton).toBeFocused()
})
