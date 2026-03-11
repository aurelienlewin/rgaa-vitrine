export const accessibilityAuditSummary = {
  status: 'Partiellement conforme',
  complianceStatus: 'partial',
  complianceStatusLabel: 'Partiellement conforme',
  score: '88,7 % (estimation)',
  complianceScore: 88.7,
  auditDate: '11 mars 2026',
  auditDateIso: '2026-03-11',
  scope: '5 pages publiques vérifiées',
  auditedPages: [
    'https://www.annuaire-rgaa.fr/',
    'https://www.annuaire-rgaa.fr/domaine/lenord-fr-22z5n2',
    'https://www.annuaire-rgaa.fr/site/access42-net-h0nx3j',
    'https://www.annuaire-rgaa.fr/plan-du-site',
    'https://www.annuaire-rgaa.fr/accessibilite',
  ],
  applicableCriteria: '106 critères vérifiés',
  nonConformitiesCount: '7 critères',
  nonConformitiesTotal: 7,
  remediationStatus: 'Corrections déployées sur les gabarits, recontrôle RGAA à planifier',
  rgaaBaseline: '4.1',
}

export const accessibilityNonConformities = [
  {
    id: '3.2',
    title: 'Contraste texte/fond des libellés de fallback de vignette',
    detail:
      'Un fallback de vignette affichait un contraste insuffisant en thème sombre. Les classes de rendu ont été corrigées pour maintenir un contraste conforme dans les deux thèmes.',
    impactedPages: 'Gabarit carte annuaire (accueil et variantes)',
    status: 'Correction déployée, en attente de contre-vérification',
  },
  {
    id: '3.3',
    title: 'Contraste des composants d’interface interactifs',
    detail:
      'Plusieurs liens et boutons reposaient sur des styles transparents hétérogènes. Les gabarits partagés utilisent désormais des surfaces explicites et contrastées pour les contrôles interactifs.',
    impactedPages: 'Accueil, plan du site, fiche site, page domaine, accessibilité, pied de page, en-tête secondaire',
    status: 'Correction déployée, en attente de contre-vérification',
  },
  {
    id: '10.4',
    title: 'Lisibilité à 200 % sans débordement horizontal',
    detail:
      'Des listes de liens sur la fiche site pouvaient déborder à fort zoom avec des libellés longs. Les liens concernés passent en largeur contrainte, retour à la ligne et rupture de mot.',
    impactedPages: 'Fiche site référencé',
    status: 'Correction déployée, en attente de contre-vérification',
  },
  {
    id: '10.5',
    title: 'Couplage couleur de texte et couleur de fond',
    detail:
      'Certaines zones utilisaient encore une couleur de texte explicite sur fond transparent (et inversement). Le couplage texte/fond a été normalisé dans les composants React et le CSS critique du shell HTML.',
    impactedPages: 'Gabarits partagés et shell critique (index HTML)',
    status: 'Correction déployée, en attente de contre-vérification',
  },
  {
    id: '10.8',
    title: 'Contenus cachés non destinés à rester exposés aux TA',
    detail:
      'Des régions live cachées via `sr-only` étaient remontées comme contenus cachés exposés. Les annonces runtime sont désormais rendues dans des panneaux visibles, ce qui supprime ce pattern caché.',
    impactedPages: 'Accueil, plan du site, fiche site, page domaine, modération',
    status: 'Correction déployée, en attente de contre-vérification',
  },
  {
    id: '10.9',
    title: 'Information orientée par la position dans la page',
    detail:
      'Certaines formulations d’orientation dépendaient encore de la position visuelle. Elles ont été reformulées avec des termes neutres et des repères nommés.',
    impactedPages: 'Déclaration d’accessibilité',
    status: 'Correction déployée, en attente de contre-vérification',
  },
  {
    id: '10.10',
    title: 'Repères rédigés avec une dépendance à la position',
    detail:
      'Une phrase de la déclaration utilisait encore un repère spatial implicite. Elle a été remplacée par une formulation non dépendante de la position.',
    impactedPages: 'Déclaration d’accessibilité',
    status: 'Correction déployée, en attente de contre-vérification',
  },
]

export const accessibilityImplementationTechnologies = [
  'HTML5',
  'CSS (Tailwind CSS 4.2.1)',
  'JavaScript',
  'TypeScript 5.9.3',
  'React 19.2.4',
  'Vite 7.3.1',
  'Node.js 25.2.1',
  'npm 11.6.2 (package manager)',
  'Express 5.2.1',
  'Upstash Redis 1.36.4 (si configuré)',
]

export const accessibilityAuditEnvironment = [
  'macOS 26.3.1 (build 25D2128)',
  'Node.js 25.2.1 (baseline Volta du projet)',
  'npm 11.6.2 (baseline Volta du projet)',
  'Audit exécuté avec Chrome DevTools (voir journal horodaté du 11 mars 2026)',
]

export const accessibilityEvaluationTools = [
  'rgaa-auditor 2.0.1 (outil interne, dossier ../audit)',
  'Chrome DevTools (captures, snapshots, scripts de vérification ciblés)',
  'Revue assistée Codex modèle gpt-5.3-codex (journal d’audit)',
  'Contrôles de qualité projet: npm run lint et npm run build',
]

export function buildAccessibilityStatementSnapshot(baseUrl) {
  return {
    url: `${baseUrl}/accessibilite`,
    complianceStatus: accessibilityAuditSummary.complianceStatus,
    complianceStatusLabel: accessibilityAuditSummary.complianceStatusLabel,
    complianceScore: accessibilityAuditSummary.complianceScore,
    scoreLabel: accessibilityAuditSummary.score,
    auditDate: accessibilityAuditSummary.auditDateIso,
    auditDateLabel: accessibilityAuditSummary.auditDate,
    auditScope: accessibilityAuditSummary.scope,
    applicableCriteria: accessibilityAuditSummary.applicableCriteria,
    nonConformitiesTotal: accessibilityAuditSummary.nonConformitiesTotal,
    nonConformitiesLabel: accessibilityAuditSummary.nonConformitiesCount,
    remediationStatus: accessibilityAuditSummary.remediationStatus,
    rgaaBaseline: accessibilityAuditSummary.rgaaBaseline,
  }
}
