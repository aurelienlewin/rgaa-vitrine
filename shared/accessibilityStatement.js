export const accessibilityAuditSummary = {
  status: 'Partiellement conforme',
  complianceStatus: 'partial',
  complianceStatusLabel: 'Partiellement conforme',
  score: '96,8 % (estimation)',
  complianceScore: 96.8,
  auditDate: '8 mars 2026',
  auditDateIso: '2026-03-08',
  scope: '4 pages publiques vérifiées',
  auditedPages: [
    'https://www.annuaire-rgaa.fr/',
    'https://www.annuaire-rgaa.fr/plan-du-site',
    'https://www.annuaire-rgaa.fr/accessibilite',
    'https://www.annuaire-rgaa.fr/site/access42-net-h0nx3j',
  ],
  applicableCriteria: '424 critères vérifiés',
  nonConformitiesCount: '2 critères',
  nonConformitiesTotal: 2,
  remediationStatus: 'Plan d’action en cours',
  rgaaBaseline: '4.1',
}

export const accessibilityNonConformities = [
  {
    id: '10.5',
    title: 'Déclarations de couleurs de texte et de fond à compléter',
    detail:
      'Certaines zones de texte doivent expliciter plus systématiquement leur couleur de fond associée pour garantir une lecture stable quel que soit le contexte d’affichage.',
    impactedPages: 'Accueil de l’annuaire',
    status: 'Correction en cours',
  },
  {
    id: '10.11',
    title: 'Adaptation aux petites hauteurs d’affichage',
    detail:
      'Le contenu doit être ajusté pour limiter le recours au défilement vertical dans des fenêtres de faible hauteur, tout en conservant toutes les informations et fonctionnalités.',
    impactedPages: 'Accueil de l’annuaire',
    status: 'Correction en cours',
  },
]

export const accessibilityImplementationTechnologies = [
  'HTML5',
  'CSS (Tailwind CSS 4.2.1)',
  'JavaScript',
  'TypeScript 5.9.3',
  'React 19.2.0',
  'Vite 7.3.1',
  'Node.js 25.2.1',
  'Express 5.2.1',
]

export const accessibilityAuditEnvironment = [
  'macOS 26.3.1 (build 25D2128)',
  'Node.js 25.2.1',
  'npm 11.6.2',
  'Audit exécuté avec Chrome DevTools (voir journal horodaté du 8 mars 2026)',
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
