import { apiClient } from './client';
import { DashboardSummary } from '../types/dashboard';

export const dashboardApi = {
  getSummary: async (workspaceId: string): Promise<DashboardSummary> => {
    return apiClient.request<DashboardSummary>(`/workspaces/${workspaceId}/dashboard/summary`);
  },
};
