# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog and this project follows semantic-style commit topics.
Changelog entries are written in English; referenced UI labels remain in French where relevant.

## [Unreleased]

### Changed
- Homepage multi-site cards now keep a simplified, card-consistent layout: sibling site previews were moved back to the dedicated domain detail page and the card now exposes a single explicit CTA to reduce tab stops and link-list ambiguity.
- Added a general score disclaimer on homepage and accessibility contact page so the declarative nature of submitted scores is stated once, without live-region noise, and moderation remains the path for documented re-evaluations.
- Public detail routes now preload their API payload before React mounts and bootstrap only the active page module, reducing direct-entry request chains and JavaScript waste on `/site/*` and `/domaine/*`.
- Public detail routes now keep the shared secondary header/search shell stable with inline critical CSS and Atkinson font preloads, while the full stylesheet is deferred out of the blocking render path.
- Route-aware head fallbacks now update title, description, canonical URL, and robots earlier on key public/detail paths so first-paint metadata stays coherent before React hydration.
- Site and domain detail pages now expose clearer new-tab labels, explicit busy states, and non-disruptive copy feedback while keeping loading announcements polite.
- `/plan-du-site` now lists public multi-site domain pages directly, keeping crawlable internal discovery aligned with the generated XML sitemap.

## [2026-03-10]

### Fixed
- Hotfix `0.5.1`: restored `GET /api/showcase` after the multi-site domain grouping rollout by reading the grouped-domain payload with the correct object shape, so public directory requests no longer fail with `TypeError: groups.filter is not a function`.
- Disabled the noisy `express-rate-limit` forwarded-header validation on the deployed proxy path so production logs no longer emit misleading validation errors while request limiting behavior stays unchanged.

### Added
- Project toolchain is now pinned in `package.json` with `packageManager: npm@11.6.2` and Volta metadata (`node 25.2.1`, `npm 11.6.2`) to keep local installs and audits on an explicit runtime baseline.
- GitHub-native moderation notifications now support optional per-window anti-abuse limits via `GITHUB_NOTIFY_MAX_PER_WINDOW` and `GITHUB_NOTIFY_WINDOW_SECONDS`.
- New public multi-site domain pages (`/domaine/{groupSlug}`) and `GET /api/domain-groups` endpoint now expose grouped domain views when several public entries belong to the same registrable domain.

### Changed
- Homepage directory cards now collapse same-domain entries into one accessible multi-site tile, while keeping each child site as its own public profile with its own metadata and outbound links.
- Submission preview/final confirmation now detect same-domain sibling sites, announce that context through French live feedback, and clarify that the new URL is treated as a distinct sub-site instead of an exact duplicate.
- Moderation pending/published views now surface same-domain context (published siblings, pending siblings, and direct link to the public domain page) so reviewers can process clustered submissions consistently.
- Public showcase payloads now expose `registrableDomain`, `domainGroupSlug`, `domainGroupPath`, and `domainContext`; sitemap/AI context discovery also include the new domain-group pages.
- Dependency refresh: `@upstash/redis` `1.36.4`, `@eslint/js` `9.39.4`, `eslint` `9.39.4`, `@types/node` `25.3.5`, `eslint-plugin-react-refresh` `0.5.2`, and `globals` `17.4.0`.
- Added `tldts` for registrable-domain detection so multi-site grouping does not incorrectly collapse public-suffix based hosts.
- Kept ESLint on the `9.x` line so clean installs remain compatible with `eslint-plugin-react-hooks` `7.0.1`, including Vercel `npm install` runs.
- GitHub moderation issue payloads now neutralize GitHub mentions from submitted site metadata, and notifier issue creation is throttled per time window so public pending submissions cannot fan out into unbounded issue spam while still staying in the moderation queue.
- Accessibility statement technical references now reflect the explicit project toolchain and the currently resolved frontend/runtime stack used for the audited service.
- Homepage logo and footer GitHub avatar now declare intrinsic `width`/`height`, which reserves layout space earlier and reduces CLS without changing semantics, labels, or keyboard flow.
- Homepage bootstrap no longer scans live stylesheets or mutates DOM class/style pairs after first paint; the text/background fallback guard is now CSS-only, reducing startup recalculation pressure while preserving contrast-safe defaults.
- Homepage now preloads the LCP logo, marks the logo with high fetch priority, fetches the directory immediately on mount, and hydrates client-specific vote state through a separate `/api/showcase/vote-state` request so the critical annuaire payload stays cache-friendly.
- Live regions now apply inline visually-hidden styles immediately on render, and homepage stats/results summaries reserve stable numeric/text space, reducing bootstrap CLS without changing announced French messages or focus flow.
- Moderation pending submissions now use a stronger alert-style presentation with a visible action summary, explicit `À traiter` badges, higher-contrast card framing, and more prominent approval/rejection controls so manual reviews are less likely to be missed.
- Showcase thumbnails now render in a framed `contain` layout with an inner adaptive canvas, improving contrast for transparent logos with dark or light strokes in both themes and preventing `cover` cropping on directory cards.
- Submission error feedback on the homepage now prioritizes short French user guidance, moves focus to a dismissable alert panel, and keeps raw technical diagnostics behind an explicit expandable disclosure.
- Site analysis now caches host-validation lookups during a single run, only follows `ai-context` when the target site explicitly advertises it, and reuses short-lived preview results during final confirmation to avoid duplicate remote fetches.
- Pre-analysis thumbnail extraction now falls back to site logos and icons when `og:image` / `twitter:image` are missing, improving preview coverage for brand-first sites.

