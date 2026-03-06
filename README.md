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

Planned public website: **https://rgaa-vitrine.org**

## Highlights

- Simple French UI focused on listing discovery first.
- Multiple skip links for keyboard navigation (`contenu`, `filtres`, `ajout`, `aide`).
- Programmatic focus management on skip-link targets and dynamic feedback blocks (errors/status).
- Keyboard filter ergonomics: `Échap` clears search input and a dedicated reset button restores all filters.
- Explicit filter CTA with a `Rechercher` button for clear submit action and predictable keyboard flow.
- Localized live region announcements for dynamic feedback (`polite` for status, `assertive` for errors).
- User preference support for low vision and motion sensitivity (`prefers-color-scheme`, `prefers-reduced-motion`, `prefers-contrast`, `forced-colors`).
- High-contrast color system tuned for low-vision navigation in both light and dark modes (including stronger visited-link and status semantics).
- Persistent light/dark mode toggle available on both directory and moderation screens.
- Dark mode styling is consistently applied through Tailwind `dark:` variants to avoid mixed-theme rendering.
- Discreet footer build stamp (`version + UTC timestamp`) helps detect stale cache quickly.
- Global `:focus-visible` fallback styles reinforce WCAG 2.2 focus visibility on all controls.
- UI typography avoids tiny text; informational content and metadata are rendered at `text-sm` or above.
- Muted text and status colors are tuned for stronger contrast in both light and dark themes.
- Default typography now prioritizes `Atkinson Hyperlegible` for broad readability, with `OpenDyslexic` and `Lexend` as accessible fallbacks.
- Logo strategy is now icon-only in SVG; textual branding is rendered in semantic Tailwind UI for robust responsive display.
- Directory-first UX with filters, categories, and search at the core.
- URL registration workflow with secure server-side metadata enrichment.
- Dedicated moderation UI at `/moderation` for approving/rejecting pending submissions.
- Annuaire listing cards designed for disabled people and accessibility enthusiasts.
- RGAA awareness sections sourced from official French references.
- WCAG 2.2 awareness and references embedded in the UI.
- Tailwind CSS v4 native features used directly (`@theme` tokens + utility-first focus/skip-link patterns).
- Embedded skills: `rgaa-official-recommendations`, `wcag-22-official-guidelines`.

## Tech Stack

- Vite + React + TypeScript
- Tailwind CSS v4 via `@tailwindcss/vite`
- Node + Express API
- Upstash Redis (optional but recommended) for persistent showcase storage
- API-side in-memory Redis cache (TTL-based) to reduce repeated Upstash reads
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

This enables short-lived server-side caching for Redis-backed listing/moderation reads to avoid unnecessary Upstash queries on repeated requests.

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

## SEO

- Rich metadata: description, robots, canonical, hreflang
- Open Graph + Twitter Cards
- Structured data (JSON-LD): `WebSite`, `Organization`, `Person`
- `public/robots.txt`

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
- `GET /api/showcase` returns persisted showcase entries (supports `search`, `status`, `category`, `limit`)
- `GET /api/health` returns service status and active storage mode
- `GET /api/moderation/pending` returns pending moderation entries (protected)
- `POST /api/moderation/approve` approves one pending submission (protected)
- `POST /api/moderation/reject` rejects one pending submission (protected)

`POST /api/site-insight` behavior:

- `200` + `submissionStatus: "approved"` when published
- `200` + `submissionStatus: "duplicate"` when site already exists
- `202` + `submissionStatus: "pending"` when the site requires manual review
- `4xx` when rejected by validation/anti-abuse rules (spam, invalid input, etc.)

### Manual moderation workflow

1. A submission requiring human review is stored server-side as `pending`.
2. A moderator opens `/moderation`, enters the moderation token, and loads the pending queue.
3. The moderator approves or rejects each entry from the UI (the page calls moderation APIs with `submissionId`).

Endpoints are protected by `MODERATION_API_TOKEN`.

Set it in local/Vercel environment:

```bash
MODERATION_API_TOKEN=replace-with-a-long-random-token
```

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
PUBLIC_APP_URL=https://rgaa-vitrine.org
```

Behavior:

- On new `pending` moderation submission, the API creates one GitHub issue in `GITHUB_NOTIFY_REPO`.
- GitHub notifications are then handled natively by your repo notification settings.
- Notification failure does not block user submission flow.

Recommended GitHub setup:

1. Enable repository notifications for Issues (or Watch -> Custom -> Issues).
2. Use a fine-grained PAT scoped to one repository with Issues write access.

## Deployment (Vercel)

The repository includes native Vercel serverless endpoints in `api/`:

- `api/site-insight.js`
- `api/showcase.js`
- `api/health.js`
- `api/moderation/pending.js`
- `api/moderation/approve.js`
- `api/moderation/reject.js`

This avoids production `NOT_FOUND` responses on `/api/*` routes when the frontend is deployed as a Vite app.
Vercel rewrites also ensure SPA routes (including `/moderation`) resolve to `index.html` instead of returning 404 on refresh/direct access.

Ensure these environment variables are configured in Vercel project settings:

- `KV_REST_API_URL` and `KV_REST_API_TOKEN`
or
- `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
- `MODERATION_API_TOKEN` (required to enable manual moderation API)
- `GITHUB_NOTIFY_REPO` and `GITHUB_NOTIFY_TOKEN` (optional, enables GitHub issue notifications for pending moderation)
- `GITHUB_NOTIFY_LABELS` and `PUBLIC_APP_URL` (optional)

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
