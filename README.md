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

Public website: **https://annuaire-rgaa.fr**

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

- `/`: homepage, shared search entry point, live filters, sort controls, progressive results, submission flow, accessibility guidance
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
- moderation continuity: reviewers keep domain context, editable metadata, and rollback options
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
- homepage also includes a small critical static hero shell in `index.html` (gated to `/`) so the primary lead copy can paint before React initialization on slower mobile paths
- generated route-aware module preloads cover homepage, site map, accessibility, moderation, profile, and domain-group routes to reduce route-entry JavaScript waterfalls
- route-aware metadata is applied before React hydration where possible
- shared secondary-page primitives keep search, navigation, footer, and skip-link behavior aligned
- fragment targets move real DOM focus on load and on `hashchange`
- orientation fragments focus their landmark or section, while `#moteur-recherche-global` and `#ajout-site` move directly to the first useful field
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
- homepage results summary and polite announcements stay aligned when search, filters, sorting, and progressive loading update the visible cards
- global asynchronous announcers stay in persistent visually hidden live regions to avoid layout shifts while keeping French status/error messages available to assistive technologies
- focus continuity after action outcomes and section jumps
- minimum `44px`-class interaction targets on primary controls
- consistent fragment-focus behavior across `/`, `/plan-du-site`, `/accessibilite`, `/site/{slug}`, `/domaine/{groupSlug}`, and `/moderation`
- profile pages expose a text-styled backlink preview while still offering copy-ready badge-image and text-only embed snippets

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

- Vite 7
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
PUBLIC_APP_URL=https://annuaire-rgaa.fr
# GITHUB_API_URL=https://github.example.com/api/v3
```

When enabled, the notifier can create:

- moderation issues for submissions that require manual review
- informational publication issues for sites that are auto-approved and published immediately

Publication issues are intentionally worded as informational and do not imply operator action is required.

## API Surface

### Public APIs

- `POST /api/site-insight`: submit and enrich one site
- `POST /api/site-insight?preview=1`: preview-only pre-analysis without persistence
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
- `GET /api/moderation/blocklist`
- `GET /api/moderation/maintenance`
- `GET /api/moderation/archive`
- `POST /api/moderation/approve`
- `POST /api/moderation/reject`
- `POST /api/moderation/maintenance`
- `POST /api/moderation/showcase/update`
- `POST /api/moderation/showcase/delete`
- `POST /api/moderation/showcase/delete-and-block`
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
- `pending`: stored for moderation

Preview mode:

- never persists data
- returns extracted metadata and projected submission status
- may return a short-lived `previewToken` reused by the confirmation step

## Security Posture

The app is hardened around URL intake and public moderation exposure.

Key controls:

- public HTTP/HTTPS validation only
- SSRF protection, including localhost/private-host rejection
- redirect-by-redirect target revalidation
- DNS checks before remote fetch
- response size and timeout limits, with a slightly larger homepage HTML budget than secondary remote documents
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
- host-level redirects should avoid cyclic apex/`www` rules

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
npm run preview
npm run start:api
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
