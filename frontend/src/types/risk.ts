export type RiskSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type RiskStatus = 'IDENTIFIED' | 'MONITORING' | 'MITIGATED' | 'ACCEPTED';

export interface RiskItem {
  id: string;
  workspace_id: string;
  title: string;
  description?: string | null;
  category: string;
  likelihood: number;
  impact: number;
  risk_score: number;
  severity: RiskSeverity;
  status: RiskStatus;
  mitigation_plan?: string | null;
  detected_by: string;
  created_at: string;
}

export interface RiskScanSignal {
  category: string;
  title: string;
  description: string;
  indicator: string;
  likelihood: number;
  impact: number;
  risk_score: number;
  severity: RiskSeverity;
  affected_tasks?: Array<{ id: string; title: string }>;
}
