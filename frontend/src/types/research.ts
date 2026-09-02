export interface ResearchItem {
  id: string;
  workspace_id: string;
  title: string;
  topic: string;
  source_name: string;
  source_url?: string | null;
  content: string;
  key_findings?: string | null;
  swot_category: string;
  competitor_name?: string | null;
  is_verified: boolean;
  created_at: string;
}

export interface SwotItem {
  id: string;
  title: string;
  key_findings: string;
  source: string;
  competitor?: string | null;
}

export interface SwotMatrix {
  STRENGTH: SwotItem[];
  WEAKNESS: SwotItem[];
  OPPORTUNITY: SwotItem[];
  THREAT: SwotItem[];
}

export interface CompetitorIntelligence {
  competitor: string;
  intelligence_count: number;
  findings: Array<{
    title: string;
    topic: string;
    swot: string;
    findings: string;
    source: string;
  }>;
}
