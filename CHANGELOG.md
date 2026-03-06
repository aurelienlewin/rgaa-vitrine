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
- Official RGAA 5 awareness article added to project references and embedded skill sources.
- Dedicated WCAG 2.2 skill with official W3C references and review checklist.
- New in-app WCAG 2.2 help section with links to W3C FR guidance.
- Vercel-native serverless API entrypoints added under `api/` for production deployments.
- Anti-abuse submission guardrails: honeypot field, stricter submission rate limit, spam/marketing signal checks, and non-publishable submission rejection.
- Adaptive accessibility preferences support for low-vision contexts (`dark mode`, `reduced motion`, `high contrast`, `forced colors`).
- Keyboard shortcuts for filtering UX (`Échap` to clear search, explicit filters reset action).

### Changed
- `POST /api/site-insight` now persists analyzed entries with category.
- Frontend now loads showcase entries from API persistence instead of in-memory-only state.
- `GET /api/health` now exposes active storage mode (`redis` or `memory`).
- Reframed UX from \"single-site result\" to \"big filterable listing\".
- Registration flow wording now emphasizes adding a site to the directory (not auditing).
- Simplified information architecture to prioritize browsing/filtering over submission.
- Redis config now accepts `KV_REST_API_URL`/`KV_REST_API_TOKEN` aliases in addition to `UPSTASH_*`.
- UI now highlights the March 2, 2026 RGAA 5 official article with explicit transition messaging.
- UI controls now use larger interactive targets and reinforced focus handling for WCAG 2.2 alignment.
- Form error handling now exposes `aria-invalid` and explicit error association (`aria-describedby`).
- French locale wording has been corrected (accents, apostrophes, and typography) across UI, metadata, and API error messages.
- Repeated action links in showcase cards now include specific `aria-label` values for clearer screen-reader context.
- Styling now relies on Tailwind CSS v4 native patterns (`@theme` design tokens and utility-based focus/skip-link behavior) instead of custom component CSS classes.
- User feedback has been split into localized vocal channels: `aria-live=\"polite\"` for status and `aria-live=\"assertive\"` for errors, with dedicated directory/form error rendering.
- Logo has been fully redesigned in SVG with richer visual identity and embedded accessibility semantics (`role=\"img\"`, `title`, `desc`, high-contrast text).
- Backend app setup has been centralized in `server/app.js` and shared by local runtime + serverless handlers.
- URL normalization now canonicalizes listings at domain level (dedupe across `www`/path variants).
- Frontend submission flow now supports `approved`, `duplicate`, and `pending` outcomes with localized feedback.
- Added explicit browser metadata for light/dark color scheme support (`meta color-scheme` + themed `theme-color`).
- French contractions now consistently use typographic apostrophes (`’`) in UI and API user-facing messages.
- Keyboard navigation has been hardened with reliable skip-link focus targets (`main` and landmark sections now receive programmatic focus).
- Dynamic error/status feedback blocks now receive focus when displayed to improve keyboard and screen-reader discoverability.
- Directory filters now expose explicit control relationships (`aria-controls`) and helper guidance for keyboard-only users.
- Directory filters now include an explicit `Rechercher` CTA (search form submit) with focus return to results summary.
- SVG logo baseline clipping has been fixed by adding vertical canvas padding and rebalancing text block positioning.
- App branding has been renamed to `Annuaire RGAA` (including metadata, UI labels, package name, and crawler user-agent).
- Vercel config now removes invalid `functions.runtime` to comply with current platform runtime validation.

### Security
- Documented secret handling requirements for Upstash credentials.

## [2026-03-06]

### Added
- Initial open-source release of Annuaire RGAA.
- French accessible UI with URL analysis and showcase gallery.
- SEO metadata, JSON-LD, robots directives.
- Embedded official RGAA recommendations skill.
