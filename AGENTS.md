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
