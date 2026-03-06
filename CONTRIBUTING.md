# Contributing

Thanks for your interest in improving RGAA Vitrine.

## Principles

- Keep UX and content in French by default.
- Preserve accessibility-first behavior (keyboard, focus, semantics, ARIA).
- Do not weaken SSRF protections and URL validation in the API.
- Keep changes small and easy to review.

## Local setup

```bash
npm install
npm run dev
```

## Quality checks

Before opening a pull request:

```bash
npm run lint
npm run build
```

## Pull request checklist

- [ ] Scope is clear and focused.
- [ ] Accessibility impact is tested (keyboard and focus at minimum).
- [ ] Security impact is considered for URL handling and remote fetch.
- [ ] README/docs updated if behavior changed.
- [ ] CHANGELOG updated when behavior/API/storage changes.

## Commit style

Use conventional-like messages grouped by topic, e.g.:

- `feat(ui): ...`
- `feat(api): ...`
- `docs: ...`
- `chore: ...`
