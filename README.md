# Annuaire RGAA

> Showcase and operationalize RGAA visibility for the French web.

![Annuaire RGAA logo](./public/logo-rgaa-vitrine.svg)

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)
[![Vite](https://img.shields.io/badge/Vite-7.x-646CFF.svg)](https://vite.dev/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-v4-06B6D4.svg)](https://tailwindcss.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6.svg)](https://www.typescriptlang.org/)

Annuaire RGAA is a French-first directory for websites that publish accessibility signals:
public site metadata, detected accessibility statement URLs, declared compliance status,
declared RGAA baseline, and public profile pages designed for both humans and crawlers.

The product is intentionally split into two surfaces:

- a public, crawlable annuaire with search, filters, profile pages, domain-group pages, a site map, and machine-readable discovery assets
- a protected moderation console for approving, editing, deleting, blocking, exporting, and restoring entries

Project documentation is maintained in English. User-facing UI, announcements, and editorial
content remain in French by design.

Public website: **https://www.annuaire-rgaa.fr**

Detailed release history lives in [CHANGELOG.md](./CHANGELOG.md). The README describes the
product surface, architecture, operations, and public behavior, not the timeline of changes.

## Overview

Annuaire RGAA is not an automated legal audit platform. It is a submission, enrichment,
publication, and moderation pipeline with strong accessibility and crawlability constraints.

Core characteristics:

- French-first public interface oriented around directory discovery
- server-side URL analysis and metadata enrichment
- explicit moderation queue for non-auto-publishable submissions
- dedicated public profile route per listed site: `/site/{slug}`
- dedicated public domain route for multi-site domains: `/domaine/{groupSlug}`
- public discovery assets for search engines and AI crawlers: `/sitemap.xml`, `/robots.txt`, `/llms.txt`, `/llms-full.txt`, `/ai-context.json`
- protected moderation workflows for published entries, site blocklists, vote blocklists, archive import/export, and operator-triggered maintenance mode

## Product Surface

### Public routes

- `/`: homepage, shared search entry point, live filters, sort controls, paginated results, submission flow, accessibility guidance
- `/plan-du-site`: public site map with crawl-oriented internal links
- `/accessibilite`: accessibility declaration and contact/recourse information
- `/site/{slug}`: one public profile page per referenced site
- `/domaine/{groupSlug}`: grouped page for a domain with multiple public entries

### Public machine-readable routes

- `/api/showcase`: public dataset of published entries
- `/api/domain-groups`: public dataset of grouped domains
- `/api/health`: service health and storage mode
- `/api/maintenance`: public maintenance-state payload
- `/sitemap.xml`: generated XML sitemap
- `/ai-context.json`: generated AI/discovery context payload
- `/robots.txt`, `/llms.txt`, `/llms-full.txt`: static versioned discovery files

### Protected moderation routes

- `/moderation`: moderation UI
- `/api/moderation/*`: moderation endpoints guarded by `MODERATION_API_TOKEN`

## What The App Optimizes For

- discoverability first: search, filters, internal linking, canonical public routes
- accessibility first: semantic HTML, keyboard flow, visible focus, non-silent async states
- moderation continuity: reviewers keep domain context on multi-site domains, thumbnail visibility, direct site/declaration CTAs, editable metadata, and rollback options
- crawl consistency: public routes, sitemap, site map page, and machine-readable assets expose the same public patterns
- low-friction operations: Vercel deployment, optional Redis persistence, optional GitHub notifications, and one-click maintenance activation from moderation

## Architecture

The repository is a Vite + React frontend paired with a Node + Express backend.

- frontend rendering and route bootstrapping live in `src/`
- API and route generation live in `server/`
- Vercel serverless adapters live in `api/`
- static public assets live in `public/`
- shared accessibility declaration data lives in `shared/`

Important architectural choices:

- public detail routes preload only the route-specific API payload they need
- homepage bootstrap preloads `/api/showcase` on `/` and reuses that settled response at first render to overlap directory data fetching with route-chunk loading
- route bootstrap resolves the active page module in parallel with the maintenance probe so public routes avoid an avoidable extra startup dependency chain
- public bootstrap applies a short bounded wait on the maintenance probe before mounting non-moderation routes, preventing slow maintenance checks from dominating first render delay
- homepage also includes a small critical static hero shell in `index.html` (JS-gated to `/` via `data-home`) so the primary lead copy can paint before React initialization on slower mobile paths without leaking duplicate fallback content when JavaScript is disabled
- generated route-aware module preloads cover homepage, site map, accessibility, moderation, profile, and domain-group routes to reduce route-entry JavaScript waterfalls
- route-aware metadata is applied before React hydration where possible
- shared secondary-page primitives keep search, navigation, footer, and skip-link behavior aligned
- fragment targets move real DOM focus on load and on `hashchange`
- orientation fragments focus their landmark or section, while `#moteur-recherche-global` and `#ajout-site` move directly to the first useful field
- homepage filter state, tile pagination resets, and local feedback focus transitions are handled from explicit event flows instead of broad effect-based state watchers
- generated discovery endpoints and static discovery files are intentionally redundant for crawler resilience
- maintenance mode is persisted server-side; public JSON/XML routes answer `503`, and the static Vite shell swaps to an accessible maintenance screen before React mounts on public SPA routes

## Accessibility Model

This project treats accessibility as a runtime constraint, not a garnish.

Implemented principles:

- French UI labels and announcements
- semantic HTML before ARIA
- visible focus and non-obscured focus targets
- keyboard-first skip-link navigation
- skip-link trays remain reachable both by keyboard focus and pointer hover, and wrap on narrow portrait widths without forcing horizontal overflow
- route-level and local live regions for async status and error feedback
- accessibility declaration data is centralized in `shared/accessibilityStatement.js`, and `/accessibilite` displays the reference-audit scope, score, and tracked non-conformities from that shared snapshot
- public shell enforces a single light color scheme (theme toggle removed from public pages) so first-paint and hydrated text/background pairings stay deterministic across shared templates
- shared secondary navigation and global-search controls use explicit filled surfaces and reinforced borders to keep interface-component contrast stable across public templates
- shared search entry point across homepage and secondary routes
- homepage results summary and polite announcements stay aligned when search, filters, sorting, and page-based pagination update the visible cards
- homepage KPI cards expose an explicit loading placeholder before directory data is available, with screen-reader text that announces the pending state instead of temporary zero counts
- homepage polite announcements expose explicit loading states (`en cours`, `terminé`) and explicit pagination boundaries (`première page`, `dernière page`)
- global asynchronous announcers stay in persistent visually hidden live regions to avoid layout shifts while keeping French status/error messages available to assistive technologies
- focus continuity after action outcomes and section jumps
- moderation unlock places focus on the `Soumissions en attente` section before row-level actions
- minimum `44px`-class interaction targets on primary controls, and at least `24×24px` for every non-inline target including native checkboxes and radios (WCAG 2.2 `2.5.8`)
- links opening a new tab state `(nouvel onglet)` in their visible text and accessible name (RGAA `13.2`)
- the moderation token form accepts paste and password managers (`autocomplete="username"`/`current-password`), and the token visibility toggle exposes its state with `aria-pressed` (WCAG 2.2 `3.3.8`)
- the shared footer exposes `Aide accessibilité` in the same place on every route (WCAG 2.2 `3.2.6`)
- submission error panels expose an incident reference linked to the alert through `aria-describedby`
- consistent fragment-focus behavior across `/`, `/plan-du-site`, `/accessibilite`, `/site/{slug}`, `/domaine/{groupSlug}`, and `/moderation`
- profile pages expose a text-styled backlink preview while still offering copy-ready badge-image and text-only embed snippets

Automated WCAG 2.2 regression filters (`e2e/wcag22-regressions.spec.ts`), run on `/`, `/plan-du-site`, `/accessibilite`, and `/moderation` at `1280px` and `320px`:

- `2.5.8` target size (minimum): every non-inline interactive target measures at least `24×24px`
- `2.4.11` focus not obscured (minimum): the first 40 tab stops are never off-screen or fully covered
- `1.4.10` reflow: no horizontal scrolling at `320px`
- `3.3.8` accessible authentication: password-manager-compatible token form
- RGAA `13.2`: every `target="_blank"` link announces `nouvel onglet`

Accessibility-specific public assets:

- `/accessibilite`
- `/ai-context.json`

Embedded implementation references:

- `skill/rgaa-official-recommendations/SKILL.md`
- `skill/rgaa-official-recommendations/references/official-developer-recommendations.md`
- `skill/wcag-22-official-guidelines/SKILL.md`
- `skill/wcag-22-official-guidelines/references/wcag-22-official-summary.md`

## SEO And Discovery

The app is designed so that public discovery does not depend on JavaScript interpretation alone.

Discovery strategy:

- canonical public routes for homepage, site map, accessibility, profile, and domain-group pages
- permanent redirects that consolidate `annuaire-rgaa.fr` to `www.annuaire-rgaa.fr` and collapse trailing-slash duplicates
- JSON-LD on public routes
- XML sitemap generated by the API layer
- static `robots.txt`, `llms.txt`, and `llms-full.txt`
- generated `ai-context.json` with site, route, dataset, and accessibility snapshot metadata
- internal linking between homepage, site map, profiles, related profiles, and domain groups
- non-indexable moderation surface

Discovery asset lifecycle:

- generated: `/sitemap.xml`, `/ai-context.json`
- static versioned files from `public/`: `/robots.txt`, `/llms.txt`, `/llms-full.txt`

## Tech Stack

- Vite 8
- React 19
- TypeScript 5
- Tailwind CSS 4
- Express 5
- Upstash Redis, optional but recommended for persistence
- `tldts` for registrable-domain grouping
- `@fontsource` local font assets (`atkinson-hyperlegible`, `opendyslexic`, `lexend`)

## Storage And Runtime Modes

The API supports two storage modes:

- `redis`: enabled when Upstash-compatible environment variables are configured
- `memory`: fallback mode without persistence

Use `GET /api/health` to inspect the active mode.
Use `GET /api/maintenance` to inspect whether the public site is in maintenance mode.

Redis-related runtime notes:

- submission IDs are deterministic from normalized URLs
- payloads are compacted on write
- vote-state reads are optimized to avoid excessive Redis fan-out
- client vote ownership is tracked separately so the public CTA can remove a vote from the same browser identity
- client-specific vote reconciliation reuses a dedicated private `vote-state` payload with targeted counters for voted URLs, then runs after page load/idle so `hasUpvoted` and `upvoteCount` stay aligned without extending the critical annuaire request chain
- persisted vote totals are reconciled upward from active client-vote ownership on startup and after archive imports, which repairs undercounted entries without silently dropping older aggregate totals
- a short-lived in-memory cache reduces repeated read pressure

## Getting Started

Toolchain is pinned in [`package.json`](./package.json):

- Node.js `25.2.1`
- npm `11.6.2`

Install and run:

```bash
npm install
npm run dev
```

Security maintenance check:

```bash
npm audit
```

Local services:

- frontend: `http://127.0.0.1:5173`
- API: `http://127.0.0.1:8787`

## Configuration

### Persistence

Configure either naming scheme:

```bash
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
```

or:

```bash
KV_REST_API_URL=...
KV_REST_API_TOKEN=...
```

Optional:

```bash
REDIS_CACHE_TTL_MS=15000
VOTE_FINGERPRINT_SALT=change-this-random-secret
```

### Moderation

```bash
MODERATION_API_TOKEN=replace-with-a-long-random-token
```

Security requirement: use at least `32` characters.

Maintenance mode does not require extra environment variables. Authorized moderators can toggle it from `/moderation`, and the persisted state is included in archive export/import.

Optional archive signing:

```bash
MODERATION_ARCHIVE_SIGNING_SECRET=replace-with-a-long-random-secret
```

Optional free URL categorization feeds (enabled by default):

```bash
BLOCKLIST_PROJECT_ENABLED=true
BLOCKLIST_PROJECT_REFRESH_MINUTES=180
# Optional overrides:
# BLOCKLIST_PROJECT_PORN_URL=https://raw.githubusercontent.com/blocklistproject/Lists/main/alt-version/porn-nl.txt
# BLOCKLIST_PROJECT_GAMBLING_URL=https://raw.githubusercontent.com/blocklistproject/Lists/main/alt-version/gambling-nl.txt
# BLOCKLIST_PROJECT_DRUGS_URL=https://raw.githubusercontent.com/blocklistproject/Lists/main/alt-version/drugs-nl.txt
```

The moderation pipeline combines local dictionaries with free blocklist
feeds before deciding auto-publication versus manual review. Feeds use the
domain-only (`-nl`) format, are capped at 24 MB each with an 8 s download
timeout, are cached in memory for the refresh window, and start loading in
parallel with the remote site analysis. An unavailable feed never blocks a
submission.

### GitHub Notifications

```bash
GITHUB_NOTIFY_REPO=owner/repo
GITHUB_NOTIFY_TOKEN=github_pat_xxx
```

Fallback names for environments where `GITHUB_*` variables are restricted:

```bash
RGAA_NOTIFY_REPO=owner/repo
RGAA_NOTIFY_TOKEN=github_pat_xxx
```

Optional:

```bash
GITHUB_NOTIFY_LABELS=moderation,annuaire-rgaa
GITHUB_NOTIFY_MAX_PER_WINDOW=12
GITHUB_NOTIFY_WINDOW_SECONDS=3600
PUBLIC_APP_URL=https://www.annuaire-rgaa.fr
# GITHUB_API_URL=https://github.example.com/api/v3
```

When enabled, the notifier can create:

- moderation issues for submissions that require manual review
- informational publication issues for sites that are auto-approved and published immediately
- submission-failure alerts (`submission-failure`, `bug` labels) when a user could not submit a site for an identified reason

Issue bodies are rendered in rich Markdown with:

- high-visibility timestamp blocks (Europe/Paris, UTC, and ISO 8601)
- direct operational links to the submitted/published site, accessibility declaration, domain page, public profile (when available), and moderation console
- mention-safe text rendering without noisy Markdown escape backslashes in normal content
- clear notification separation between moderation-required issues and auto-publication informational issues (distinct titles, status banners, and dedicated GitHub labels)
- sensitive categorization signals and contextual labels (`sensitive-category`, `source-blocklist-project`) on moderation issues when applicable

Publication issues are intentionally informational and do not imply operator action is required.

Submission-failure alerts:

- cover API-identified causes (DNS, TLS, HTTP status, invalid content, rate limit, storage or internal errors) and browser-relayed causes (platform timeout, non-JSON gateway response, network loss)
- carry the incident reference shown to the user (`SUB-…`), the stage (pre-analysis or confirmation), the cause code, the HTTP status, the displayed message, and the submitted URL
- are deduplicated per host and cause for 6 hours (Redis `SET NX` when Redis is configured)
- are not raised for input mistakes (`invalid-input`), forbidden private/local hosts (`forbidden-host`), or moderation-blocked sites (`site-blocked`)
- share the global notification quota (`GITHUB_NOTIFY_MAX_PER_WINDOW`)

Every submission failure is also logged as a structured `submission-failure` JSON line, and skipped or failed alerts as `submission-failure-alert-skipped`.

Submission incident log:

- every failure, alerting or not, is stored for 30 days under its `SUB-…` reference (500 most recent at most), with its GitHub alert outcome: `sent`, or `skipped`/`failed` with a reason (`non-alerting-code`, `deduplicated`, `notifier-disabled`, `quota-reached`, `github-error`, `dedup-unavailable`)
- the `Échecs de soumission` section of `/moderation` searches an incident by reference and lists the 50 latest ones
- a `github-error` outcome such as `Bad credentials` means `GITHUB_NOTIFY_TOKEN` is invalid or expired and must be replaced in the deployment environment

Clearing notifier issues:

- the `Issues GitHub de notification` section of `/moderation` lists the open notifier issues and closes a selection as `Traitée` or `Sans suite` after a two-step confirmation
- issues are closed, never deleted, and only issues created by the notifier can be closed; the notifier token needs Issues read/write on `GITHUB_NOTIFY_REPO`

## API Surface

### Public APIs

- `POST /api/site-insight`: submit and enrich one site
- `POST /api/site-insight?preview=1`: preview-only pre-analysis without persistence
- `POST /api/site-insight/failure-report`: browser relay for submission failures the API could not report itself (`url`, `stage`, `kind` in `network`/`timeout`/`invalid-response`, optional `statusCode` and `message`); the URL is recorded, never fetched; returns `{ reference }`
- `GET /api/showcase`: list public entries
- `GET /api/showcase?slug={slug}`: retrieve one public profile payload
- `GET /api/showcase/vote-state?clientVoterId={id}`: list vote ownership for a browser identity plus targeted vote counters for the same voted URLs; responses are served as private non-cacheable payloads
- `GET /api/domain-groups`: list grouped public domains
- `GET /api/domain-groups?slug={groupSlug}`: retrieve one domain-group payload
- `GET /api/thumbnail-proxy?url={encodedUrl}`: fetch one remote thumbnail through a validated server-side proxy with long-lived cache headers
- `POST /api/showcase/upvote`: add or remove one vote owned by the requesting browser identity (`action: upvote | remove`)
- `GET /api/health`: service status and storage mode
- `GET /api/maintenance`: public maintenance state

### Protected moderation APIs

- `GET /api/moderation/pending`
- `GET /api/moderation/showcase`
- `GET /api/moderation/submission-failures`: latest submission incidents, or one incident with `?reference=SUB-…`
- `GET /api/moderation/github-issues`: open issues created by the notifier (marker or legacy title)
- `POST /api/moderation/github-issues/close`: close notifier issues (`{ "numbers": [13], "reason": "completed" | "not_planned" }`, at most 50 per call); other issues and pull requests are refused
- `GET /api/moderation/blocklist`
- `GET /api/moderation/maintenance`
- `GET /api/moderation/archive`
- `POST /api/moderation/approve`
- `POST /api/moderation/reject`
- `POST /api/moderation/maintenance`
- `POST /api/moderation/showcase/update`
- `POST /api/moderation/showcase/delete`
- `POST /api/moderation/showcase/delete-and-block`
- `POST /api/moderation/showcase/delete-domain`
- `POST /api/moderation/blocklist/site`
- `POST /api/moderation/blocklist/votes`
- `POST /api/moderation/archive/import`

Moderation requests must send:

```bash
x-moderation-token: <MODERATION_API_TOKEN>
```

### Public Submission Semantics

`POST /api/site-insight` can return:

- `approved`: published immediately
- `duplicate`: already listed
- `pending`: stored for moderation when key integrity checks fail (for example missing accessibility statement, mismatch between statement domain and submitted site domain, invalid/inaccessible detected thumbnail, or sensitive dictionary matches on submitted metadata)

Analysis fallback to manual moderation:

- when the site exists but refuses or delays automated analysis (HTTP `401`/`403`/`406`/`429`/`503`, fetch timeout, analysis budget exceeded, connection reset, TLS chain error), the submission is not rejected: it becomes `pending` with the reason `Analyse automatique impossible: …`, the response carries `analysisFallback: true`, and the moderation issue gets the `analysis-fallback` label
- unresolvable domains, `404`-style statuses, and non-HTML content remain refused with an explicit error

Error responses:

- carry `error` (French message), `errorCode` (stable cause code such as `dns-unresolved`, `tls-error`, `http-404`, `invalid-content-type`, `rate-limited`, `storage-unavailable`, `internal-error`), and `reference` (`SUB-…` incident reference displayed to the user)

Analysis pipeline:

- the whole remote analysis runs within a 14 s budget; each fetch timeout is clamped to the remaining budget and optional probes are skipped when the budget runs low
- conventional accessibility-statement paths, the AI context document, and the compliance extraction run concurrently; sensitive-category and thumbnail checks run concurrently
- a request rejected with `401`/`403`/`406`/`429`/`503` is retried once with a browser-compatible, still identifiable user agent
- oversized homepages are truncated to their first 1 MB instead of failing; documents served without `Content-Type` are accepted when the payload is HTML
- network failures are classified (TLS, refused, reset, timeout, DNS) into explicit messages

Preview mode:

- never persists showcase or moderation data
- returns extracted metadata and projected submission status
- returns a short-lived `previewToken` (10 minutes) reused by the confirmation step; the preview is kept in memory and in Redis so the confirmation step can reuse it on another serverless instance

Rate limits (per client IP, per hour): 20 previews, 10 confirmations, 10 failure reports.

Browser behavior:

- submission requests abort after 35 s on the client side
- error panels display the incident reference when one is available

## Security Posture

The app is hardened around URL intake and public moderation exposure.

Key controls:

- public HTTP/HTTPS validation only
- SSRF protection, including localhost/private-host rejection
- redirect-by-redirect target revalidation
- DNS checks before remote fetch
- response size and timeout limits, with a slightly larger homepage HTML budget than secondary remote documents
- dictionary-based sensitive-content signals (adult/gambling/pharmaceutical/SEO-abuse keywords) route suspicious submissions to manual moderation instead of auto-publication
- optional free Blocklist Project category feeds (porn/gambling/drugs) reinforce sensitive-content detection and can route newly detected risky domains to manual moderation
- compliance status normalization prevents exposing `Totalement conforme` when a numeric score is below `100`
- submissions with declaration inconsistency (`Totalement conforme` declared with score `<100`) are forced into manual moderation
- remote-thumbnail proxying keeps URL validation server-side, follows a bounded redirect chain with host revalidation at each hop, restricts payloads to image content types (including WebP fallback detection when headers are incorrect), and enforces explicit timeout/size ceilings before bytes are relayed
- rate limiting on public endpoints, keyed from extracted client IP headers on proxied deployments, with stricter submission and vote controls
- moderation token strength checks and auth throttling
- no remote script execution
- moderation-managed site blocklist and vote blocklist
- optional signed moderation archive exports/imports
- GitHub notifier restricted to explicit notifier tokens and public HTTPS API bases

## Deployment

The repository is designed for Vercel deployment with a single-function API entry strategy.

Important deployment characteristics:

- `api/index.js` and `api/[...slug].js` funnel requests into the Express app
- rewrites keep `/api/*`, `/sitemap.xml`, and `/ai-context.json` on the server path
- SPA routes resolve to `index.html` on refresh/direct access
- API functions run with `maxDuration: 30` seconds, above the 14 s analysis budget plus moderation checks and notifications
- host-level redirects should avoid cyclic apex/`www` rules

Versioning and releases:

- the footer shows `Version publique X.Y.Z`, resolved at build time from `VITE_BUILD_VERSION` or `RELEASE_VERSION` (only when they are semantic versions), then `package.json`, then the latest git tag
- a release bumps `package.json` (`npm version X.Y.Z --no-git-tag-version`), moves the `[Unreleased]` changelog entries under `## [YYYY-MM-DD / vX.Y.Z]`, is committed as `chore(release): vX.Y.Z`, and is tagged `vX.Y.Z`

Recommended production environment variables:

- Redis: `KV_REST_API_URL` + `KV_REST_API_TOKEN` or `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`
- moderation: `MODERATION_API_TOKEN`
- optional archive signing: `MODERATION_ARCHIVE_SIGNING_SECRET`
- optional GitHub notifications: `GITHUB_NOTIFY_REPO`, `GITHUB_NOTIFY_TOKEN`
- optional public URL/discovery helpers: `PUBLIC_APP_URL`

## Scripts

```bash
npm run dev
npm run lint
npm run build
npm run test:e2e
npm run preview
npm run start:api
```

For browser-based end-to-end checks, install the Playwright browser binary once:

```bash
npm run test:e2e:install
```

## Open Source

- License: [MIT](./LICENSE)
- Contributing guide: [CONTRIBUTING.md](./CONTRIBUTING.md)
- Code of Conduct: [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)
- Security policy: [SECURITY.md](./SECURITY.md)

## Support

Annuaire RGAA exists to make accessibility claims more visible, inspectable, and discussable in
public. The score is a compass, not the destination: the real target is unblocked journeys and
usable interfaces.

- Ko-fi: https://ko-fi.com/aurelienlewin

## Official Reference Sources

RGAA:

- https://design.numerique.gouv.fr/articles/2026-03-02-rgaa5/
- https://disic.github.io/guide-developpeur/
- https://disic.github.io/guide-integrateur/
- https://design.numerique.gouv.fr/outils/memo-dev/
- https://design.numerique.gouv.fr/outils/checklist-dev/
- https://www.info.gouv.fr/accessibilite/developpement/bibliotheque-de-reference-des-restitutions-des-composants-javascript-aria
- https://www.info.gouv.fr/accessibilite/developpement/le-guide-des-composants-javascript-accessibles

WCAG 2.2:

- https://www.w3.org/WAI/standards-guidelines/wcag/fr
- https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/
- https://www.w3.org/WAI/WCAG22/quickref/
