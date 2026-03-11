export const accessibilityAuditSummary = {
  status: 'Partiellement conforme',
  complianceStatus: 'partial',
  complianceStatusLabel: 'Partiellement conforme',
  score: '87,5 % (estimation)',
  complianceScore: 87.5,
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
  nonConformitiesCount: '8 critères',
  nonConformitiesTotal: 8,
  remediationStatus: 'Corrections déployées, recontrôle RGAA à planifier',
  rgaaBaseline: '4.1',
}

export const accessibilityNonConformities = [
  {
    id: '3.3',
    title: 'Contraste d’interface du sélecteur de tri',
    detail:
      'Le sélecteur de tri de l’accueil reposait sur un rendu natif à faible contraste. Un habillage explicite, rempli et fortement contrasté a été déployé.',
    impactedPages: 'Accueil de l’annuaire',
    status: 'Correction déployée, en attente de contre-vérification',
  },
  {
    id: '10.5',
    title: 'Couplage couleur de texte et couleur de fond',
    detail:
      'Certaines zones avec couleur de texte explicite reposaient encore sur un fond calculé transparent. Le couplage texte/fond a été renforcé dans les styles globaux.',
    impactedPages: 'Accueil, page domaine et déclaration d’accessibilité',
    status: 'Correction déployée, en attente de contre-vérification',
  },
  {
    id: '10.10',
    title: 'Repères rédigés avec une dépendance à la position',
    detail:
      'Certaines consignes d’orientation mentionnaient l’en-tête ou les éléments placés plus bas dans la page. Elles ont été reformulées autour de repères nommés et d’actions explicites.',
    impactedPages: 'Accueil de l’annuaire',
    status: 'Correction déployée, en attente de contre-vérification',
  },
  {
    id: '10.13',
    title: 'Contenu additionnel natif via attribut title',
    detail:
      'Un lien de découverte dans le shell HTML exposait encore un attribut `title`, ce qui produisait une infobulle native non contrôlable. Cet attribut a été retiré.',
    impactedPages: 'Page domaine auditée (shell commun du site)',
    status: 'Correction déployée, en attente de contre-vérification',
  },
  {
    id: '10.14',
    title: 'Liens d’évitement CSS visibles uniquement au clavier',
    detail:
      'Le tiroir de liens d’évitement devenait visible à la prise de focus sans équivalent au pointage. Il est désormais aussi visible au survol.',
    impactedPages: 'Page domaine multi-sites',
    status: 'Correction déployée, en attente de contre-vérification',
  },
  {
    id: '1.8',
    title: 'Aperçu local du badge présenté comme image de texte',
    detail:
      'L’aperçu local du lien retour affichait un badge image porteur d’information. Il a été remplacé par un aperçu en texte stylé, tout en conservant le code image en copie optionnelle.',
    impactedPages: 'Fiche site référencé',
    status: 'Correction déployée, en attente de contre-vérification',
  },
  {
    id: '13.5',
    title: 'Formulations techniques insuffisamment explicitées',
    detail:
      'Le plan du site et le pied de page exposaient plusieurs termes techniques sans reformulation immédiate. Les libellés publics ont été réécrits en langage plus explicite.',
    impactedPages: 'Plan du site',
    status: 'Correction déployée, en attente de contre-vérification',
  },
  {
    id: '13.9',
    title: 'Débordement horizontal en orientation portrait',
    detail:
      'Un libellé long dans les liens d’évitement de la fiche site pouvait provoquer un débordement horizontal en portrait. Les liens se replient désormais sur plusieurs lignes.',
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