## [2026-03-09]

### Added
- Shared accessibility-statement snapshot module reused across frontend and server code.
- `ai-context.json` now exposes a machine-readable accessibility-statement snapshot (`complianceStatus`, `complianceScore`, `rgaaBaseline`) for shell-only route discovery.

### Changed
- Accessibility statement data is now centralized in a shared snapshot reused by `/accessibilite`, `/ai-context.json`, and static metadata fallbacks; pre-analysis can fall back to AI context when a SPA route only exposes stale shell metadata.
- Static fallback metadata now aligns the published RGAA compliance score with the current accessibility declaration (`96.8`).

## [2026-03-08]

### Added
- Homepage structured data now exposes a broader entity graph (`WebPage`, `WebApplication`, `DataCatalog`) around the existing `WebSite` and public showcase dataset.
- Public showcase metadata now includes discovery-oriented fields: `siteHost`, `siteOrigin`, and `hasAccessibilityPage`.
- Accessibility declaration structured data now exposes explicit accessibility properties (`accessibilitySummary`, `accessibilityFeature`, `accessibilityControl`, `accessMode`) plus a dedicated declaration entity.
- Redis persistence wiring for showcase entries via Upstash Redis (`@upstash/redis`).
- New `GET /api/showcase` endpoint with optional filters (`search`, `status`, `category`, `limit`).
- `.env.example` for Redis configuration.
- Directory-first UI blocks with showcase KPIs (total / full / partial / none).
- Multi skip-link navigation for keyboard users (French UI labels: `contenu`, `filtres`, `ajout`).
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
- New accessible upvote system on showcase tiles, with `POST /api/showcase/upvote` and persisted `upvoteCount`.
- Dedicated Vercel serverless handlers for showcase routes: `api/showcase/index.js` and `api/showcase/upvote.js`.
- New moderation rule endpoints for editable site blocklist and vote blocklist, plus `delete-and-block` action on published entries.
- Frontend Vercel Web Analytics integration via `@vercel/analytics`.
- New public backlink badge asset (`/badge-backlink-annuaire-rgaa.svg`) aligned with Annuaire RGAA branding.

