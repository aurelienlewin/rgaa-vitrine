# Vitrine Fierte RGAA

Application Vite + React (FR) pour valoriser la conformite accessibilite d'un site a partir de son URL.

## Stack
- Vite + React + TypeScript
- Tailwind CSS v4 via `@tailwindcss/vite`
- API Node/Express securisee pour extraction metadonnees

## Fonctionnalites
- Saisie URL et analyse automatisee
- Affichage titre du site, vignette (`og:image`/`twitter:image`)
- Detection d'une page accessibilite
- Extraction best-effort d'un niveau de conformite et d'un score (%), si presents
- Interface front entierement en francais et orientee accessibilite clavier/focus

## Securite API
- Validation stricte des URL HTTP(S)
- Blocage des hotes locaux/prives (protection SSRF)
- Timeout reseau + limite de taille du HTML
- Limitation de debit sur endpoint API
- Aucune execution de contenu distant

## Demarrage
```bash
npm install
npm run dev
```

- Front: http://127.0.0.1:5173
- API: http://127.0.0.1:8787

## Commandes
```bash
npm run lint
npm run build
npm run preview
```

## Skill RGAA embarque
- `skill/rgaa-official-recommendations/SKILL.md`
- `skill/rgaa-official-recommendations/references/official-developer-recommendations.md`
