import { apiClient } from './client';
import { MarketingCampaign, MarketingPerformance } from '../types/marketing';

export const marketingApi = {
  getCampaigns: async (workspaceId: string, status?: string): Promise<MarketingCampaign[]> => {
    const qs = status ? `?status=${status}` : '';
    return apiClient.request<MarketingCampaign[]>(`/workspaces/${workspaceId}/marketing/campaigns${qs}`);
  },

  createCampaign: async (
    workspaceId: string,
    payload: { name: string; channel: string; budget: number; target_audience?: string; goals?: string }
  ): Promise<MarketingCampaign> => {
    return apiClient.request<MarketingCampaign>(`/workspaces/${workspaceId}/marketing/campaigns`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateMetrics: async (
    workspaceId: string,
    campaignId: string,
    metrics: { spend?: number; impressions?: number; clicks?: number; conversions?: number }
  ): Promise<MarketingCampaign> => {
    return apiClient.request<MarketingCampaign>(`/workspaces/${workspaceId}/marketing/campaigns/${campaignId}/metrics`, {
      method: 'PATCH',
      body: JSON.stringify(metrics),
    });
  },

  modifyBudget: async (
    workspaceId: string,
    campaignId: string,
    budget: number
  ): Promise<MarketingCampaign> => {
    return apiClient.request<MarketingCampaign>(`/workspaces/${workspaceId}/marketing/campaigns/${campaignId}/budget`, {
      method: 'PATCH',
      body: JSON.stringify({ budget }),
    });
  },

  getPerformance: async (workspaceId: string): Promise<MarketingPerformance> => {
    return apiClient.request<MarketingPerformance>(`/workspaces/${workspaceId}/marketing/performance`);
  },
};
