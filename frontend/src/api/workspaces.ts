import { apiClient } from './client';
import { Workspace, WorkspaceMember, WorkspaceCreatePayload, MemberInvitePayload } from '../types/workspace';
import { Role } from '../types/auth';

export const workspaceApi = {
  list: async (): Promise<Workspace[]> => {
    return apiClient.request<Workspace[]>('/workspaces');
  },

  create: async (payload: WorkspaceCreatePayload): Promise<Workspace> => {
    return apiClient.request<Workspace>('/workspaces', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  get: async (workspaceId: string): Promise<Workspace> => {
    return apiClient.request<Workspace>(`/workspaces/${workspaceId}`);
  },

  update: async (workspaceId: string, payload: Partial<WorkspaceCreatePayload>): Promise<Workspace> => {
    return apiClient.request<Workspace>(`/workspaces/${workspaceId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  delete: async (workspaceId: string): Promise<void> => {
    await apiClient.request(`/workspaces/${workspaceId}`, {
      method: 'DELETE',
    });
  },

  getMembers: async (workspaceId: string): Promise<WorkspaceMember[]> => {
    return apiClient.request<WorkspaceMember[]>(`/workspaces/${workspaceId}/members`);
  },

  inviteMember: async (workspaceId: string, payload: MemberInvitePayload): Promise<WorkspaceMember> => {
    return apiClient.request<WorkspaceMember>(`/workspaces/${workspaceId}/members`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateMemberRole: async (workspaceId: string, memberId: string, role: Role): Promise<WorkspaceMember> => {
    return apiClient.request<WorkspaceMember>(`/workspaces/${workspaceId}/members/${memberId}`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
  },

  removeMember: async (workspaceId: string, memberId: string): Promise<void> => {
    await apiClient.request(`/workspaces/${workspaceId}/members/${memberId}`, {
      method: 'DELETE',
    });
  },
};