### Changed
- Profile pages now model referenced sites as `WebSite` entities instead of `Organization`, link detected accessibility declarations as dedicated `WebPage` nodes, and enrich per-profile datasets with measured variables and reuse metadata.
- Static `index.html` metadata fallback is now aligned with runtime JSON-LD and advertises the public showcase dataset through alternate discovery links.
- AI context schema documentation now lists the new public showcase discovery fields (`siteHost`, `siteOrigin`, `hasAccessibilityPage`) and the service accessibility snapshot used for shell-only route discovery.
- Accessibility declaration (`/accessibilite`) now reflects the latest production audit baseline (`20260308-021904`) with the active non-conformity list (`3.3`, `10.10`) and impacted pages.
- Accessibility statement data is now centralized in a shared snapshot reused by `/accessibilite`, `/ai-context.json`, and static metadata fallbacks; pre-analysis can fall back to AI context when a SPA route only exposes stale shell metadata.
- Shared global search form now carries the full homepage search feature set (query, status, category, submit, reset, `Échap`) across homepage and secondary routes (`#moteur-recherche-global`).
- Homepage duplicate search landmark has been removed; results filtering now follows the single shared header search flow.
- Main navigation landmark is now unified as `#navigation-principale` across all pages, and skip links now expose a consistent target to that landmark.
- Homepage logo contrast has been reinforced (criterion `3.3` remediation) and positional wording has been removed from `/accessibilite` (criterion `10.10` remediation).
- Directory tiles were redesigned for stronger UX readability (hierarchical chips, metadata cards, grouped CTAs, separated vote control) while preserving semantic structure and keyboard/screen-reader behavior.
- Profile backlink section now exposes two copy-ready snippets: a visual badge variant with explicit `alt` + link `aria-label`, and a text-only fallback variant.
- Homepage showcase thumbnails are now decorative (`alt=""`) when equivalent textual information is already available in card content.
- Alternate discovery links in `<head>` no longer rely on native `title` tooltips.
- UI contrast pass: interactive controls now use stronger border-based affordances and high-contrast skip-link styling; same-surface white-on-white controls were removed.
- Utility color pairing hardening now updates both stylesheet rules and live DOM class/style fallbacks to keep text/background declarations coupled.
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
- Submission flow now gives the same focused feedback style for URLs already pending moderation as for existing duplicates, with immediate panel display and no extra confirmation step.
- Successful site-add feedback is now a focusable success panel that includes an explicit `Rafraîchir la page` action.
- Accessibility declaration page now includes explicit sections for implementation technologies, audit environment, and evaluation tools based on real project/audit data.
- `POST /api/site-insight` now marks already-pending URL collisions with `alreadySubmitted: true` so frontend UX can distinguish “new pending review” from “already under review”.
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
- Duplicate submission feedback is now rendered in a dedicated accessible panel with `aria-live="polite"`, automatic focus, dismiss action, and direct moderation contact links for re-listing requests.
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
- Documentation now clarifies that `rgaa:compliance-*` extraction depends on deploying the latest frontend metadata before submission tests.
- Submission flow now performs a non-persistent pre-analysis (`/api/site-insight?preview=1`) and displays detected score/status before final confirmation.
- Submission CTA flow has been split for accessibility: form submit only runs pre-analysis, while final `Confirmer l’envoi` is inside the verification panel after analysis (with dedicated focus/state handling).
- UI now uses Tailwind v4.1 `wrap-anywhere` for long URL readability and `user-valid` / `user-invalid` variants for progressive URL field feedback.
- Skip-link containers and list offsets now rely on Tailwind v4.2 logical utilities (`start-*`, `ps-*`) instead of left/padding-left direction-specific classes, improving writing-direction robustness.
- Public directory cards now link to dedicated internal profile pages (`/site/{slug}`) to strengthen crawlable internal linking.
- Public showcase API now returns `slug` and `profilePath` per entry, and accepts `slug` as a direct filter for profile-page retrieval.
- Sitemap generation now publishes one URL per referenced site profile (`/site/{slug}`) in addition to core pages and API resources.
- Outbound links to referenced sites now preserve referral visibility (`noopener` without `noreferrer`) to facilitate reciprocal discovery.
- Profile pages now publish richer structured data (`WebPage`, referenced-site `Organization`, and per-profile `Dataset` with direct `DataDownload` link).
- Profile pages now expose stronger crawl paths with related-profile internal links and footer navigation targets.
- `Plan du site` now fetches and renders an explicit extract of `/site/{slug}` links for additional internal discovery and associated `ItemList` structured data.
- `ai-context` and `llms*.txt` now document profile-page patterns and profile-level API access (`/api/showcase?slug={slug}`), including crawl seed URLs.
- Page chrome consistency pass: shared secondary header navigation and shared global footer are now applied across `/plan-du-site`, `/accessibilite`, `/site/{slug}`, and `/moderation`.
- Skip links on secondary/moderation pages now include direct keyboard access to the footer (`Aller au pied de page`).
- Moderation page now masks archive/dashboard/blocklist widgets until a valid moderation token is submitted.
- Footer build version now resolves from release tags first (then package version), preventing stale `0.0.0` display when releases are published.
- `GET /api/showcase` now accepts `clientVoterId` and returns per-entry vote state (`hasUpvoted`) for the current visitor.
- Vote registration now applies layered anti-abuse safeguards (client fingerprint + network fingerprint + hourly limiter) with localized feedback messages.
- Vercel host redirects no longer force `www.annuaire-rgaa.fr -> annuaire-rgaa.fr` in-app config, preventing cyclic apex/www loops that broke `/api/showcase` and pre-analysis requests.
- Frontend API payload parsing now detects HTML fallbacks explicitly and surfaces a clear routing error instead of generic “invalide” messages.
- Vercel rewrite routing now proxies all `/api/*` requests through `/api` with a preserved logical path (`__rgaa_path`), fixing production cases where API subroutes fell back to `index.html`.
- Vercel function glob now targets nested API handlers (`api/**/*.js`) so showcase/moderation subroutes share the same runtime limits.
- Showcase vote-state reads now rely on a client vote index + TTL server cache, reducing Upstash command volume (no per-entry `SISMEMBER` burst on listing loads).
- Redis persistence now writes compact payloads (short hash fields + unix timestamps) and hashed vote fingerprints (`h:*`) to reduce Upstash storage usage.
- Pending-by-URL Redis hash writes have been removed; pending lookup now derives deterministic submission IDs from normalized URLs.
- Focus management has been reworked across home and moderation actions: focus now stays local for in-place actions, moves to contextual summaries on view changes, and redirects to the next logical control when edited/deleted rows disappear.
- Public showcase now exposes moderation vote availability state (`votesBlocked`) and disables voting on blocked URLs.
- Site submissions are now rejected when the normalized URL is in moderation blocklist.
- Moderation UI now includes accessible editors for site blocklist and vote blocklist.
- Showcase and moderation tiles now expose an RGAA baseline indicator (`RGAA 4.1` or `RGAA 5.0 prêt`) with explicit explanatory text and backend detection.
- Category inputs are now split by role: public submission uses a fixed accessible select list, while moderation keeps custom category editing capabilities.
- Moderation update flow now allows explicit per-site override of the RGAA baseline badge (`4.1` or `5.0-ready`).
- Existing showcase entries now resolve to `RGAA 4.1` by default; `RGAA 5.0 prêt` appears only after explicit moderation override.
- Add-site category control now uses a visible select list (including `Coopérative et services`) with no public custom-text override.
- `/api/site-insight` now normalizes public category values to the moderator-approved set and falls back to `Autre` for unknown values.
- Vercel API deployment now uses consolidated handlers (`api/index.js` + `api/[...slug].js`) to stay under Hobby serverless function limits.
- Route lazy-loading fallback now exposes a polite live status for assistive technologies.
- Lazy-loaded content completion is now explicitly announced on `/site/{slug}` and `/plan-du-site` (loaded/empty/error) through dedicated `aria-live="polite"` regions.
- Moderation token authentication now supports session restoration (tab scope by default, optional 12h device persistence) and explicit sign-out that clears stored session data.
- Moderation UI now defaults to non-persistent token storage (session scope only) unless a reviewer explicitly enables 12h device persistence.
- Moderation archive import UI now exposes an explicit rollback override control for destructive `replace` restores.
- Moderation form accessibility pass: token and blocklist URL inputs are explicitly required, editable URL fields are typed as URL, score input includes guidance text, and blocklist row actions expose contextual accessible labels.
- Serverless API adapter now normalizes absolute/relative request URLs before dispatching to Express (`/api/*`, `/sitemap.xml`, `/ai-context.json`).
- Showcase loading now accepts multiple API payload shapes (`{ entries }`, array, and legacy nested entries) to avoid false “Liste d’annuaire invalide”.
- Canonical SEO hardening: Vercel host redirects now consolidate `www.annuaire-rgaa.fr` and legacy `.org` hosts to `https://annuaire-rgaa.fr`.
- Homepage structured data now exposes a `SearchAction`, with URL-synced `?recherche=` support for crawlable search landing URLs.
- `sitemap.xml` now bypasses HTTP caching (`Cache-Control: no-store`) so new published sites appear in sitemap immediately.
- Accessibility declaration content now reflects the latest completed multi-page review scope (home, site map, accessibility page) with refreshed score/criteria counts and impacted-page traceability.
- Contextual links in the accessibility declaration now use persistent visual markers (underline + offset) to avoid color-only distinction.
- `<noscript>` now exposes functional fallback links to core public resources (`/plan-du-site`, `/accessibilite`, `/sitemap.xml`, `/api/showcase`) instead of a message-only fallback.
- Header/form controls and the “Niveau inconnu” badge now use stronger contrast-safe color/border combinations to reduce text and non-text contrast failures.
- CSS utility hardening now adds explicit color/background fallback pairing for `text-*` and `bg-*` classes to reduce criterion `10.5` regressions.
- Secondary pages (`/plan-du-site`, `/accessibilite`) now expose `BreadcrumbList` structured data.
- Open Graph and Twitter metadata now include URL/image-alt/secure image fields for richer sharing previews.
- Sitemap now includes `/api/showcase`, and `robots.txt` explicitly blocks moderation paths from indexing.
- `GET /api/showcase` now returns cache-friendly headers (`Cache-Control`, `Last-Modified`) to improve crawl efficiency.
- Moderation now supports full database archive export (`GET /api/moderation/archive`) and import (`POST /api/moderation/archive/import`) in `merge` or `replace` mode.
- Archive export/import includes published entries, pending queue, blocklists, vote fingerprints, and client vote indexes in a readable JSON envelope.
- Moderation UI now includes an accessible archive section (download + import form with explicit mode selection and focus-safe feedback).
- Accessibility remediation pass (latest `../audit/out/20260307-201423`) is now reflected across all routes, not only audited public pages.
- Secondary header now exposes a consistent annuaire search access pattern (`role="search"` + direct search route link) to keep navigation parity across pages.
- Skip links now remain explicitly link-like (persistent underline) to avoid color-only/context ambiguity.
- Primary/confirmation/disabled action states now use explicit high-contrast color tokens instead of opacity-only disabled rendering.
- Added runtime CSS rule pairing hardening so color/background declarations stay coupled on utility-heavy stylesheets.
- Accessibility declaration page now reports zero known blocking non-conformities for this remediation baseline and tracks ongoing commitments instead of stale NC lists.
- Acronym expansions (RGAA, WCAG, UX) are now exposed in shared editorial surfaces to reduce cryptic wording.
- `<noscript>` fallback now includes direct home/search access in addition to existing public resources.
- Moderation blocklist forms now avoid fixed minimum width values that could trigger narrow viewport reflow issues.

