import { apiClient } from './client';
import { ResearchItem, SwotMatrix, CompetitorIntelligence } from '../types/research';

export const researchApi = {
  getItems: async (workspaceId: string, topic?: string, competitor?: string): Promise<ResearchItem[]> => {
    const params = new URLSearchParams();
    if (topic) params.append('topic', topic);
    if (competitor) params.append('competitor', competitor);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return apiClient.request<ResearchItem[]>(`/workspaces/${workspaceId}/research/items${qs}`);
  },

  createItem: async (
    workspaceId: string,
    payload: {
      title: string;
      topic: string;
      source_name: string;
      source_url?: string;
      content: string;
      key_findings?: string;
      swot_category: string;
      competitor_name?: string;
    }
  ): Promise<ResearchItem> => {
    return apiClient.request<ResearchItem>(`/workspaces/${workspaceId}/research/items`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  getSwot: async (workspaceId: string): Promise<SwotMatrix> => {
    return apiClient.request<SwotMatrix>(`/workspaces/${workspaceId}/research/swot`);
  },

  getCompetitors: async (workspaceId: string): Promise<CompetitorIntelligence[]> => {
    return apiClient.request<CompetitorIntelligence[]>(`/workspaces/${workspaceId}/research/competitors`);
  },
};
