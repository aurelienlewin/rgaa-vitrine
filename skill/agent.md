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
