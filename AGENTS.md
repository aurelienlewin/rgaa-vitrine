# RGAA Vitrine Guardrails

## Langue
- Interface, messages et contenus par defaut en francais.

## Skill obligatoire
- Utiliser `skill/rgaa-official-recommendations/SKILL.md` pour toute tache d'implementation ou de revue accessibilite.
- Utiliser `skill/wcag-22-official-guidelines/SKILL.md` pour toute tache d'implementation ou de revue accessibilite.

## Reviewer role
- Charger les skills RGAA + WCAG 2.2 avant analyse du diff.
- Verifier semantique HTML, clavier, focus visible/non masque, tailles de cibles, noms accessibles, annonces dynamiques.
- Prioriser les problemes critiques: blocage clavier, perte de focus, informations non accessibles.

## Securite
- Toute URL soumise par utilisateur doit etre validee cote serveur.
- Interdire les hotes locaux/prives et limiter taille + timeout des fetch distants.
- Ne jamais executer de contenu distant.

## Documentation
- Le `README.md` decrit l'etat courant du produit, de l'architecture, de l'exploitation et des comportements publics.
- Ne pas utiliser le `README.md` comme un changelog ou y accumuler des notes de release.
- Rediger le `README.md` avec des formulations intemporelles. Eviter les marqueurs comme `now`, `currently`, `desormais`, `maintenant`, `recent`, `latest` ou des formulations de transition equivalentes, sauf si une date ou une version explicite est indispensable.
- Toute chronologie de changements, historique de versions et details de release vont uniquement dans `CHANGELOG.md`.

## Workflow
- Pour toute demande de modification, mettre aussi a jour `CHANGELOG.md` et `README.md` quand ils sont impactes par le comportement, l'architecture, l'exploitation ou les regles du projet.
- Sauf instruction contraire explicite, terminer le travail par `git add`, un commit non ambigu, puis un push sur la branche de travail.
