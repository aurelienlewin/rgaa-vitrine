# Recommandations Officielles RGAA (Developpement)

Date de consolidation: 2026-03-06.

## Sommaire
- 1. Sources officielles obligatoires
- 2. Memo dev (recommandations detaillees)
- 3. Checklist dev (6 verifications rapides)
- 4. Guide developpeur RGAA (synthese operationnelle)
- 5. Guide integrateur RGAA (fiches a couvrir)
- 6. Ressources officielles composants JavaScript ARIA

## 1. Sources officielles obligatoires
- https://disic.github.io/guide-developpeur/
- https://disic.github.io/guide-integrateur/
- https://design.numerique.gouv.fr/outils/memo-dev/
- https://design.numerique.gouv.fr/outils/checklist-dev/
- https://www.info.gouv.fr/accessibilite/developpement/bibliotheque-de-reference-des-restitutions-des-composants-javascript-aria
- https://www.info.gouv.fr/accessibilite/developpement/le-guide-des-composants-javascript-accessibles

## 2. Memo dev (recommandations detaillees)

### Layout
- Declarer un doctype valide.
- Declarer toujours la langue de traitement sur la balise `html`.
- Valider le code source.
- Structurer la page avec les landmarks ARIA.
- En HTML5, structurer la page avec les balises HTML5 et les landmarks ARIA.

### Navigation
- Definir des titres de pages pertinents.
- Implementer un lien d'acces rapide au contenu.
- Implementer un lien d'acces rapide a la navigation principale.
- Implementer des liens d'evitement pour tous les groupes de liens importants.
- Implementer au moins deux systemes de navigation.

### Contenus
- Donner un titre pertinent aux cadres en ligne.
- Utiliser les balises appropriees pour structurer les listes.
- Indiquer les changements de langue et de sens de lecture.
- Indiquer les ouvertures de nouvelles fenetres.
- Indiquer le format et le poids des documents en telechargement.

### Tableaux
- Implementer `role="presentation"` sur les tableaux de mise en forme.
- Declarer les cellules d'en-tete dans des elements `th`.
- Implementer `scope="col"` pour les en-tetes de colonnes.
- Implementer `scope="row"` pour les en-tetes de lignes.
- Utiliser les relations `id` et `headers` pour lier les cellules de donnees a leurs en-tetes en cas de fusion.

### Liens
- Eviter les liens vides.
- Definir des intitules de liens pertinents.
- Respecter la construction des titres de liens.

