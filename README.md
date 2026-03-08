# Annuaire RGAA

> Showcase and celebrate RGAA compliance in French web ecosystems.

![Annuaire RGAA logo](./public/logo-rgaa-vitrine.svg)

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)
[![Vite](https://img.shields.io/badge/Vite-7.x-646CFF.svg)](https://vite.dev/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-v4-06B6D4.svg)](https://tailwindcss.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6.svg)](https://www.typescriptlang.org/)

Annuaire RGAA is an open-source French-first directory that lets organizations publish a
public RGAA pride listing: site metadata, detected accessibility statement page, and
declared compliance indicators.

Planned public website: **https://annuaire-rgaa.fr**

## Highlights

- Simple French UI focused on listing discovery first.
- Multiple skip links for keyboard navigation (`contenu`, `recherche`, `filtres`, `ajout`, `aide`, `pied de page`), hidden by default and revealed on keyboard focus.
- Programmatic focus management on skip-link targets and dynamic feedback blocks (errors/status).
- Keyboard filter ergonomics: `Échap` clears search input and a dedicated reset button restores all filters.
- Explicit filter CTA with a `Rechercher` button for clear submit action and predictable keyboard flow.
- Shared global search entry point (`#moteur-recherche-global`) reused across homepage, secondary pages, and quick links.
- Progressive tile pagination in the directory (`24` cards per batch) with a manual `Charger plus` action.
- Automatic lazy loading of additional tiles near viewport end (with keyboard-accessible manual fallback).
- Reddit-like upvote on each directory tile with accessible button state (`aria-pressed`) and live vocal feedback.
- Each directory tile now includes an explicit RGAA baseline badge (`RGAA 4.1` or `RGAA 5.0 prêt`) with readable explanation text.
- Submission flow now includes a pre-analysis step before confirmation, exposing detected title/status/score/accessibility URL before final send.
- Confirmation CTA now lives inside the post pre-analysis verification panel; the initial pre-analysis button is disabled after analysis to prevent action ambiguity.
- Each listed site now has a dedicated public profile page (`/site/{slug}`) with shareable metadata and backlink snippet.
- Profile pages now expose stronger SEO/IA signals: dedicated `WebPage` + `Dataset` structured data, direct API link (`/api/showcase?slug={slug}`), and related-profile internal linking.
- Add-site flow now exposes a visible category dropdown (including `Coopérative et services`) without custom free-text entry.
- Localized live region announcements for dynamic feedback (`polite` for status, `assertive` for errors).
- Tailwind v4.2 accessibility helpers are used where relevant: `wrap-anywhere`, `user-valid` / `user-invalid`, and logical utilities (`start-*`, `ps-*`) to avoid direction-specific custom positioning/padding.
- Showcase thumbnails are treated as decorative visuals when equivalent textual information is already present in cards.
- User preference support for low vision and motion sensitivity (`prefers-color-scheme`, `prefers-reduced-motion`, `prefers-contrast`, `forced-colors`).
- High-contrast color system tuned for low-vision navigation in both light and dark modes (including stronger visited-link and status semantics).
- Persistent light/dark mode toggle available on both directory and moderation screens.
- Dark mode styling is consistently applied through Tailwind `dark:` variants to avoid mixed-theme rendering.
- Discreet footer build stamp (`version + UTC timestamp`) helps detect stale cache quickly.
- Footer version now resolves from release tags first (with package version fallback) to stay aligned with published GitHub releases.
- Footer now uses a clearer three-column information architecture (`Projet`, `Navigation rapide`, `Soutien`) on large screens.
- Secondary pages (`/plan-du-site`, `/accessibilite`, `/site/{slug}`, `/moderation`) now share a consistent top navigation and the same global footer as homepage.
- Global `:focus-visible` fallback styles reinforce WCAG 2.2 focus visibility on all controls.
- Route lazy-loading fallback is announced as status (`aria-live="polite"`) to avoid silent loading states.
- Lazy-loaded completion states are now also announced on `/site/{slug}` and `/plan-du-site` (successful load, empty result, and loading error) via dedicated polite live regions.
- UI typography avoids tiny text; informational content and metadata are rendered at `text-sm` or above.
- Muted text and status colors are tuned for stronger contrast in both light and dark themes.
- Default typography now prioritizes `Atkinson Hyperlegible` for broad readability, with `OpenDyslexic` and `Lexend` as accessible fallbacks.
- Logo strategy is now icon-only in SVG; textual branding is rendered in semantic Tailwind UI for robust responsive display.
- Directory-first UX with filters, categories, and search at the core.
- Score is treated as a compass, not the goal: priority is to unblock customer journeys and deliver usable UX for everyone.
- URL registration workflow with secure server-side metadata enrichment.
- Dedicated moderation UI at `/moderation` for approving/rejecting pending submissions.
- Moderation dashboards and controls stay hidden until a valid moderation token is submitted.
- Moderation token session can now be restored automatically (tab session by default, optional 12h persistence on the current device) with an explicit sign-out/forget action.
- Dedicated moderation UI now supports published entry editing and deletion (title, category, score, status, RGAA baseline badge, vignette, accessibility URL).
- Moderation now includes editable site blocklist and vote-blocklist controls, plus a single action to delete and block a published site.
- Moderation forms now strengthen input assistance (`required`, typed URL fields, explicit score guidance) and row-level action labels for assistive technologies.
- Public accessibility declaration page at `/accessibilite` including compliance status, follow-up commitments, and contact.
- Annuaire listing cards designed for disabled people and accessibility enthusiasts.
- RGAA awareness sections sourced from official French references.
- WCAG 2.2 awareness and references embedded in the UI.
- Tailwind CSS v4 native features used directly (`@theme` tokens + utility-first focus/skip-link patterns).
- Embedded skills: `rgaa-official-recommendations`, `wcag-22-official-guidelines`.
- Frontend route bundles are split (`/moderation`, `/plan-du-site`, `/accessibilite`) to reduce initial JavaScript on homepage load.
- Secondary local fonts (`OpenDyslexic`, `Lexend`) are now loaded after first paint (idle callback), keeping critical render path lighter.

## Tech Stack

- Vite + React + TypeScript
- Tailwind CSS v4 via `@tailwindcss/vite`
- Node + Express API
- Upstash Redis (optional but recommended) for persistent showcase storage
- API-side in-memory Redis cache (TTL-based) to reduce repeated Upstash reads
- Vote-state retrieval optimized for Redis limits (client vote index + TTL cache), avoiding per-tile membership bursts
- Redis payloads are compacted on write (short field names, epoch timestamps, hashed vote fingerprints) to lower Upstash storage footprint
- Local self-hosted fonts via `@fontsource` (`opendyslexic`, `atkinson-hyperlegible`, `lexend`)

## Persistence (Redis)

The API supports two storage modes:

- `redis` when Upstash env variables are configured
- `memory` fallback when Redis config is missing (non-persistent)

Create a local env file from `.env.example` and configure:

```bash
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
```

Alternative compatible names are also supported:

```bash
KV_REST_API_URL=...
KV_REST_API_TOKEN=...
```

API scripts auto-load `.env.local` when present.

Optional performance setting:

```bash
REDIS_CACHE_TTL_MS=15000
```

This enables short-lived server-side caching for Redis-backed listing/moderation reads and vote-state hydration, to avoid unnecessary Upstash queries on repeated requests.

Storage optimization notes:

- Pending lookup no longer persists a separate URL index hash: submission IDs are deterministic from normalized URLs.
- New writes use compact Redis hash fields and unix timestamps to reduce bytes stored per entry.
- Vote fingerprint tokens are stored as short hashed tokens (`h:*`) to reduce set memory usage.
- Backward compatibility is preserved for previously stored legacy records and vote tokens.

Optional vote hardening setting:

```bash
VOTE_FINGERPRINT_SALT=change-this-random-secret
```

Use a custom secret in production so vote fingerprints cannot be reproduced across environments.

You can check the active storage mode via:

- `GET /api/health`
- `GET /api/showcase`

## Security by default

- Strict URL validation (`http/https` only)
- SSRF protections (localhost/private/internal targets blocked)
- Redirect-by-redirect SSRF validation (each HTTP redirection target is revalidated before fetch)
- DNS resolution checks before remote fetch
- Response timeout and maximum HTML size limits
- Global rate limiting on API endpoints + stricter hourly limiter for submissions
- Dedicated moderation-auth hardening: `MODERATION_API_TOKEN` must be strong (minimum `32` chars) and failed moderation auth attempts are throttled.
- Dedicated vote anti-abuse controls: one-vote safeguards per user/browser fingerprint + per network fingerprint, plus hourly vote rate limiting
- Forwarded IP headers are now validated as real IPs before contributing to anti-abuse vote fingerprints.
- Moderation-enforced site blocklist now prevents new submissions on blocked URLs.
- Moderation-enforced vote blocking now disables upvotes for selected URLs.
- Moderation archive hardening: optional HMAC-signed exports/imports (`MODERATION_ARCHIVE_SIGNING_SECRET`) and rollback guard for destructive `replace` imports.
- GitHub notifier hardening: explicit notifier token env vars only, strict public-HTTPS validation for custom GitHub API base URL, and short outbound timeout.
- Domain-level deduplication via canonical URL normalization (e.g. `www` variants collapse)
- Honeypot field validation to reduce automated spam submissions
- Automatic spam/marketing signal rejection (quality filter)
- Manual-review queue for non-auto-publishable submissions (pending until moderator action)
- No execution of remote page scripts

## Accessibility Preferences

The UI now adapts automatically to operating-system and browser accessibility preferences:

- Dark mode (`prefers-color-scheme`)
- Reduced motion (`prefers-reduced-motion`)
- Increased contrast (`prefers-contrast: more`)
- Forced colors / high-contrast modes (`forced-colors: active`)

## Accessibility Remediation Traceability

Latest production audit baseline consumed (March 7, 2026) covers:

- `/` (home)
- `/plan-du-site`
- `/accessibilite`
- `/site/{slug}`

Non-conform criteria identified in that baseline:

- `1.8` image-of-text usage in homepage thumbnails
- `3.3` insufficient UI component contrast
- `10.5` text/background declaration pairing drift
- `10.13` non-controllable hover/focus additional content
- `12.5` non-identical search engine reachability across pages

Remediation pass applied (March 8, 2026):

- Color/contrast hardening in both light and dark mode for primary actions, status chips, and disabled states.
- UI controls now prefer transparent surfaces + strong borders when embedded in same-color containers, to keep component boundaries visible.
- Contextual link distinguishability hardening (persistent underline + clear CTA/link differentiation).
- Search reachability harmonized across pages with a single shared global search pattern (`#moteur-recherche-global`).
- Native tooltip-only `title` attributes removed from alternate head links.
- Homepage thumbnails now expose empty `alt` when decorative, with card text carrying the informative content.
- Functional `noscript` fallback reinforced with direct access to key public resources.
- Mobile reflow hardening (320px width and constrained heights) on public and moderation views.
- Acronym disambiguation in editorial copy (RGAA / WCAG / UX expansions on first explanatory surfaces).
- Runtime CSS/style pairing hardening to avoid text/background declaration drift in utility-heavy stylesheets.
- Shared keyboard/focus/live-region behavior maintained across all major routes.

Operational note:

- If you rely on `rgaa:compliance-*` meta hints for your own site, deploy the latest frontend build before testing submissions, otherwise moderation may still classify the site with stale metadata.

## SEO

- Rich metadata: description, robots, canonical, hreflang
- Legacy `.org` host redirects at edge to `annuaire-rgaa.fr` to avoid duplicate indexing.
- Open Graph + Twitter Cards
- Structured data (JSON-LD): `WebSite`, `Organization`, `Person`, `CollectionPage`, `SiteNavigationElement`
- Structured data now also exposes `SearchAction` on homepage and `BreadcrumbList` on key secondary pages.
- Accessible public site map page: `/plan-du-site`
- Site map page now lists an extract of published `/site/{slug}` links to strengthen crawlable internal discovery.
- Public accessibility declaration page: `/accessibilite`
- Auto-generated sitemap endpoint: `/sitemap.xml` (backed by API route `/api/sitemap`)
- `sitemap.xml` is now served without caching (`no-store`) so newly published entries appear immediately after submission/moderation.
- Sitemap now includes the public data endpoint (`/api/showcase`) for dataset discovery.
- Sitemap now includes one public URL per referenced site profile (`/site/{slug}`).
- AI crawler files: `/llms.txt`, `/llms-full.txt`, `/ai-context.json` (and `/api/ai-context`)
- AI context now includes explicit site-profile patterns (`/site/{slug}`), API pattern (`/api/showcase?slug={slug}`), and crawl seed profile URLs.
- `public/robots.txt`
- Public showcase API includes cache headers (`Cache-Control`, `Last-Modified`) for crawler efficiency and reduced load.
- Serverless API adapter now normalizes absolute/relative request URLs before Express routing, reducing production fallback mismatches on `/api/*`.
- Host-level redirects must avoid cyclic `www`/apex rules, otherwise `/api/*` calls may fail and return non-API HTML payloads.
- Vercel rewrites now force `/api/*` through the single `/api` function entrypoint with preserved logical path, preventing SPA HTML fallback on API routes.
- Vercel Web Analytics is wired on frontend mount via `@vercel/analytics`.

## Getting Started

```bash
npm install
npm run dev
```

Local services:

- Frontend: `http://127.0.0.1:5173`
- API: `http://127.0.0.1:8787`

## API endpoints

- `POST /api/site-insight` registers/enriches one site entry in the directory
- `POST /api/site-insight?preview=1` runs pre-analysis without persistence (used by confirmation step)
- `GET /api/showcase` returns persisted showcase entries (supports `search`, `status`, `category`, `limit`, `clientVoterId`)
- `GET /api/showcase` also supports `slug` for single-profile retrieval and returns `slug` + `profilePath` for each entry.
- `POST /api/showcase/upvote` records one upvote for one listed site
- `GET /api/health` returns service status and active storage mode
- `GET /api/moderation/pending` returns pending moderation entries (protected)
- `POST /api/moderation/approve` approves one pending submission (protected)
- `POST /api/moderation/reject` rejects one pending submission (protected)
- `GET /api/moderation/showcase` lists published entries for admin operations (protected)
- `POST /api/moderation/showcase/update` updates one published entry (protected)
- `POST /api/moderation/showcase/delete` deletes one published entry (protected)
- `POST /api/moderation/showcase/delete-and-block` deletes and blocklists one published entry (protected)
- `GET /api/moderation/blocklist` returns site and vote blocklists (protected)
- `POST /api/moderation/blocklist/site` updates site blocklist state (protected)
- `POST /api/moderation/blocklist/votes` updates vote blocklist state (protected)
- `GET /api/moderation/archive` exports a full moderation archive (protected)
- `POST /api/moderation/archive/import` imports an archive in `merge` or `replace` mode (protected)

`POST /api/site-insight` behavior:

- `200` + `submissionStatus: "approved"` when published
- `200` + `submissionStatus: "duplicate"` when site already exists
- `202` + `submissionStatus: "pending"` when the site requires manual review
- `4xx` when rejected by validation/anti-abuse rules (spam, invalid input, etc.)
- Public submissions accept only moderator-approved category values from the dropdown; unknown values are normalized to `Autre`.

`POST /api/site-insight?preview=1` behavior:

- never persists data
- returns extracted metadata (`siteTitle`, `accessibilityPageUrl`, `complianceStatus`, `complianceScore`)
- returns projected `submissionStatus` (`approved`, `pending`, `duplicate`) with explanatory `message`

Public profile pages:

- `/site/{slug}` exposes one dedicated page per referenced site with canonical metadata, outbound links, backlink snippet, and a direct dataset endpoint.
- Each profile page also links to related profiles in the same category to strengthen internal crawl paths.
- Outbound links to referenced sites use `noopener` without `noreferrer` so referral analytics can identify annuaire-rgaa.fr.

`POST /api/moderation/showcase/update` body:

```json
{
  "normalizedUrl": "https://impots.gouv.fr/",
  "siteTitle": "impots.gouv.fr",
  "category": "Administration",
  "complianceStatus": "partial",
  "complianceScore": 96.51,
  "rgaaBaseline": "4.1",
  "thumbnailUrl": "https://www.impots.gouv.fr/example-image.jpg",
  "accessibilityPageUrl": "https://www.impots.gouv.fr/accessibilite"
}
```

`POST /api/moderation/showcase/delete` body:

```json
{
  "normalizedUrl": "https://impots.gouv.fr/"
}
```

`POST /api/moderation/archive/import` body:

```json
{
  "mode": "merge",
  "allowRollback": false,
  "archive": {
    "format": "annuaire-rgaa-archive",
    "version": 1,
    "exportedAt": "2026-03-06T18:45:00.000Z",
    "storageMode": "redis",
    "data": {
      "entries": [],
      "pendingEntries": [],
      "siteBlocklist": [],
      "voteBlocklist": [],
      "voteTokensByUrl": [],
      "clientVotesByIndex": []
    }
  }
}
```

Notes:

- `complianceScore` accepts decimals (example: `96.51`) and is normalized between `0` and `100`.
- `rgaaBaseline` accepts `4.1` or `5.0-ready` to control the public RGAA badge.
- `thumbnailUrl` and `accessibilityPageUrl` are optional; send `null` (or an empty UI value) to clear them.
- Edited URLs are validated server-side (public HTTP/HTTPS only).
- `mode: "merge"` merges archive content with current storage; `mode: "replace"` clears storage before importing.
- `allowRollback` is optional (`false` by default). Keep it `false` for safe imports; set `true` only when intentionally restoring an older archive in `replace` mode.
- Exported archive payload is readable JSON (entries, pending queue, blocklists, vote fingerprints, client vote indexes).
- If `MODERATION_ARCHIVE_SIGNING_SECRET` is configured, archive exports include an `integrity` HMAC signature and imports require a valid signature.

`POST /api/showcase/upvote` body:

```json
{
  "normalizedUrl": "https://www.impots.gouv.fr/",
  "clientVoterId": "voter_q8r7m5h4q3w2e1z9"
}
```

Vote notes:

- `clientVoterId` is generated and persisted in browser storage by the frontend.
- The API combines client and network-based fingerprints to block repeated votes on the same site.
- Successful response returns the updated entry (`upvoteCount`, `hasUpvoted`, `votesBlocked`) plus a localized `message`.
- When moderation blocks votes on one URL, public vote controls are dimmed and unavailable for this tile.

RGAA baseline notes:

- `rgaaBaseline` is exposed in showcase entries (`4.1` or `5.0-ready`).
- Existing and newly ingested entries default to `4.1` until a moderator explicitly overrides the badge.
- `5.0-ready` is applied only through moderation override.

### Manual moderation workflow

1. A submission requiring human review is stored server-side as `pending`.
2. A moderator opens `/moderation`, enters the moderation token, and loads the pending queue.
3. The moderator approves or rejects each entry from the UI (the page calls moderation APIs with `submissionId`).
4. The moderator can edit, delete, delete+block, manage site/vote blocklists, set custom categories, and archive/restore the full database directly from `/moderation`.

Endpoints are protected by `MODERATION_API_TOKEN`.

Set it in local/Vercel environment:

```bash
MODERATION_API_TOKEN=replace-with-a-long-random-token
```

Security requirement: use at least `32` characters.

Send it via header:

```bash
x-moderation-token: <MODERATION_API_TOKEN>
```

### GitHub-native moderation notifications

You can trigger free GitHub notifications each time a new submission enters manual review.

Set these environment variables:

```bash
GITHUB_NOTIFY_REPO=owner/repo
GITHUB_NOTIFY_TOKEN=github_pat_xxx
```

If you store values in GitHub Actions secrets/variables, use these fallback names instead
(GitHub blocks secret/variable names starting with `GITHUB_`):

```bash
RGAA_NOTIFY_REPO=owner/repo
RGAA_NOTIFY_TOKEN=github_pat_xxx
```

Optional:

```bash
GITHUB_NOTIFY_LABELS=moderation,annuaire-rgaa
PUBLIC_APP_URL=https://annuaire-rgaa.fr
# For GitHub Enterprise/API proxy only (must be public HTTPS, no localhost/private hosts)
# GITHUB_API_URL=https://github.example.com/api/v3
```

Behavior:

- On new `pending` moderation submission, the API creates one GitHub issue in `GITHUB_NOTIFY_REPO`.
- GitHub notifications are then handled natively by your repo notification settings.
- Notification failure does not block user submission flow.
- The notifier does not read `GITHUB_TOKEN`; use `GITHUB_NOTIFY_TOKEN` or `RGAA_NOTIFY_TOKEN` explicitly.

Recommended GitHub setup:

1. Enable repository notifications for Issues (or Watch -> Custom -> Issues).
2. Use a fine-grained PAT scoped to one repository with Issues write access.
3. Keep `GITHUB_API_URL` unset unless required by GitHub Enterprise routing.

## Deployment (Vercel)

The repository uses consolidated Vercel serverless handlers in `api/`:

- `api/index.js` for `/api`
- `api/[...slug].js` for all nested API routes (`/api/*`)
- `api/_run-app.js` shared adapter toward `server/app.js`

This avoids production `NOT_FOUND` responses on `/api/*` routes when the frontend is deployed as a Vite app.
It also keeps function count low for Vercel Hobby plan limits.
Vercel rewrites also ensure SPA routes (including `/moderation`) resolve to `index.html` instead of returning 404 on refresh/direct access.

Ensure these environment variables are configured in Vercel project settings:

- `KV_REST_API_URL` and `KV_REST_API_TOKEN`
or
- `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
- `MODERATION_API_TOKEN` (required to enable manual moderation API)
- `MODERATION_ARCHIVE_SIGNING_SECRET` (optional but recommended; signs archive exports and enforces signature verification on imports)
- `GITHUB_NOTIFY_REPO` and `GITHUB_NOTIFY_TOKEN` (optional, enables GitHub issue notifications for pending moderation)
- `GITHUB_NOTIFY_LABELS` and `PUBLIC_APP_URL` (optional)
- `GITHUB_API_URL` (optional, GitHub Enterprise/API gateway only; must be a public HTTPS URL)

## Scripts

```bash
npm run dev
npm run lint
npm run build
npm run preview
npm run start:api
```

## Open Source

- License: [MIT](./LICENSE)
- Contributing guide: [CONTRIBUTING.md](./CONTRIBUTING.md)
- Code of Conduct: [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)
- Security policy: [SECURITY.md](./SECURITY.md)

## Support

I launched this directory so RGAA would not remain a label, but become a promise kept for every person.
When empathy guides product decisions, business grows with fairness instead of friction.
The score is a compass, not the destination: the true target is unblocked journeys and usable experiences.

- Buy me a coffee: https://buymeacoffee.com/aurelienlewin

## Accessibility Sources Embedded

- `skill/rgaa-official-recommendations/SKILL.md`
- `skill/rgaa-official-recommendations/references/official-developer-recommendations.md`
- `skill/wcag-22-official-guidelines/SKILL.md`
- `skill/wcag-22-official-guidelines/references/wcag-22-official-summary.md`

Official references include:

- https://design.numerique.gouv.fr/articles/2026-03-02-rgaa5/
- https://disic.github.io/guide-developpeur/
- https://disic.github.io/guide-integrateur/
- https://design.numerique.gouv.fr/outils/memo-dev/
- https://design.numerique.gouv.fr/outils/checklist-dev/
- https://www.info.gouv.fr/accessibilite/developpement/bibliotheque-de-reference-des-restitutions-des-composants-javascript-aria
- https://www.info.gouv.fr/accessibilite/developpement/le-guide-des-composants-javascript-accessibles
- https://www.w3.org/WAI/standards-guidelines/wcag/fr
- https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/
- https://www.w3.org/WAI/WCAG22/quickref/
