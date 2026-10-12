export const accessibilityAuditSummary = {
  status: 'Totalement conforme',
  complianceStatus: 'full',
  complianceStatusLabel: 'Totalement conforme',
  score: '100 % (auto-évaluation)',
  complianceScore: 100,
  auditDate: '12 octobre 2026',
  auditDateIso: '2026-10-12',
  scope: '5 pages publiques vérifiées',
  auditedPages: [
    'https://www.annuaire-rgaa.fr/',
    'https://www.annuaire-rgaa.fr/domaine/lenord-fr-22z5n2',
    'https://www.annuaire-rgaa.fr/site/access42-net-h0nx3j',
    'https://www.annuaire-rgaa.fr/plan-du-site',
    'https://www.annuaire-rgaa.fr/accessibilite',
  ],
  applicableCriteria: '106 critères évalués, dont 63 applicables',
  nonConformitiesCount: 'aucun critère',
  nonConformitiesTotal: 0,
  remediationStatus:
    'Auto-évaluation outillée complète ; les non-conformités 3.3 et 10.13 de l’audit du 12 mars 2026 sont levées. Un audit indépendant reste recommandé.',
  rgaaBaseline: '4.1',
}

// Non-conformities still open after the latest audit (empty when every applicable criterion is met).
export const accessibilityNonConformities = []

export const accessibilityResolvedNonConformities = [
  {
    id: '3.3',
    title: 'Contraste des composants d’interface interactifs',
    detail:
      'Levée le 12 octobre 2026 : bordures de champs à 4,31:1, boutons à 8,79:1 et indicateur de focus à 5,02:1 dans le système de design « Sobre ».',
  },
  {
    id: '10.13',
    title: 'Contenus additionnels au survol ou focus',
    detail:
      'Levée le 12 octobre 2026 : aucun attribut title ni contenu additionnel au survol ou au focus sur les pages auditées.',
  },
]

export const accessibilityImplementationTechnologies = [
  'HTML5',
  'CSS (Tailwind CSS 4.3.3)',
  'JavaScript',
  'TypeScript 5.9.3',
  'React 19.3.0',
  'Vite 8.3.4',
  'Node.js 26.9.0',
  'npm 11.6.2 (gestionnaire de paquets)',
  'Express 5.3.0',
  'Upstash Redis 1.39.0 (si configuré)',
]

export const accessibilityAuditEnvironment = [
  'macOS 26.7.1 (build 25G241)',
  'Chromium piloté par Playwright 1.64.0, largeurs 1440, 640 (zoom 200 %) et 320 px',
  'Node.js 26.9.0, npm 11.6.2',
  'Rendu de production (npm run build) avec les données publiques de production en lecture seule',
]

export const accessibilityEvaluationTools = [
  'axe-core 4.13 (règles WCAG 2.0 à 2.2 A/AA et bonnes pratiques)',
  'html-validate 9 (validité du DOM rendu)',
  'Scripts Playwright de contrôle RGAA (ordre de tabulation, focus, liens d’évitement, messages de statut, redistribution, espacement du texte)',
  'Calcul des contrastes WCAG 2.x et APCA (méthode du brouillon WCAG 3)',
  'Rapport détaillé par critère : docs/audits/rgaa-2026-10-12.md du dépôt public',
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
