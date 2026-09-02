import { apiClient } from './client';
import { AIMonitoringTelemetry } from '../types/monitoring';

export const monitoringApi = {
  getTelemetry: async (workspaceId: string, days?: number): Promise<AIMonitoringTelemetry> => {
    const qs = days !== undefined ? `?days=${days}` : '';
    return apiClient.request<AIMonitoringTelemetry>(`/workspaces/${workspaceId}/ai/monitoring${qs}`);
  },
};
