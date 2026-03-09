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

Project documentation (`README`, `CHANGELOG`, release notes) is maintained in English.
Interface labels remain in French by design for the target audience.

Planned public website: **https://annuaire-rgaa.fr**

## Highlights

- Simple French UI focused on listing discovery first.
- Multiple skip links for keyboard navigation (French UI labels: `contenu`, `navigation principale`, `recherche`, `résultats`, `ajout`, `aide`, `pied de page`), hidden by default and revealed on keyboard focus.
- Programmatic focus management on skip-link targets and dynamic feedback blocks (errors/status).
- Keyboard filter ergonomics: `Échap` clears search input and a dedicated reset button restores all filters from the shared header search.
- Explicit filter CTA with a `Rechercher` button for clear submit action and predictable keyboard flow.
- Shared global search entry point (`#moteur-recherche-global`) reused across homepage, secondary pages, and quick links.
- Progressive tile pagination in the directory (`24` cards per batch) with a manual `Charger plus` action.
- Automatic lazy loading of additional tiles near viewport end (with keyboard-accessible manual fallback).
- Reddit-like upvote on each directory tile with accessible button state (`aria-pressed`) and live vocal feedback.
- Each directory tile includes an explicit RGAA baseline badge (`RGAA 4.1` or `RGAA 5.0 prêt`) with readable explanation text.
- Submission flow includes a pre-analysis step before confirmation, exposing detected title/status/score/accessibility URL before final send.
- Confirmation CTA lives inside the post pre-analysis verification panel; the initial pre-analysis button is disabled after analysis to prevent action ambiguity.
- Duplicate submissions now trigger a dedicated accessible feedback panel (`Site déjà référencé`) with polite live announcement, programmatic focus, dismiss action, and direct moderation contact links.
- URLs already submitted and still under manual review now trigger a dedicated accessible feedback panel (`Site déjà soumis et en cours de revue`) so users do not repeat the same submission.
- Each listed site has a dedicated public profile page (`/site/{slug}`) with shareable metadata and backlink snippet.
- Profile pages expose stronger SEO/IA signals: dedicated `WebPage` + referenced `WebSite` + `Dataset` structured data, direct API link (`/api/showcase?slug={slug}`), explicit accessibility-statement linking when detected, and related-profile internal linking.
- Profile pages provide a reusable visual backlink badge (`/badge-backlink-annuaire-rgaa.svg`) plus copy-ready HTML snippets with explicit `alt` and `aria-label`.
- Add-site flow exposes a visible category dropdown (including `Coopérative et services`) without custom free-text entry.
- Localized live region announcements for dynamic feedback (`polite` for status, `assertive` for errors).
- Tailwind v4.2 accessibility helpers are used where relevant: `wrap-anywhere`, `user-valid` / `user-invalid`, and logical utilities (`start-*`, `ps-*`) to avoid direction-specific custom positioning/padding.
- Showcase thumbnails are treated as decorative visuals when equivalent textual information is already present in cards.
- Showcase thumbnails now render in a framed `contain` layout with an inner adaptive canvas, so transparent logos with dark or light strokes stay legible in both themes without cover-cropping.
- User preference support for low vision and motion sensitivity (`prefers-color-scheme`, `prefers-reduced-motion`, `prefers-contrast`, `forced-colors`).
- High-contrast color system tuned for low-vision navigation in both light and dark modes (including stronger visited-link and status semantics).
- Persistent light/dark mode toggle available on both directory and moderation screens.
- Dark mode styling is consistently applied through Tailwind `dark:` variants to avoid mixed-theme rendering.
- Discreet footer build stamp (`version + UTC timestamp`) helps detect stale cache quickly.
- Footer version resolves from release tags first (with package version fallback) to stay aligned with published GitHub releases.
- Footer uses a clearer three-column information architecture (French UI labels: `Projet`, `Navigation rapide`, `Soutien`) on large screens.
- All pages share a consistent top `navigation principale` landmark (French UI label) and the same global footer.
- Global `:focus-visible` fallback styles reinforce WCAG 2.2 focus visibility on all controls.
- Route lazy-loading fallback is announced as status (`aria-live="polite"`) to avoid silent loading states.
- Lazy-loaded completion states are announced on `/site/{slug}` and `/plan-du-site` (successful load, empty result, and loading error) via dedicated polite live regions.
- UI typography avoids tiny text; informational content and metadata are rendered at `text-sm` or above.
- Muted text and status colors are tuned for stronger contrast in both light and dark themes.
- Default typography prioritizes `Atkinson Hyperlegible` for broad readability, with `OpenDyslexic` and `Lexend` as accessible fallbacks.
- Logo strategy is icon-only in SVG; textual branding is rendered in semantic Tailwind UI for robust responsive display.
- Directory-first UX with filters, categories, and search at the core.
- Score is treated as a compass, not the goal: priority is to unblock customer journeys and deliver usable UX for everyone.
- URL registration workflow with secure server-side metadata enrichment.
- Dedicated moderation UI at `/moderation` for approving/rejecting pending submissions.
- Moderation dashboards and controls stay hidden until a valid moderation token is submitted.
- Moderation token session can be restored automatically (tab session by default, optional 12h persistence on the current device) with an explicit sign-out/forget action.
- Dedicated moderation UI supports published entry editing and deletion (title, category, score, status, RGAA baseline badge, vignette, accessibility URL).
- Moderation includes editable site blocklist and vote-blocklist controls, plus a single action to delete and block a published site.
- Moderation forms strengthen input assistance (`required`, typed URL fields, explicit score guidance) and row-level action labels for assistive technologies.
- Public accessibility declaration page at `/accessibilite` including compliance status, non-conformity follow-up, technology stack, test environment, tooling, and contact.
- Accessibility declaration data is centralized in a shared snapshot reused by `/accessibilite` and `/ai-context.json`, reducing score drift between UI and machine-readable discovery.
- Annuaire listing cards designed for disabled people and accessibility enthusiasts.
- Directory tiles use a clearer reading hierarchy (status chips, metadata blocks, grouped actions, vote zone) with container-query layout adaptation for mobile and desktop.
- RGAA awareness sections sourced from official French references.
- WCAG 2.2 awareness and references embedded in the UI.
- Tailwind CSS v4 native features used directly (`@theme` tokens + utility-first focus/skip-link patterns).
- Embedded skills: `rgaa-official-recommendations`, `wcag-22-official-guidelines`.
- Frontend route bundles are split (`/moderation`, `/plan-du-site`, `/accessibilite`) to reduce initial JavaScript on homepage load.
- Secondary local fonts (`OpenDyslexic`, `Lexend`) load after first paint (idle callback), keeping critical render path lighter.

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
- Forwarded IP headers are validated as real IPs before contributing to anti-abuse vote fingerprints.
- Moderation-enforced site blocklist prevents new submissions on blocked URLs.
- Moderation-enforced vote blocking disables upvotes for selected URLs.
- Moderation archive hardening: optional HMAC-signed exports/imports (`MODERATION_ARCHIVE_SIGNING_SECRET`) and rollback guard for destructive `replace` imports.
- GitHub notifier hardening: explicit notifier token env vars only, strict public-HTTPS validation for custom GitHub API base URL, and short outbound timeout.
- Domain-level deduplication via canonical URL normalization (e.g. `www` variants collapse)
- Honeypot field validation to reduce automated spam submissions
- Automatic spam/marketing signal rejection (quality filter)
- Manual-review queue for non-auto-publishable submissions (pending until moderator action)
- No execution of remote page scripts

