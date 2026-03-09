export type AccessibilityAuditSummary = {
  status: string
  complianceStatus: 'full' | 'partial' | 'none'
  complianceStatusLabel: string
  score: string
  complianceScore: number
  auditDate: string
  auditDateIso: string
  scope: string
  auditedPages: string[]
  applicableCriteria: string
  nonConformitiesCount: string
  nonConformitiesTotal: number
  remediationStatus: string
  rgaaBaseline: string
}

export type AccessibilityNonConformity = {
  id: string
  title: string
  detail: string
  impactedPages: string
  status: string
}

export declare const accessibilityAuditSummary: AccessibilityAuditSummary
export declare const accessibilityNonConformities: AccessibilityNonConformity[]
export declare const accessibilityImplementationTechnologies: string[]
export declare const accessibilityAuditEnvironment: string[]
export declare const accessibilityEvaluationTools: string[]

export declare function buildAccessibilityStatementSnapshot(baseUrl: string): {
  url: string
  complianceStatus: 'full' | 'partial' | 'none'
  complianceStatusLabel: string
  complianceScore: number
  scoreLabel: string
  auditDate: string
  auditDateLabel: string
  auditScope: string
  applicableCriteria: string
  nonConformitiesTotal: number
  nonConformitiesLabel: string
  remediationStatus: string
  rgaaBaseline: string
}
