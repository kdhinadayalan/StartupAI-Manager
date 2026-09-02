import { User } from './auth';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';
export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXECUTED';

export interface PendingApproval {
  approval_id: string;
  risk_level: RiskLevel;
  action: string;
  payload: Record<string, any>;
  message: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'agent';
  content: string;
  plan?: string;
  tokens_used?: number;
  execution_time_ms?: number;
  pending_approvals?: PendingApproval[];
  timestamp: string;
}

export interface Approval {
  id: string;
  workspace_id: string;
  agent_run_id: string;
  action_type: string;
  action_payload: string;
  risk_level: RiskLevel;
  status: ApprovalStatus;
  requested_by_agent: string;
  explanation?: string | null;
  reviewed_by_id?: string | null;
  reviewed_at?: string | null;
  rejection_reason?: string | null;
  created_at: string;
  reviewed_by?: User | null;
}

export interface AgentTelemetry {
  total_runs: number;
  total_tokens: number;
  estimated_cost: number;
  avg_execution_time_ms: number;
  pending_approvals_count: number;
}