## Accessibility Preferences

The UI adapts automatically to operating-system and browser accessibility preferences:

- Dark mode (`prefers-color-scheme`)
- Reduced motion (`prefers-reduced-motion`)
- Increased contrast (`prefers-contrast: more`)
- Forced colors / high-contrast modes (`forced-colors: active`)

## Accessibility Implementation Traceability

Production audit scope covered:

- `/` (home)
- `/plan-du-site`
- `/accessibilite`
- `/site/{slug}`

Non-conform criteria identified in that baseline:

- `3.3` insufficient contrast on one informative graphic in homepage header
- `10.10` positional-only wording on accessibility declaration

Implemented remediation items:

- Single shared search form retained in page header (`#moteur-recherche-global`) and homepage duplicate search landmark removed.
- Homepage search features (query + status + category + submit + reset + keyboard `Échap`) run through the shared header form.
- Main navigation landmark is consistent across all pages (`#navigation-principale`) and skip links target it explicitly.
- Homepage logo contrast has been reinforced (dark/light background + border) to address criterion `3.3`.
- Positional wording has been replaced by explicit section wording on `/accessibilite` to address criterion `10.10`.
- All dynamic status/error announcements remain localized in French with `aria-live` channels (`polite` and `assertive`).

Operational note:

- SPA routes can expose stale static `<meta>` hints in the raw HTML shell. Pre-analysis now also consumes `/ai-context.json` when available, so the accessibility declaration score stays discoverable without JavaScript execution.

## SEO

