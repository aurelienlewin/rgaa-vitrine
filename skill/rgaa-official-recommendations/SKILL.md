---
name: rgaa-official-recommendations
description: Apply official RGAA developer recommendations from info.gouv.fr/accessibilite/developpement and its linked resources (guide developpeur, guide integrateur, memo dev, checklist dev, JS ARIA component references). Use for any accessibility implementation or review that must align with French government guidance.
---

# RGAA Official Recommendations

Use this skill when a task requires strict alignment with official French RGAA development guidance.

Project note (`annuaire-rgaa`): after any production accessibility audit, cross-check the local
remediation checklist in `skill/agent.md` before finalizing.

When a task explicitly asks for WCAG 2.2 compliance or evidence, also load:
- `skill/wcag-22-official-guidelines/SKILL.md`

## Mandatory Sources

Always rely on `references/official-developer-recommendations.md`, which consolidates the full recommendation sets from:
- `https://design.numerique.gouv.fr/articles/2026-03-02-rgaa5/`
- `https://disic.github.io/guide-developpeur/`
- `https://disic.github.io/guide-integrateur/`
- `https://design.numerique.gouv.fr/outils/memo-dev/`
- `https://design.numerique.gouv.fr/outils/checklist-dev/`
- `https://www.info.gouv.fr/accessibilite/developpement/bibliotheque-de-reference-des-restitutions-des-composants-javascript-aria`
- `https://www.info.gouv.fr/accessibilite/developpement/le-guide-des-composants-javascript-accessibles`

## Workflow

1. Read the consolidated reference file first.
2. Map requested changes to impacted recommendations (layout, navigation, forms, ARIA, keyboard, dynamic updates).
3. Enforce the `Checklist dev` 6 checks before finalizing.
4. For JavaScript widgets/components, validate behavior against the official ARIA component resources before shipping.
5. Report traceability in PR notes: list which recommendation groups were applied and how they were verified.

## Output Requirements

- Keep all user-visible and announced strings in French.
- Preserve semantic HTML first; use ARIA only to complement missing native semantics.
- Ensure keyboard operability and visible focus on all interactive controls.
- Guard dynamic updates with appropriate focus strategy and live announcements.
- Mention source links explicitly in reviews or QA notes when decisions depend on them.
