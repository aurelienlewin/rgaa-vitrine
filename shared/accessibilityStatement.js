export const accessibilityAuditSummary = {
  status: 'Partiellement conforme',
  complianceStatus: 'partial',
  complianceStatusLabel: 'Partiellement conforme',
  score: '93,8 % (estimation)',
  complianceScore: 93.8,
  auditDate: '12 mars 2026',
  auditDateIso: '2026-03-12',
  scope: '5 pages publiques vérifiées',
  auditedPages: [
    'https://www.annuaire-rgaa.fr/',
    'https://www.annuaire-rgaa.fr/domaine/lenord-fr-22z5n2',
    'https://www.annuaire-rgaa.fr/site/access42-net-h0nx3j',
    'https://www.annuaire-rgaa.fr/plan-du-site',
    'https://www.annuaire-rgaa.fr/accessibilite',
  ],
  applicableCriteria: '106 critères vérifiés',
  nonConformitiesCount: '4 critères',
  nonConformitiesTotal: 4,
  remediationStatus: 'Corrections déployées sur les gabarits, recontrôle RGAA à planifier',
  rgaaBaseline: '4.1',
}

export const accessibilityNonConformities = [
  {
    id: '3.3',
    title: 'Contraste des composants d’interface interactifs',
    detail:
      'Plusieurs contrôles partagés (liens et boutons) utilisaient des styles transparents ou des bordures trop faibles. Les gabarits ont été harmonisés avec des surfaces explicites, des bordures renforcées et un thème public stabilisé en mode clair pour éviter les régressions de contraste.',
    impactedPages:
      'Accueil, page domaine, fiche site, plan du site, déclaration d’accessibilité, en-tête secondaire, pied de page',
    status: 'Correction déployée, en attente de contre-vérification',
  },
  {
    id: '10.5',
    title: 'Couplage couleur de texte et couleur de fond',
    detail:
      'Certaines règles CSS définissaient une couleur de texte sans fond associé (ou l’inverse), notamment sur les placeholders, la carte de maintenance et des variantes de contrôles. Les déclarations texte/fond ont été appariées dans les composants et dans le CSS critique du shell HTML.',
    impactedPages:
      'Gabarits partagés de recherche, shell critique (index HTML), page accessibilité et variantes de maintenance',
    status: 'Correction déployée, en attente de contre-vérification',
  },
  {
    id: '10.12',
    title: 'Espacement du texte sans perte de contenu',
    detail:
      'Les zones de code backlink de la fiche site utilisaient des `textarea` qui tronquaient le contenu lorsque les espacements de texte étaient redéfinis. Ces extraits sont désormais affichés dans des blocs `pre/code` en retour à la ligne, sans hauteur fixe.',
    impactedPages: 'Fiche site référencé',
    status: 'Correction déployée, en attente de contre-vérification',
  },
  {
    id: '13.5',
    title: 'Contenus cryptiques sans alternative explicite',
    detail:
      'La page accessibilité affichait des URLs brutes pouvant être interprétées comme syntaxe cryptique. Les contenus sont reformulés avec des libellés explicites et des liens descriptifs.',
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
  'Audit exécuté avec Chrome DevTools (voir journal horodaté du 12 mars 2026)',
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
