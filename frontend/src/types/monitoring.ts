export interface ToolUsageStat {
  tool_name: string;
  call_count: number;
  error_count: number;
  error_rate_percent: number;
}

export interface ExecutionTrace {
  id: string;
  agent_name: string;
  query_snippet: string;
  status: string;
  tokens_used: number;
  execution_time_ms: number;
  cost_estimate: number;
  created_at: string;
}

export interface AIMonitoringTelemetry {
  time_window_days?: number | null;
  total_runs: number;
  total_tokens: number;
  estimated_cost: number;
  avg_execution_time_ms: number;
  pending_approvals_count: number;
  latency?: {
    avg_ms: number;
    min_ms: number;
    max_ms: number;
  };
  status_distribution?: {
    success: number;
    awaiting_approval: number;
    error: number;
  };
  tool_usage?: ToolUsageStat[];
  recent_executions?: ExecutionTrace[];
}
