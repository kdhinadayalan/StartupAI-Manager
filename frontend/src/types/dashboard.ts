export interface StartupHealthBreakdown {
  delivery_score: number;
  runway_score: number | null;
  risk_score: number;
  delivery_weight: number;
  runway_weight: number;
  risk_weight: number;
}

export interface StartupHealth {
  health_score: number;
  grade: 'EXCELLENT' | 'HEALTHY' | 'CAUTION' | 'CRITICAL';
  data_confidence: 'FULL_DATA' | 'PARTIAL_DATA';
  limitation_notice?: string | null;
  breakdown: StartupHealthBreakdown;
}

export interface DeliverySummary {
  score: number;
  status: string;
  total_tasks: number;
  completed_tasks: number;
  overdue_tasks: number;
}

export interface FinanceSummary {
  score: number | null;
  runway_status: string;
  monthly_burn_rate: number;
  runway_months: number | null;
  current_cash_balance: number;
  currency: string;
  overbudget_categories_count: number;
  message: string;
}

export interface RisksSummary {
  score: number;
  total_active_risks: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
}

export interface MarketingSummary {
  total_campaigns: number;
  total_spend: number;
  overall_ctr: number;
  overall_cvr: number;
  overall_cac: number;
  underperforming_count: number;
}

export interface ResearchSummary {
  strengths_count: number;
  weaknesses_count: number;
  opportunities_count: number;
  threats_count: number;
  competitors_count: number;
}

export interface PendingApprovalCard {
  id: string;
  action_type: string;
  action_payload: string;
  risk_level: string;
  requested_by_agent: string;
  explanation?: string | null;
  created_at: string;
}

export interface RecentAlert {
  id: string;
  type: string;
  severity: string;
  title: string;
  message: string;
  link?: string | null;
  created_at: string;
}

export interface DashboardSummary {
  health: StartupHealth;
  delivery: DeliverySummary;
  finance: FinanceSummary;
  risks: RisksSummary;
  marketing: MarketingSummary;
  research: ResearchSummary;
  pending_approvals: PendingApprovalCard[];
  recent_alerts: RecentAlert[];
}
