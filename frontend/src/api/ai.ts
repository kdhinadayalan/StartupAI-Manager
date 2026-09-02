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
};
