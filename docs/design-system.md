# Système de design « Sobre »

Ce document décrit les principes, les jetons et les composants d’interface des pages publiques de l’Annuaire RGAA. Il s’applique à l’accueil, aux fiches site, aux pages domaine, au plan du site et à la déclaration d’accessibilité. La console de modération, outil interne, garde ses propres styles.

## Principes

1. **Le contenu d’abord.** Une page présente d’abord l’information (titre, adresse, niveau de conformité, score), puis les actions. Pas de tableaux de bord décoratifs : les chiffres clés tiennent en une ligne de texte.
2. **Un lien ressemble à un lien, un bouton déclenche une action.** La navigation et les liens vers d’autres pages sont des liens soulignés. Les boutons sont réservés aux actions (rechercher, envoyer, voter, paginer). Au plus un bouton principal par contexte.
3. **Des surfaces plates.** Une carte = une bordure fine. Pas de boîtes imbriquées, pas d’ombres, pas de dégradés.
4. **Une seule couleur d’action.** Le bleu `--ui-action` porte les liens et les boutons. Les couleurs de statut ne servent qu’à renforcer un libellé toujours présent en texte.
5. **Des textes courts et explicites.** Phrases simples, une idée par phrase, aucune consigne positionnelle (« ci-dessous », « à droite »).
6. **La même chose au même endroit.** En-tête (navigation puis titre de page), recherche globale, aide et pied de page sont identiques sur toutes les pages publiques.

Ces principes reprennent des patterns éprouvés : la distinction lien/bouton et la sobriété du Système de design de l’État (DSFR) et du GOV.UK Design System, ainsi que les orientations du brouillon WCAG 3 (lisibilité, langage clair, cohérence, réduction de la charge cognitive). Le référentiel opposable reste le RGAA 4.1.2 ; aucun pattern n’est retenu s’il dégrade un critère RGAA.

## Jetons

Définis dans `src/index.css` (`@layer base`, `:root`). Les pages publiques imposent le thème clair.

| Jeton | Valeur | Usage | Contraste sur blanc | APCA Lc |
| --- | --- | --- | --- | --- |
| `--ui-ink` | `#121a2b` | texte principal | 17,38:1 | 104,2 |
| `--ui-ink-muted` | `#33415f` | texte secondaire, métadonnées | 10,18:1 | 93,6 |
| `--ui-action` | `#0038c7` | liens, boutons, état courant | 8,79:1 | 88,7 |
| `--ui-action-hover` | `#002f9f` | survol | 11,01:1 | 98,3 |
| `--ui-on-action` | `#ffffff` | texte sur bouton principal | 8,79:1 | 93,3 |
| `--ui-surface` | `#ffffff` | fond de page et des cartes | — | — |
| `--ui-surface-alt` | `#f3f6fd` | panneaux (recherche, formulaire, encadrés) | texte principal 16,06:1 | 98,8 |
| `--ui-border` | `#6b7a99` | bordures porteuses d’information (champs) | 4,31:1 | 69,8 |
| `--ui-border-subtle` | `#d5dceb` | séparateurs décoratifs (cartes) | non requis | — |
| `--color-brand-focus` | `#b45309` | indicateur de focus (contour 3 px, décalé de 3 px) | 5,02:1 | 74,0 |

Badges de statut (texte et bordure de même couleur) :

| Badge | Texte / fond | Contraste | APCA Lc |
| --- | --- | --- | --- |
| `ui-badge-full` (Totalement conforme) | `#0f4a2f` / `#e4f8ee` | 9,29:1 | 86,5 |
| `ui-badge-partial` (Partiellement conforme) | `#5f3a00` / `#fff5da` | 9,24:1 | 87,3 |
| `ui-badge-none` (Non conforme) | `#631515` / `#ffe7e6` | 10,81:1 | 86,6 |
| `ui-badge-unknown` (Niveau inconnu) | `#26324a` / `#e9effa` | 11,11:1 | 89,1 |

Seuils retenus : au moins 4,5:1 pour tout texte et 3:1 pour les composants (RGAA 3.2, 3.3 ; WCAG 1.4.3, 1.4.11) ; au moins APCA Lc 75 pour le texte courant, méthode du brouillon WCAG 3, comme garde-fou supplémentaire.

## Composants

Classes définies dans `src/index.css` (`@layer components`).

| Classe | Rôle |
| --- | --- |
| `ui-container` | largeur de lecture de page (72 rem) et marges latérales |
| `ui-prose` | paragraphe de lecture (70 caractères, interligne 1,6) |
| `ui-section-title` | titre de section (`h2`) |
| `ui-muted` | texte secondaire |
| `ui-nav-list`, `ui-nav-link` | navigation en liens soulignés ; la page courante (`aria-current="page"`) est signalée par la couleur et un soulignement épais |
| `ui-action-link` | lien autonome (hors phrase) avec une zone cliquable de 44 px de haut |
| `ui-actions` | rangée de liens d’action |
| `ui-button` + `ui-button-primary` / `ui-button-secondary` | actions ; l’état désactivé est porté par l’attribut `disabled` et un style dédié, jamais par l’opacité |
| `ui-label`, `ui-field` | libellés et champs de formulaire (44 px de haut) |
| `ui-card` | carte plate (bordure fine) |
| `ui-panel` | bloc teinté (recherche, formulaire d’ajout, encadrés) |
| `ui-callout` | mise en avant (bordure gauche) |
| `ui-badge` + variante | niveau de conformité, toujours en texte |
| `ui-meta` | liste de définitions compacte (catégorie, mise à jour) |

## Carte de site (patron)

1. Vignette décorative (`alt=""`, `aria-hidden="true"`), l’identité du site étant donnée par le titre.
2. Titre `h3` qui est le lien vers la fiche annuaire.
3. Adresse du site en texte secondaire.
4. Une ligne de conformité : badge de niveau, score, version du RGAA.
5. Métadonnées `ui-meta` : catégorie, date de mise à jour.
6. Pied de carte : liens « Visiter le site (nouvel onglet) » et « Déclaration d’accessibilité (nouvel onglet) », puis le bouton de vote et le nombre de votes.

Le nom accessible d’un lien ou d’un bouton commence toujours par son texte visible (WCAG 2.5.3) ; le contexte est ajouté en texte masqué après (« Visiter le site (nouvel onglet) : Nom du site »).

## Contrôles automatisés

- `e2e/wcag22-regressions.spec.ts` : tailles de cible (2.5.8), focus non masqué (2.4.11), redistribution à 320 px (1.4.10), indication des nouveaux onglets.
- `e2e/rgaa-audit.spec.ts` : règles axe-core WCAG 2.2 AA sur les pages publiques auditées.