### Security
- Documented secret handling requirements for Upstash credentials.
- Hardened metadata fetch SSRF guardrails by validating every redirect hop before following it.
- Vote anti-abuse fingerprinting now ignores malformed forwarded-IP headers and only accepts valid IP values.
- Moderation API now enforces a minimum `MODERATION_API_TOKEN` length (`32` chars) and rejects weak configuration.
- Added dedicated brute-force throttling for failed `/api/moderation/*` authentication attempts.
- Removed legacy `x-admin-token` moderation header alias (accepted headers are now `x-moderation-token` or `Authorization: Bearer`).
- Moderation archive exports/imports now support HMAC integrity signing (`MODERATION_ARCHIVE_SIGNING_SECRET`) with signature verification on import.
- Destructive archive import (`mode: replace`) now blocks stale rollbacks by default and requires explicit override (`allowRollback=true`) to force older restores.
- GitHub notifier now ignores implicit `GITHUB_TOKEN`, validates custom `GITHUB_API_URL` as public HTTPS, and applies an outbound timeout.

## [2026-03-06]

### Added
- Initial open-source release of Annuaire RGAA.
- French accessible UI with URL analysis and showcase gallery.
- SEO metadata, JSON-LD, robots directives.
- Embedded official RGAA recommendations skill.
