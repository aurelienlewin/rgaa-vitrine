export const accessibilityAuditSummary = {
  status: 'Partiellement conforme',
  complianceStatus: 'partial',
  complianceStatusLabel: 'Partiellement conforme',
  score: '96,7 % (estimation)',
  complianceScore: 96.7,
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
  nonConformitiesCount: '2 critères',
  nonConformitiesTotal: 2,
  remediationStatus: 'Corrections déployées, contre-audit RGAA à planifier',
  rgaaBaseline: '4.1',
}

export const accessibilityNonConformities = [
  {
    id: '3.3',
    title: 'Contraste des composants d’interface interactifs',
    detail:
      'Le dernier audit de référence signale des contrastes insuffisants sur certains contrôles partagés (navigation secondaire, formulaire de recherche global). Les styles ont été durcis avec des surfaces de contrôle explicites et des bordures renforcées pour éviter les collisions de contraste entre composants et conteneurs.',
    impactedPages:
      'Accueil, page domaine, fiche site référencé, plan du site, en-tête secondaire partagé',
    status: 'Correction déployée, en attente de contre-vérification',
  },
  {
    id: '10.13',
    title: 'Contenus additionnels au survol ou focus',
    detail:
      'Un lien technique alternatif injecté dans `<head>` exposait un attribut `title`, ce qui créait un contenu additionnel non contrôlable au survol/focus. Cet attribut a été retiré ; la description reste disponible dans le contenu visible et structuré.',
    impactedPages: 'Fiche site référencé',
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
