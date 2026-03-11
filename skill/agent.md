# RGAA Skill Notes

Canonical skill file: `skill/rgaa-official-recommendations/SKILL.md`.

Use this file as a prompt snippet companion. The actual Codex skill definition is in `SKILL.md`.

Quick invoke wording:

```text
Use the rgaa-official-recommendations skill for this accessibility task:
<your request here>
```

## Project-specific audit checklist (2026-03-07 baseline)

When remediating this project after a production audit, verify at minimum:

- `3.1` inline links must not rely on color only (permanent underline or equivalent marker).
- `3.2` status labels must keep text/background contrast >= WCAG AA in both themes.
- `3.3` interface contrast (borders, component boundaries, state visibility).
- `7.2` `<noscript>` must provide functional fallback paths (not message-only).
- `10.4` text must remain readable at `200%` zoom on long-label cards/lists without horizontal overflow.
- `10.5` CSS text/background color pairing on link and interactive styles.
- `10.8` hidden-content contract: avoid exposing purely hidden utility/live wrappers as permanent accessible content.
- `10.9` avoid directional wording (`ci-dessous`, `plus bas`, `en haut`) in user guidance.
- `10.10` orientation/help copy must reference named landmarks, sections, or controls instead of position.
- `10.6` contextual links must remain visually distinguishable from surrounding text.
- `10.11` reflow at `320px` width without horizontal scrolling caused by utility UI.
- `10.13` no tooltip-only `title` reliance on interactive controls.
- `11.11` clear error suggestion patterns in form inputs (example format included).
- `11.12` user can review/modify form data before final submission.
- `12.4` `Plan du site` access remains consistently available across pages.

Use this list as a rapid regression filter before running a full RGAA review.

## Operational lessons learned (2026-03-07)

- Treat compliance score as a signal, not an objective: prioritize unblocking customer journeys and UX continuity.
- For moderation actions that mutate lists (approve/reject/delete/block), move focus to the next logical control.
- Keep global and local live feedback (`polite`/`assertive`) synchronized with action outcomes.
- For blocked capabilities (example: votes blocked), expose unavailability with visible text and semantic disabled state.
- In editable moderation forms, keep user input intact on server error; do not clear fields unless action succeeded.
- Preserve keyboard and skip-link access to all major moderation zones (`pending`, `published`, `blocklists`).
- Favor short-lived server cache for repeated moderation reads to reduce external quota pressure.
- In moderation forms, prefer native input semantics (`type="url"`, `required`, `inputmode`) before custom validation.
- Always pair numeric moderation fields with explicit format/range help text and `aria-describedby`.
- Route-level loading fallback should be announced (`role="status"` + `aria-live="polite"`) to avoid silent waits.
- For repeated list actions (blocklist entries), include URL-specific accessible labels to avoid ambiguous “Retirer” controls in screen readers.
- For slug profile pages (`/site/{slug}`), pair canonical metadata with per-profile dataset discovery (`/api/showcase?slug={slug}`) to improve machine indexing without sacrificing UX.
- Keep profile crawlability redundant across channels: sitemap XML, plan du site visible links, and `ai-context`/`llms` hints should all expose the same profile pattern.
- Strengthen internal linking between profiles (related entries) using semantic lists and keyboard-focusable anchors to improve both crawl graph and journey continuity.
- Update accessibility declaration figures only from a completed review scope (`completedPages === pages`, no `inProgressPage`).
- Keep declaration non-conformity entries de-duplicated by criterion, and add impacted-page coverage to retain traceability.
- For script alternatives (`7.2`), provide direct fallback navigation to public pages/datasets in `<noscript>`.
- For contrast regressions, prefer explicit component tokens (status badges, bordered controls) over inherited color assumptions.
- Avoid relying on low-opacity disabled states as the only differentiation signal; keep explicit border/text/background contrast on inactive controls.
- Add a global fallback pairing layer for utility CSS (`text-*` and `bg-*`) when audits flag criterion `10.5` on declaration coupling.

## Generalized guidance update (2026-03-07 remediation)

- Standardize accessibility primitives across routes (header, skip links, footer, focus ring, live regions) before local component tweaks.
- Keep critical journey entry points consistent on every page (search, navigation hubs, and primary return paths).
- Express state changes in at least two channels: semantic state (`disabled`, ARIA/live) and visible state (contrast, labels, boundaries).
- Treat disabled controls as first-class UI states with explicit color/border/text combinations, not opacity-only styling.
- Keep no-script alternatives functionally useful, not informational only.
- Use responsive constraints that preserve content/controls at narrow widths without horizontal scrolling.
- Expand jargon and acronyms in editorial text where they first matter for comprehension.
- Preserve focus continuity after async mutations: next logical control, local summary, or triggering control.
- Track accessibility status with dated scope and evidence; avoid carrying stale declarations across releases.

## Operational lessons learned (2026-03-08 remediation)

- For criterion `12.5`, use a single shared search component and a single stable anchor (`#moteur-recherche-global`) across routes, footer, and skip links.
- For criterion `10.13`, avoid `title` on non-visible alternate/discovery links; prefer explicit visible labels in page content.
- For criterion `1.8`, treat preview screenshots as decorative (`alt=""`) when equivalent site identity is already present in nearby text.
- For criterion `3.3`, avoid same-color control backgrounds inside same-color containers; prefer either strong filled controls or transparent controls with high-contrast borders.
- For criterion `10.5`, pair color declarations at multiple levels (stylesheet rules + runtime DOM class/style pairing) to reduce drift in utility-heavy interfaces.

## Operational lessons learned (2026-03-08 UX journey hardening)

- Avoid duplicate journey entry points: keep exactly one primary `role="search"` form per page and route all quick links to that single anchor.
- Keep a stable global navigation landmark (`#navigation-principale`) across routes and make skip-link landings focus the landmark programmatically, not only by hash jump.
- When filters are preloaded from URL parameters, move focus to the results summary after data load so keyboard/screen-reader users immediately receive contextual feedback.
- For card-heavy directories, preserve semantic structure (`ul > li > article`) even when redesigning visuals; group metadata and actions without flattening heading hierarchy.
- Keep action targets at least 44px high and maintain explicit focus styling after any visual redesign.
- For reciprocal discovery features (backlinks), provide both a visual badge snippet and a text-only fallback snippet.
- In backlink embed code, always ship explicit `alt` on `img` and explicit `aria-label` on the wrapping link; do not rely on surrounding context.
- For decorative thumbnails in cards, continue using `alt=""` + `aria-hidden="true"` when equivalent text is present in adjacent content.

## Operational lessons learned (2026-03-11 remediation sweep)

- Keep critical shell CSS (`index.html`) and React component styles synchronized for text/background pairing; audits can fail on first paint even when runtime styles are correct.
- For criterion `10.5`, avoid `bg-transparent` on interactive controls that already set explicit text colors; prefer explicit filled surfaces in both light and dark themes.
- For criterion `3.2`, verify placeholder/fallback texts (example: “Aucune vignette disponible”) in dark mode, not only primary content blocks.
- For criterion `10.8`, avoid persistent hidden live-region wrappers as a generic pattern; prefer visible feedback panels with `role="status"` / `role="alert"` and `aria-live`.
- For criterion `10.4`, enforce `min-w-0`, wrapped text, and URL wrapping (`wrap-anywhere`) inside card/list layouts to keep zoomed content readable.
- For criteria `10.9` and `10.10`, sanitize declaration/help copy to remove positional cues and keep references tied to named sections, landmarks, or controls.
