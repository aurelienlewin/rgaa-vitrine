import { expect, test, type Page } from '@playwright/test'

// WCAG 2.2 regression filters: 2.5.8 target size (minimum), 2.4.11 focus not obscured (minimum),
// 1.4.10 reflow at 320 px, and 3.3.8 accessible authentication on the moderation token form.
// Sources: https://www.w3.org/WAI/WCAG22/quickref/ and https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/

const MIN_TARGET_SIZE_PX = 24
const ROUTES = ['/', '/plan-du-site', '/accessibilite', '/moderation']
const VIEWPORT_WIDTHS = [1280, 320]
const TAB_STOPS_TO_CHECK = 40

async function mockPublicApis(page: Page) {
  const entries = Array.from({ length: 3 }, (_, index) => ({
    normalizedUrl: `https://site-${index}.exemple.fr/`,
    siteTitle: `Site ${index}`,
    updatedAt: '2026-03-01T12:00:00.000Z',
    category: 'Administration',
    complianceStatus: 'full',
    complianceStatusLabel: 'Totalement conforme',
    complianceScore: 100,
    rgaaBaseline: '4.1',
    thumbnailUrl: null,
    accessibilityPageUrl: `https://site-${index}.exemple.fr/accessibilite`,
    upvoteCount: 1,
    hasUpvoted: false,
    votesBlocked: false,
  }))
  const json = (body: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })

  await page.route(/\/api\/maintenance$/, (route) => route.fulfill(json({ enabled: false })))
  await page.route(/\/api\/showcase(?:\?.*)?$/, (route) => route.fulfill(json({ entries })))
  await page.route(/\/api\/showcase\/vote-state(?:\?.*)?$/, (route) =>
    route.fulfill(json({ votedUrls: [], countsByUrl: {} })),
  )
  await page.route(/\/api\/domain-groups(?:\?.*)?$/, (route) => route.fulfill(json({ groups: [] })))
}

for (const width of VIEWPORT_WIDTHS) {
  for (const route of ROUTES) {
    test(`WCAG 2.2 cibles, focus et reflow sur ${route} à ${width}px`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.setViewportSize({ width, height: 900 })
      await mockPublicApis(page)
      await page.goto(route)
      await expect(page.locator('main')).toBeVisible()

      // 2.5.8: inline links inside sentences are exempt; every other target must reach 24×24 px.
      const undersizedTargets = await page.evaluate((minSize) => {
        const selector =
          'a[href], button, input:not([type="hidden"]), select, textarea, summary, [role="button"], [tabindex="0"]'
        return Array.from(document.querySelectorAll<HTMLElement>(selector))
          .filter((element) => !element.closest('[aria-hidden="true"]') && !element.hidden)
          .flatMap((element) => {
            const rect = element.getBoundingClientRect()
            const style = getComputedStyle(element)
            if (rect.width === 0 || rect.height === 0 || style.visibility === 'hidden') {
              return []
            }
            if (element.tagName === 'A' && style.display === 'inline') {
              return []
            }
            if (rect.width >= minSize && rect.height >= minSize) {
              return []
            }
            const name = (element.textContent || element.getAttribute('aria-label') || element.tagName).trim()
            return [`${element.tagName} ${Math.round(rect.width)}x${Math.round(rect.height)} « ${name.slice(0, 60)} »`]
          })
      }, MIN_TARGET_SIZE_PX)
      expect(undersizedTargets).toEqual([])

      // 1.4.10: no horizontal scrolling.
      const horizontalOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )
      expect(horizontalOverflow).toBeLessThanOrEqual(0)

      // 2.4.11: the focused element is never entirely hidden by other content.
      const obscuredFocus: string[] = []
      for (let index = 0; index < TAB_STOPS_TO_CHECK; index += 1) {
        await page.keyboard.press('Tab')
        const issue = await page.evaluate(() => {
          const element = document.activeElement as HTMLElement | null
          if (!element || element === document.body) {
            return null
          }
          const rect = element.getBoundingClientRect()
          const isOffscreen = rect.bottom <= 0 || rect.top >= window.innerHeight
          const probes: Array<[number, number]> = [
            [rect.left + rect.width / 2, rect.top + rect.height / 2],
            [rect.left + 2, rect.top + 2],
            [rect.right - 2, rect.bottom - 2],
          ]
          const isCovered = probes.every(([x, y]) => {
            const hit = document.elementFromPoint(x, y)
            return Boolean(hit) && !element.contains(hit) && !hit!.contains(element)
          })
          if (!isOffscreen && !isCovered) {
            return null
          }
          return `${element.tagName} « ${(element.textContent ?? '').trim().slice(0, 60)} »`
        })
        if (issue) {
          obscuredFocus.push(issue)
        }
      }
      expect(obscuredFocus).toEqual([])
    })
  }
}

test('WCAG 3.3.8 le formulaire de jeton accepte les gestionnaires de mots de passe', async ({ page }) => {
  await mockPublicApis(page)
  await page.goto('/moderation')

  const tokenInput = page.locator('#token-moderation')
  await expect(tokenInput).toHaveAttribute('autocomplete', 'current-password')
  await expect(page.locator('input[autocomplete="username"]')).toHaveCount(1)

  const toggle = page.getByRole('button', { name: 'Afficher le jeton' })
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  await expect(tokenInput).toHaveAttribute('type', 'text')
})

test('les liens ouvrant un nouvel onglet l’indiquent dans leur nom accessible', async ({ page }) => {
  for (const route of ROUTES) {
    await mockPublicApis(page)
    await page.goto(route)
    await expect(page.locator('main')).toBeVisible()
    const unlabeled = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLAnchorElement>('a[target="_blank"]'))
        .map((link) => (link.getAttribute('aria-label') ?? link.textContent ?? '').trim())
        .filter((name) => !name.includes('nouvel onglet')),
    )
    expect(unlabeled, route).toEqual([])
  }
})