### Formulaires
- Definir des etiquettes pertinentes.
- Utiliser une methode conforme pour relier champs et etiquettes.
- Indiquer les champs obligatoires et le format de saisie (de preference dans l'etiquette).
- En cas d'erreur de saisie, relier l'erreur au champ et donner un exemple reel si necessaire.

### Focus
- Garder une prise de focus visible et non degradee par l'`outline`.
- Ne pas reposer uniquement sur la couleur pour identifier les liens, leur survol et leur focus.
- Garantir une navigation clavier coherente sans piege clavier.

### Distinction fond / forme
- Aucun contenu ne doit disparaitre lors de l'activation/desactivation des styles.
- La page doit rester comprehensible et correctement ordonnee sans styles.

### Images
- Definir un `alt` sur toutes les images `img`.
- Definir `alt=""` pour les images decoratives.
- Fournir une alternative pertinente pour les images porteuses d'information.
- Eviter autant que possible les images de texte.

### Information par la couleur / forme
- Ne pas transmettre une information uniquement par la couleur.
- Ne pas transmettre une information uniquement par la forme.
- Prevoir des alternatives pertinentes a la couleur et a la forme.

### Agrandissement des caracteres
- Ne pas fixer les tailles de police en pixels.
- Eviter de fixer les hauteurs de boites en pixels.
- Utiliser `overflow:hidden` avec precaution.
- Preferer des points de rupture en `em` quand possible.

### Multimedia
- Faire preceder les videos d'un titre.
- Fournir un lien clairement identifie vers une alternative accessible des medias non temporels.

## 3. Checklist dev (6 verifications rapides)

### 1) Le titre de la page est unique et pertinent
- Verifier le contenu de la balise `title`.
- Le titre doit distinguer la page des autres et refleter son contenu.

### 2) La balise `html` possede l'attribut `lang` avec la langue principale
- Verifier `lang` sur `html`.
- Ajouter `lang` sur les conteneurs des passages en langue differente.

### 3) Le code HTML est valide au regard de la DTD
- Verifier ecriture des balises.
- Verifier imbrication conforme.
- Verifier ouverture/fermeture conforme.
- Verifier syntaxe des attributs.
- Verifier valeurs conformes (ex: identifiants dupliques interdits).

### 4) La page est entierement navigable et utilisable au clavier
- Naviguer avec `Tab` uniquement.
- Verifier activations clavier des liens et boutons (`Espace` / `Entree`).
- Verifier absence de blocage clavier.

### 5) La semantique des balises HTML est correctement utilisee
- Utiliser `a` pour la navigation vers une autre page/site.
- Utiliser `button` pour une action dans la page ou soumission formulaire.
- Utiliser `span` uniquement pour du texte dans des conteneurs structurants.
- Structurer les listes avec balises semantiques, pas avec presentation seule.

### 6) Chaque champ de formulaire est associe a son etiquette
- Cliquer chaque etiquette pour verifier focus/activation du champ cible.
- Garantir l'association explicite entre etiquette et champ.

## 4. Guide developpeur RGAA (synthese operationnelle)

### Fiche 1 - Ordre de tabulation et piege au clavier
- Maintenir un ordre de tabulation coherent apres manipulation du focus via JavaScript.
- Verifier l'absence de piege clavier (acces au precedent/suivant possible).

### Fiche 2 - Compatibilite et acces clavier
- S'assurer que les composants sont compatibles accessibilite.
- S'assurer que composants et fonctionnalites sont operables au clavier.

### Fiche 3 - Changement de contexte et alertes non sollicitees
- Avertir l'utilisateur et lui laisser le controle des changements de contexte.
- Rendre les alertes non sollicitees controlables par l'utilisateur.

### Fiche 4 - API ARIA
- Decrire chaque composant riche avec role + etats/proprietes `aria-*` adaptes.
- Utiliser ARIA pour completer les limites HTML natives, pas pour contourner la semantique native sans raison.
- Prevoir les interactions clavier equivalentes aux interactions souris.

### Fiche 5 - Restitution lecteur d'ecran
- Exposer role, etat et nom accessible (`aria-label` ou `aria-labelledby`) pour les composants custom.
- Fournir l'operabilite clavier (`tabindex`, `Entree`, `Espace`) en coherence avec le composant.

### Fiche 6 - Motifs de conception ARIA
- S'appuyer sur les motifs ARIA (ex: dialog) pour structure et comportements clavier.
- Pour une modale: focus a l'ouverture, confinement du focus, fermeture `Esc`, retour focus au declencheur.
- Declarer relation controle/contenu (`aria-controls`) et etat (`aria-expanded`) quand applicable.

### Fiche 7 - Base de reference (tests de restitution)
- Tester les composants avec une base de reference lecteur d'ecran/navigateur.
- Verifier conformite du motif puis restitution reelle en integration.
- Documenter les technologies testees et le niveau de support.

### Fiche 8 - Utiliser ARIA
- Privilegier les elements HTML natifs avant les roles ARIA equivalents.
- Preserver la semantique native des elements.
- Rendre operables clavier tous les elements interactifs controles par ARIA.
- Ne pas utiliser `role="presentation"` ou `aria-hidden="true"` sur un element visible focusable.
- Donner un nom accessible a tout composant ARIA.
- Utiliser `aria-live` avec parcimonie (`polite` vs `assertive`, `aria-atomic`, `aria-relevant`).

## 5. Guide integrateur RGAA (fiches a couvrir)

Le guide integrateur fournit 12 fiches thematiques (egalement reprises dans le memo dev):
- 1. Gabarit general
- 2. Navigation
- 3. Contenus
- 4. Tableaux
- 5. Liens
- 6. Formulaires
- 7. Focus
- 8. Distinction fond/forme
- 9. Images
- 10. Information par forme/couleur
- 11. Agrandissement des caracteres
- 12. Multimedia

Liens directs:
- https://disic.github.io/guide-integrateur/1-gabarit-general.html
- https://disic.github.io/guide-integrateur/2-navigation.html
- https://disic.github.io/guide-integrateur/3-contenus.html
- https://disic.github.io/guide-integrateur/4-tableaux.html
- https://disic.github.io/guide-integrateur/5-liens.html
- https://disic.github.io/guide-integrateur/6-formulaires.html
- https://disic.github.io/guide-integrateur/7-focus.html
- https://disic.github.io/guide-integrateur/8-distinction-fond-forme.html
- https://disic.github.io/guide-integrateur/9-images.html
- https://disic.github.io/guide-integrateur/10-infos-forme-couleur.html
- https://disic.github.io/guide-integrateur/11-agrandissement-des-caracteres.html
- https://disic.github.io/guide-integrateur/12-multimedia.html

## 6. Ressources officielles composants JavaScript ARIA

### Bibliotheque de reference des restitutions des composants JavaScript ARIA
- Utiliser la bibliotheque pour verifier la restitution effective des composants avec technologies d'assistance.
- Ne pas supposer qu'un composant est conforme parce qu'il existe dans une librairie.
- Verifier les resultats de restitution avant adoption en production.
- Source: https://www.info.gouv.fr/accessibilite/developpement/bibliotheque-de-reference-des-restitutions-des-composants-javascript-aria

### Guide des composants JavaScript accessibles
- Utiliser les tutoriels/correctifs par framework avant d'integrer un composant riche.
- Couverture de composants et frameworks recenses: jQuery UI, Bootstrap, Angular Material, React Toolbox.
- Composants recenses: accordion, tabs, autocomplete, menu button, date picker, carousel, collapse, dropdown, modal, button toggle, checkbox, slider.
- Source: https://www.info.gouv.fr/accessibilite/developpement/le-guide-des-composants-javascript-accessibles

## Regle d'application dans les tickets
- Appliquer d'abord la semantique HTML native.
- Completer avec ARIA uniquement si necessaire.
- Verifier clavier + focus + restitution lecteur d'ecran a chaque changement.
- Documenter en PR quelles sections ci-dessus ont ete verifiees.
