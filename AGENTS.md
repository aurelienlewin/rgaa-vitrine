# RGAA Vitrine Guardrails

## Langue
- Interface, messages et contenus par defaut en francais.

## Skill obligatoire
- Utiliser `skill/rgaa-official-recommendations/SKILL.md` pour toute tache d'implementation ou de revue accessibilite.

## Reviewer role
- Charger le skill officiel RGAA avant analyse du diff.
- Verifier semantique HTML, clavier, focus visible, noms accessibles, annonces dynamiques.
- Prioriser les problemes critiques: blocage clavier, perte de focus, informations non accessibles.

## Securite
- Toute URL soumise par utilisateur doit etre validee cote serveur.
- Interdire les hotes locaux/prives et limiter taille + timeout des fetch distants.
- Ne jamais executer de contenu distant.
