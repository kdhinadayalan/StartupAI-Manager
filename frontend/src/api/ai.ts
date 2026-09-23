import { apiClient } from './client';
import { Approval, AgentTelemetry } from '../types/ai';

export interface ChatResponsePayload {
  run_id: string;
  conversation_id: string;
  status: string;
  plan?: string;
  response: string;
  tool_calls_count: number;
  pending_approvals: Array<{
    approval_id: string;
    risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
    action: string;
    payload: Record<string, any>;
    message: string;
  }>;
  tokens_used: number;
  execution_time_ms: number;
}

export interface WorkspaceAISettingsResponse {
  workspace_id: string;
  provider: 'GEMINI' | 'OPENAI' | 'OLLAMA' | 'MOCK' | 'CUSTOM' | string;
  model_name: string;
  has_custom_api_key: boolean;
  masked_api_key?: string | null;
  ollama_base_url: string;
  custom_base_url?: string | null;
  temperature: number;
  pii_masking_enabled: boolean;
  updated_at?: string;
}

export interface WorkspaceAISettingsUpdate {
  provider?: string;
  model_name?: string;
  api_key?: string;
  ollama_base_url?: string;
  custom_base_url?: string;
  temperature?: number;
  pii_masking_enabled?: boolean;
}

export interface TestAIConnectionRequest {
  provider: string;
  model_name?: string;
  api_key?: string;
  ollama_base_url?: string;
  custom_base_url?: string;
}

export interface TestAIConnectionResponse {
  status: 'connected' | 'error';
  latency_ms: number;
  provider: string;
  model_name: string;
  message: string;
  details?: Record<string, any>;
}

export const aiApi = {
  chat: async (
    workspaceId: string,
    message: string,
    conversationId?: string
  ): Promise<ChatResponsePayload> => {
    return apiClient.request<ChatResponsePayload>(`/workspaces/${workspaceId}/ai/chat`, {
      method: 'POST',
      body: JSON.stringify({
        message,
        conversation_id: conversationId,
      }),
    });
  },

  getApprovals: async (
    workspaceId: string,
    status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXECUTED'
  ): Promise<Approval[]> => {
    const qs = status ? `?status=${status}` : '';
    return apiClient.request<Approval[]>(`/workspaces/${workspaceId}/ai/approvals${qs}`);
  },

  approve: async (workspaceId: string, approvalId: string): Promise<any> => {
    return apiClient.request(`/workspaces/${workspaceId}/ai/approvals/${approvalId}/approve`, {
      method: 'POST',
    });
  },

  reject: async (workspaceId: string, approvalId: string, reason?: string): Promise<any> => {
    return apiClient.request(`/workspaces/${workspaceId}/ai/approvals/${approvalId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  getMonitoring: async (workspaceId: string): Promise<AgentTelemetry> => {
    return apiClient.request<AgentTelemetry>(`/workspaces/${workspaceId}/ai/monitoring`);
  },

  getSettings: async (workspaceId: string): Promise<WorkspaceAISettingsResponse> => {
    return apiClient.request<WorkspaceAISettingsResponse>(`/workspaces/${workspaceId}/ai/settings`);
  },

  updateSettings: async (
    workspaceId: string,
    data: WorkspaceAISettingsUpdate
  ): Promise<WorkspaceAISettingsResponse> => {
    return apiClient.request<WorkspaceAISettingsResponse>(`/workspaces/${workspaceId}/ai/settings`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  testConnection: async (
    workspaceId: string,
    data: TestAIConnectionRequest
  ): Promise<TestAIConnectionResponse> => {
    return apiClient.request<TestAIConnectionResponse>(
      `/workspaces/${workspaceId}/ai/settings/test-connection`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
  },
};

