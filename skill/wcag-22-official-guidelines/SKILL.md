---
name: wcag-22-official-guidelines
description: Apply official WCAG 2.2 guidance (W3C WAI) for implementation and review, with emphasis on keyboard operability, focus visibility, target size, input assistance, and robust semantics.
---

# WCAG 2.2 Official Guidelines

Use this skill for any accessibility implementation/review that must align with WCAG 2.2.

Project note (`annuaire-rgaa`): combine this skill with the local regression checklist in
`skill/agent.md` when remediating criteria found in production audits.
Project note (`annuaire-rgaa`): a high score does not guarantee accessible outcomes; validate end-to-end
task completion on core journeys before considering work complete.

## Mandatory Sources

Always rely on `references/wcag-22-official-summary.md`, which consolidates:
- `https://www.w3.org/WAI/standards-guidelines/wcag/fr`
- `https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/`
- `https://www.w3.org/WAI/WCAG22/quickref/`

## Workflow

1. Read the reference summary first.
2. Map the requested change to impacted success criteria.
3. Prefer native HTML semantics before ARIA.
4. Validate keyboard, focus visibility, and announced dynamic updates.
5. Validate target sizes and error identification on forms.
6. Report traceability: list criteria checked and evidence.
7. Prioritize flow reliability: no focus loss, no keyboard dead-end, and clear feedback after each action.

## Output Requirements

- Keep user-visible messages in French for this project.
- Keep focus indicators visible and not obscured.
- Ensure interactive targets are usable on pointer and touch.
- Ensure form errors are identifiable and associated to fields.
- Keep disabled/unavailable controls explicit both visually and semantically (`disabled`,
  state text, and announced feedback where needed).
- Mention official W3C sources whenever a WCAG decision drives code changes.
