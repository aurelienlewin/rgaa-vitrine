# RGAA Vitrine

> Showcase and celebrate RGAA compliance in French web ecosystems.

![RGAA Vitrine logo](./public/logo-rgaa-vitrine.svg)

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)
[![Vite](https://img.shields.io/badge/Vite-7.x-646CFF.svg)](https://vite.dev/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-v4-06B6D4.svg)](https://tailwindcss.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6.svg)](https://www.typescriptlang.org/)

RGAA Vitrine is an open-source French-first project that lets organizations publish a
public "pride card" for accessibility maturity: site metadata, detected accessibility
statement page, and best-effort compliance score/status extraction.

Planned public website: **https://rgaa-vitrine.org**

## Highlights

- French UI focused on accessibility clarity.
- URL analysis workflow with secure server-side metadata extraction.
- Vitrine gallery with categories, search, and filters.
- RGAA awareness sections sourced from official French references.
- Embedded skill: `rgaa-official-recommendations`.

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

- `POST /api/site-insight` analyzes a site and persists one showcase entry
- `GET /api/showcase` returns persisted showcase entries (supports `search`, `status`, `category`, `limit`)
- `GET /api/health` returns service status and active storage mode

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

## RGAA Sources Embedded

- `skill/rgaa-official-recommendations/SKILL.md`
- `skill/rgaa-official-recommendations/references/official-developer-recommendations.md`

Official references include:

- https://disic.github.io/guide-developpeur/
- https://disic.github.io/guide-integrateur/
- https://design.numerique.gouv.fr/outils/memo-dev/
- https://design.numerique.gouv.fr/outils/checklist-dev/
- https://www.info.gouv.fr/accessibilite/developpement/bibliotheque-de-reference-des-restitutions-des-composants-javascript-aria
- https://www.info.gouv.fr/accessibilite/developpement/le-guide-des-composants-javascript-accessibles
