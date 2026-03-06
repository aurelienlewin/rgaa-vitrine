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
- Persistent manual moderation queue for non-auto-publishable submissions (`pending` state in memory/Redis).
- Protected moderation API endpoints (`GET /api/moderation/pending`, `POST /api/moderation/approve`, `POST /api/moderation/reject`).
- New `MODERATION_API_TOKEN` environment variable for admin-only validation actions.
- New frontend moderation page (`/moderation`) to authenticate and process pending submissions without curl.
- New Redis-backed read-through cache (TTL in-memory layer) to reduce repeated Upstash queries on identical listing/moderation reads.
- Local self-hosted dyslexia-friendly font assets are now bundled from `@fontsource` packages.
- Optional GitHub-native moderation notifications: new pending submissions can open issues automatically in a target repository.
- Added GitHub Actions-compatible notifier env fallbacks: `RGAA_NOTIFY_REPO` and `RGAA_NOTIFY_TOKEN`.
- Public site map page (`/plan-du-site`) with dedicated skip links and semantic navigation landmarks.
- Automatic sitemap generation endpoint (`/sitemap.xml`) exposed in local API and Vercel serverless routing.
- Reusable frontend SEO manager for per-page metadata updates (title, description, canonical, Open Graph, Twitter, JSON-LD).
- New skip-link target for direct keyboard access to footer content (`Aller au pied de page`).
- AI crawler discovery assets: `llms.txt`, `llms-full.txt`, and public `ai-context.json` summary endpoint.
- New public accessibility declaration page (`/accessibilite`) with audit score, non-conformities list, contact channel, and legal recourse information.
- Audit-driven remediation pass for previously non-conform criteria from production JSON report (`20260306-141236`).
- New protected moderation endpoints for published entries management: `GET /api/moderation/showcase`, `POST /api/moderation/showcase/update`, and `POST /api/moderation/showcase/delete`.

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
- Dark-mode rendering now relies on explicit Tailwind `dark:` variants and tokenized base colors instead of brittle utility overrides, preventing mixed light/dark surfaces.
- Global `:focus-visible` base styles have been reinforced for WCAG 2.2 keyboard focus visibility across all interactive controls.
- Logo SVG viewport now includes extra vertical safe area (`viewBox` + overflow) to prevent baseline clipping in strict renderers.
- `/api/site-insight` now stores non-auto-publishable submissions as `pending` (HTTP `202`) instead of rejecting them directly.
- `/api/health` now exposes whether moderation is enabled.
- Typography accessibility pass: replaced `text-xs` UI content with `text-sm` minimum for better readability.
- Contrast pass: strengthened muted/status dark-theme text colors to improve WCAG 2.2 readability margins.
- Main app footer now links to moderation page for authorized reviewers.
- Pending moderation duplicate lookup now uses a dedicated Redis URL index (no full pending-list scan per submission).
- Default app font stack now prioritizes `Atkinson Hyperlegible`, with `OpenDyslexic` and `Lexend` as accessible fallbacks.
- Vercel rewrites now route SPA paths (including `/moderation`) to `index.html`, fixing direct-access/refresh 404 errors.
- Header logo now spans full available width in the hero area (removed previous max-width cap).
- Tailwind color palette tokens (slate/sky/emerald/amber/rose) are now remapped to a higher-contrast low-vision scheme in light and dark modes.
- Links now expose stronger hover and visited-state distinction to improve orientation for low-vision browsing.
- Compliance badges now include stronger border contrast in addition to color coding.
- Added an explicit light/dark toggle (with persistence) in both main and moderation headers.
- Tailwind `dark:` variant now follows a root `.dark` class to support manual mode switching while keeping system fallback.
- Branding layout now keeps only the icon inside SVG; app title, baseline, and badge are rendered as Tailwind UI to prevent logo text clipping.
- `GET /api/health` now reports whether GitHub issue notifications are enabled.
- Footer now displays a discreet build stamp (`version + UTC timestamp`) to help spot stale cached deployments.
- Moderation view now enforces explicit `noindex,nofollow,noarchive` robots policy through the shared SEO layer.
- Footer UX now uses a responsive Tailwind grid with separated project info, quick navigation, and support actions.
- Sitemap and site map page now expose AI-oriented discovery resources (`ai-context`, `llms` files) for machine consumption.
- Homepage structured data now includes a `Dataset` entity that points to public JSON distributions (`/api/showcase`, `/ai-context.json`).
- Main navigation and site map now expose the accessibility declaration page for consistent user access.
- Sitemap now references `/accessibilite` for public indexing coverage.
- Submission flow now includes a review/confirmation step so data can be modified before final send.
- Skip-link layout has been adjusted to avoid narrow-viewport horizontal overflow.
- Theme toggle now relies on explicit accessible labels without tooltip-only `title` behavior.
- Navigation consistency improved across pages for `Plan du site` and `Accessibilité` discovery.
- Contrast and color-pair styling has been strengthened for interface components and link rendering.
- Skip-link containers are now fully hidden by default and only revealed on keyboard focus (`focus-within`) to prevent premature on-screen display.
- Public canonical domain references have been standardized to `https://annuaire-rgaa.fr` across SEO metadata, sitemap/robots hints, declaration content, and documentation.
- API metadata fetch now exposes a consistent Annuaire RGAA user-agent contact URL (`https://annuaire-rgaa.fr`).
- Accessibility-score extraction now supports broader French wording and decimal percentages (ex: `96,51 %`) from accessibility statements.
- Moderation UI now allows administrators to edit and delete published entries (title, category, status, score, vignette, accessibility URL).
- README now documents moderation update/delete payloads and Vercel handlers for published entries management routes.
- Frontend now lazy-loads non-home routes (`/moderation`, `/plan-du-site`, `/accessibilite`) to reduce initial JS bytes on homepage.
- Secondary font families (`OpenDyslexic`, `Lexend`) are deferred after first paint while keeping `Atkinson Hyperlegible` in critical path.
- Moderation now shows inline per-entry feedback during published-entry edits/deletions (pending changes, processing, success, errors).
- Directory tiles now use progressive pagination (`24` cards per batch) with a `Charger plus` control and automatic lazy loading near viewport end.
- Moderation message focus timing is now deferred to ensure reliable keyboard focus on freshly rendered feedback blocks.
- Frontend bootstrap now guards `window/document` usage for SSR-safe execution paths.
- Submission confirmation flow now moves focus to the \"Vérification avant envoi\" panel on trigger, then to in-progress status feedback during final send.
- Site insight compliance retrieval now consumes metadata hints (`rgaa:compliance-status`, `rgaa:compliance-score`) and stronger SPA-page textual signals to avoid false manual-review downgrades.

### Security
- Documented secret handling requirements for Upstash credentials.
- Hardened metadata fetch SSRF guardrails by validating every redirect hop before following it.

## [2026-03-06]

### Added
- Initial open-source release of Annuaire RGAA.
- French accessible UI with URL analysis and showcase gallery.
- SEO metadata, JSON-LD, robots directives.
- Embedded official RGAA recommendations skill.
