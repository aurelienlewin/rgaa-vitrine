# RGAA Skill Notes

Canonical skill file: `skill/rgaa-official-recommendations/SKILL.md`.

Use this file as a prompt snippet companion. The actual Codex skill definition is in `SKILL.md`.

Quick invoke wording:

```text
Use the rgaa-official-recommendations skill for this accessibility task:
<your request here>
```

## Project-specific audit checklist (2026-03-06 baseline)

When remediating this project after a production audit, verify at minimum:

- `3.3` interface contrast (borders, component boundaries, state visibility).
- `10.5` CSS text/background color pairing on link and interactive styles.
- `10.11` reflow at `320px` width without horizontal scrolling caused by utility UI.
- `10.13` no tooltip-only `title` reliance on interactive controls.
- `11.11` clear error suggestion patterns in form inputs (example format included).
- `11.12` user can review/modify form data before final submission.
- `12.4` `Plan du site` access remains consistently available across pages.

Use this list as a rapid regression filter before running a full RGAA review.

## Operational lessons learned (2026-03-06)

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