- Rich metadata: description, robots, canonical, hreflang
- Legacy `.org` host redirects at edge to `annuaire-rgaa.fr` to avoid duplicate indexing.
- Open Graph + Twitter Cards
- Structured data (JSON-LD) on homepage now combines `WebSite`, `WebPage`, `WebApplication`, `Organization`, `Person`, `CollectionPage`, `DataCatalog`, and `Dataset`.
- Structured data exposes `SearchAction` on homepage, `BreadcrumbList` on key secondary pages, and richer `Dataset` semantics (`variableMeasured`, `measurementTechnique`, distributions).
- Profile pages publish a referenced-site `WebSite`, a per-profile `Dataset`, and a dedicated accessibility-statement `WebPage` node when a declaration URL is known.
- Static `index.html` keeps a stronger metadata fallback graph so non-hydrated crawlers still discover the main site entities and dataset endpoint.
- Accessible public site map page: `/plan-du-site`
- Site map page lists an extract of published `/site/{slug}` links to strengthen crawlable internal discovery.
- Public accessibility declaration page: `/accessibilite`
- Accessibility declaration structured data now includes accessibility-specific properties (`accessibilitySummary`, `accessibilityFeature`, `accessibilityControl`, `accessMode`).
- Auto-generated sitemap endpoint: `/sitemap.xml` (backed by API route `/api/sitemap`)
- `sitemap.xml` is served without caching (`no-store`) so published entries appear immediately after submission/moderation.
- Sitemap includes the public data endpoint (`/api/showcase`) for dataset discovery.
- Sitemap includes one public URL per referenced site profile (`/site/{slug}`).
- AI crawler files: `/llms.txt`, `/llms-full.txt`, `/ai-context.json` (and `/api/ai-context`)
- AI context includes explicit site-profile patterns (`/site/{slug}`), API pattern (`/api/showcase?slug={slug}`), crawl seed profile URLs, and a machine-readable accessibility-statement snapshot (`complianceStatus`, `complianceScore`, `rgaaBaseline`).
- `public/robots.txt`
- Public showcase API includes cache headers (`Cache-Control`, `Last-Modified`) for crawler efficiency and reduced load.
- Serverless API adapter normalizes absolute/relative request URLs before Express routing, reducing production fallback mismatches on `/api/*`.
- Host-level redirects must avoid cyclic `www`/apex rules, otherwise `/api/*` calls may fail and return non-API HTML payloads.
- Vercel rewrites force `/api/*` through the single `/api` function entrypoint with preserved logical path, preventing SPA HTML fallback on API routes.
- Vercel Web Analytics is wired on frontend mount via `@vercel/analytics`.

## Getting Started

Toolchain is pinned with Volta and npm metadata in [`package.json`](./package.json):

- Node.js `25.2.1`
- npm `11.6.2`

If you use Volta locally, entering the project directory is enough to pick the pinned versions automatically.

```bash
npm install
npm run dev
```

Local services:

- Frontend: `http://127.0.0.1:5173`
- API: `http://127.0.0.1:8787`

Dependency maintenance note:

- Patch upgrades currently applied in the lockfile: `@upstash/redis` `1.36.4`, `@eslint/js` `9.39.4`, `eslint` `9.39.4`
- Remaining upgrades reported by `npm outdated` are major-only or outside the current ranges (`eslint` 10, `@eslint/js` 10, `@types/node` 25, `eslint-plugin-react-refresh` 0.5, `globals` 17)

## API endpoints

- `POST /api/site-insight` registers/enriches one site entry in the directory
- `POST /api/site-insight?preview=1` runs pre-analysis without persistence (used by confirmation step)
- `GET /api/showcase` returns persisted showcase entries (supports `search`, `status`, `category`, `limit`, `clientVoterId`)
- `GET /api/showcase` also supports `slug` for single-profile retrieval and returns `slug`, `profilePath`, `siteHost`, `siteOrigin`, and `hasAccessibilityPage` for each public entry.
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
- `202` + `submissionStatus: "pending"` + `alreadySubmitted: true` when the same URL is already pending moderation
- `4xx` when rejected by validation/anti-abuse rules (spam, invalid input, etc.)
- Public submissions accept only moderator-approved category values from the dropdown; unknown values are normalized to `Autre`.
- For `duplicate`, the frontend displays an explicit guidance block that links to the existing profile and moderation contact (`/accessibilite#contact-accessibilite`) before any re-listing request.
- For `pending` + `alreadySubmitted: true`, the frontend skips confirmation and displays an explicit guidance block to avoid duplicate pending submissions.

`POST /api/site-insight?preview=1` behavior:

- never persists data
- returns extracted metadata (`siteTitle`, `accessibilityPageUrl`, `complianceStatus`, `complianceScore`)
- returns projected `submissionStatus` (`approved`, `pending`, `duplicate`) with explanatory `message`
- when projected status is `duplicate`, the submission confirmation flow is skipped and the duplicate guidance panel is shown immediately.
- when projected status is `pending` with `alreadySubmitted: true`, the submission confirmation flow is also skipped and a dedicated “already under review” guidance panel is shown immediately.

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
- Existing and ingested entries default to `4.1` until a moderator explicitly overrides the badge.
- `5.0-ready` is applied only through moderation override.

Public showcase metadata notes:

- `siteHost` exposes the normalized hostname used for lightweight machine grouping and profile labeling.
- `siteOrigin` exposes the site origin when the stored URL is valid.
- `hasAccessibilityPage` is a boolean convenience field derived from `accessibilityPageUrl`.
- The AI context endpoint (`/ai-context.json`) mirrors these discovery-oriented fields in its documented sample schema.

### Manual moderation workflow

1. A submission requiring human review is stored server-side as `pending`.
2. A moderator opens `/moderation`, enters the moderation token, and loads the pending queue.
3. The moderator approves or rejects each entry from the UI (the page calls moderation APIs with `submissionId`).
4. The moderator can edit, delete, delete+block, manage site/vote blocklists, set custom categories, and archive/restore the full database directly from `/moderation`.
5. To re-list a site that is already published, the current entry must first be removed by moderation/admin after requester justification (new audit, new score, significant improvements, etc.).

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
