import { apiClient } from './client';
import { Project, ProjectMember, ProjectCreatePayload, ProjectStatus } from '../types/project';

export const projectApi = {
  list: async (workspaceId: string, status?: ProjectStatus, search?: string): Promise<Project[]> => {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (search) params.append('search', search);
    const queryString = params.toString() ? `?${params.toString()}` : '';
    return apiClient.request<Project[]>(`/workspaces/${workspaceId}/projects${queryString}`);
  },

  create: async (workspaceId: string, payload: ProjectCreatePayload): Promise<Project> => {
    return apiClient.request<Project>(`/workspaces/${workspaceId}/projects`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  get: async (workspaceId: string, projectId: string): Promise<Project> => {
    return apiClient.request<Project>(`/workspaces/${workspaceId}/projects/${projectId}`);
  },

  update: async (
    workspaceId: string,
    projectId: string,
    payload: Partial<ProjectCreatePayload>
  ): Promise<Project> => {
    return apiClient.request<Project>(`/workspaces/${workspaceId}/projects/${projectId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  delete: async (workspaceId: string, projectId: string): Promise<void> => {
    await apiClient.request(`/workspaces/${workspaceId}/projects/${projectId}`, {
      method: 'DELETE',
    });
  },

  getMembers: async (workspaceId: string, projectId: string): Promise<ProjectMember[]> => {
    return apiClient.request<ProjectMember[]>(`/workspaces/${workspaceId}/projects/${projectId}/members`);
  },

  assignMember: async (
    workspaceId: string,
    projectId: string,
    userId: string,
    role: string = 'MEMBER'
  ): Promise<ProjectMember> => {
    return apiClient.request<ProjectMember>(`/workspaces/${workspaceId}/projects/${projectId}/members`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, role }),
    });
  },

  removeMember: async (workspaceId: string, projectId: string, userId: string): Promise<void> => {
    await apiClient.request(`/workspaces/${workspaceId}/projects/${projectId}/members/${userId}`, {
      method: 'DELETE',
    });
  },
};
