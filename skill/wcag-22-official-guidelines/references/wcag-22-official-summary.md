# WCAG 2.2 - Resume Officiel (W3C)

Date de consolidation: 2026-03-06.

## 1. Sources officielles
- https://www.w3.org/WAI/standards-guidelines/wcag/fr
- https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/
- https://www.w3.org/WAI/WCAG22/quickref/

## 2. Principes a appliquer
- Perceptible
- Utilisable
- Comprehensible
- Robuste

## 3. Focus sur WCAG 2.2 (nouveautes a verifier)

### 3.1 Focus visible, net et non masque
- 2.4.11 Focus not obscured (minimum)
- 2.4.12 Focus not obscured (enhanced)
- 2.4.13 Focus appearance

Application pratique:
- Indicateur de focus visible, contraste suffisant.
- Aucun composant fixe/sticky ne doit cacher l element focalise.

### 3.2 Interactions au pointeur
- 2.5.7 Dragging movements
- 2.5.8 Target size (minimum)

Application pratique:
- Eviter d imposer le glisser-deposer sans alternative.
- Garantir des cibles suffisantes (24x24 CSS au minimum, hors exceptions).

### 3.3 Aide et saisie
- 3.2.6 Consistent help
- 3.3.7 Redundant entry
- 3.3.8 Accessible authentication (minimum)
- 3.3.9 Accessible authentication (enhanced)

Application pratique:
- Position d aide stable et identifiable.
- Eviter de redemander des informations deja saisies.
- Ne pas bloquer avec des tests cognitifs sans alternative accessible.

## 4. Checklist implementation/review
- HTML semantique valide avant ARIA.
- Navigation clavier complete (tabulation + activation).
- Focus visible sur tous les composants interactifs.
- Cibles interactives suffisamment grandes.
- Messages d erreur explicites relies aux champs.
- Mises a jour dynamiques annoncees (`aria-live`) sans surcharge.
- Verification contrastes/couleur non unique canal d information.

## 5. Regle de traceabilite
Dans les PR/reviews:
- Lister les criteres WCAG verifies.
- Donner les preuves (composants evalues + comportement constate).
- Citer les sources W3C utilisees en cas d arbitrage.
