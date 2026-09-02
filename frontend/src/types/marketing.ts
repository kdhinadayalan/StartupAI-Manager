export interface MarketingCampaign {
  id: string;
  workspace_id: string;
  name: string;
  channel: string;
  status: string;
  budget: number;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  target_audience?: string | null;
  goals?: string | null;
  created_at: string;
}

export interface CampaignAnalysisItem {
  id: string;
  name: string;
  channel: string;
  status: string;
  budget: number;
  spend: number;
  ctr_percent: number;
  cvr_percent: number;
  cost_per_acquisition: number;
  is_overbudget: boolean;
  is_underperforming: boolean;
}

export interface MarketingPerformance {
  total_campaigns: number;
  total_budget: number;
  total_spend: number;
  overall_ctr: number;
  overall_cvr: number;
  overall_cac: number;
  campaigns: CampaignAnalysisItem[];
  underperforming_count: number;
  underperforming_campaigns: CampaignAnalysisItem[];
}
