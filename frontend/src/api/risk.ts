import { apiClient } from './client';
import { RiskItem, RiskScanSignal } from '../types/risk';

export const riskApi = {
  getRisks: async (workspaceId: string, category?: string, severity?: string): Promise<RiskItem[]> => {
    const params = new URLSearchParams();
    if (category) params.append('category', category);
    if (severity) params.append('severity', severity);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return apiClient.request<RiskItem[]>(`/workspaces/${workspaceId}/risks${qs}`);
  },

  createRisk: async (
    workspaceId: string,
    payload: {
      title: string;
      category: string;
      likelihood: number;
      impact: number;
      description?: string;
      mitigation_plan?: string;
    }
  ): Promise<RiskItem> => {
    return apiClient.request<RiskItem>(`/workspaces/${workspaceId}/risks`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateStatus: async (
    workspaceId: string,
    riskId: string,
    status: string,
    mitigationPlan?: string
  ): Promise<RiskItem> => {
    return apiClient.request<RiskItem>(`/workspaces/${workspaceId}/risks/${riskId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, mitigation_plan: mitigationPlan }),
    });
  },

  scanRisks: async (workspaceId: string): Promise<RiskScanSignal[]> => {
    return apiClient.request<RiskScanSignal[]>(`/workspaces/${workspaceId}/risks/scan`);
  },
};
