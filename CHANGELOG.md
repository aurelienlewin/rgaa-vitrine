# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog and this project follows semantic-style commit topics.

## [Unreleased]

### Added
- Redis persistence wiring for showcase entries via Upstash Redis (`@upstash/redis`).
- New `GET /api/showcase` endpoint with optional filters (`search`, `status`, `category`, `limit`).
- `.env.example` for Redis configuration.
- Directory-first UI blocks with showcase KPIs (total / full / partial / none).
- Multi skip-link navigation (`contenu`, `filtres`, `ajout`) for keyboard users.
- Dedicated polite live region announcements (`role=\"status\"`, `aria-live=\"polite\"`).

### Changed
- `POST /api/site-insight` now persists analyzed entries with category.
- Frontend now loads showcase entries from API persistence instead of in-memory-only state.
- `GET /api/health` now exposes active storage mode (`redis` or `memory`).
- Reframed UX from \"single-site result\" to \"big filterable listing\".
- Registration flow wording now emphasizes adding a site to the directory (not auditing).
- Simplified information architecture to prioritize browsing/filtering over submission.

### Security
- Documented secret handling requirements for Upstash credentials.

## [2026-03-06]

### Added
- Initial open-source release of RGAA Vitrine.
- French accessible UI with URL analysis and showcase gallery.
- SEO metadata, JSON-LD, robots directives.
- Embedded official RGAA recommendations skill.
