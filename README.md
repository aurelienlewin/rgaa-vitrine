# RGAA Vitrine

> Showcase and celebrate RGAA compliance in French web ecosystems.

![RGAA Vitrine logo](./public/logo-rgaa-vitrine.svg)

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)
[![Vite](https://img.shields.io/badge/Vite-7.x-646CFF.svg)](https://vite.dev/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-v4-06B6D4.svg)](https://tailwindcss.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6.svg)](https://www.typescriptlang.org/)

RGAA Vitrine is an open-source French-first directory that lets organizations publish a
public RGAA pride listing: site metadata, detected accessibility statement page, and
declared compliance indicators.

Planned public website: **https://rgaa-vitrine.org**

## Highlights

- Simple French UI focused on listing discovery first.
- Multiple skip links for keyboard navigation (`contenu`, `filtres`, `ajout`, `aide`).
- Localized live region announcements for dynamic feedback (`polite` for status, `assertive` for errors).
- Directory-first UX with filters, categories, and search at the core.
- URL registration workflow with secure server-side metadata enrichment.
- Vitrine listing cards designed for disabled people and accessibility enthusiasts.
- RGAA awareness sections sourced from official French references.
- WCAG 2.2 awareness and references embedded in the UI.
- Tailwind CSS v4 native features used directly (`@theme` tokens + utility-first focus/skip-link patterns).
- Embedded skills: `rgaa-official-recommendations`, `wcag-22-official-guidelines`.

## Tech Stack

- Vite + React + TypeScript
- Tailwind CSS v4 via `@tailwindcss/vite`
- Node + Express API
- Upstash Redis (optional but recommended) for persistent showcase storage

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

You can check the active storage mode via:

- `GET /api/health`
- `GET /api/showcase`

## Security by default

- Strict URL validation (`http/https` only)
- SSRF protections (localhost/private/internal targets blocked)
- DNS resolution checks before remote fetch
- Response timeout and maximum HTML size limits
- Rate limiting on API endpoints
- No execution of remote page scripts

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

## Deployment (Vercel)

The repository includes native Vercel serverless endpoints in `api/`:

- `api/site-insight.js`
- `api/showcase.js`
- `api/health.js`

This avoids production `NOT_FOUND` responses on `/api/*` routes when the frontend is deployed as a Vite app.

Ensure these environment variables are configured in Vercel project settings:

- `KV_REST_API_URL` and `KV_REST_API_TOKEN`
or
- `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`

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
