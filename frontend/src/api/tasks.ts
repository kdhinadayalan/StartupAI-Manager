import { apiClient } from './client';
import {
  Task,
  TaskComment,
  TaskHistory,
  TaskCreatePayload,
  TaskStatus,
  TaskPriority,
} from '../types/task';

export const taskApi = {
  list: async (
    workspaceId: string,
    filters?: {
      project_id?: string;
      status?: TaskStatus;
      priority?: TaskPriority;
      assignee_id?: string;
      search?: string;
    }
  ): Promise<Task[]> => {
    const params = new URLSearchParams();
    if (filters?.project_id) params.append('project_id', filters.project_id);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.priority) params.append('priority', filters.priority);
    if (filters?.assignee_id) params.append('assignee_id', filters.assignee_id);
    if (filters?.search) params.append('search', filters.search);

    const qs = params.toString() ? `?${params.toString()}` : '';
    return apiClient.request<Task[]>(`/workspaces/${workspaceId}/tasks${qs}`);
  },

  create: async (workspaceId: string, payload: TaskCreatePayload): Promise<Task> => {
    return apiClient.request<Task>(`/workspaces/${workspaceId}/tasks`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  get: async (workspaceId: string, taskId: string): Promise<Task> => {
    return apiClient.request<Task>(`/workspaces/${workspaceId}/tasks/${taskId}`);
  },

  update: async (
    workspaceId: string,
    taskId: string,
    payload: Partial<TaskCreatePayload>
  ): Promise<Task> => {
    return apiClient.request<Task>(`/workspaces/${workspaceId}/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  updateStatus: async (
    workspaceId: string,
    taskId: string,
    status: TaskStatus
  ): Promise<Task> => {
    return apiClient.request<Task>(`/workspaces/${workspaceId}/tasks/${taskId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  delete: async (workspaceId: string, taskId: string): Promise<void> => {
    await apiClient.request(`/workspaces/${workspaceId}/tasks/${taskId}`, {
      method: 'DELETE',
    });
  },

  addComment: async (
    workspaceId: string,
    taskId: string,
    content: string
  ): Promise<TaskComment> => {
    return apiClient.request<TaskComment>(`/workspaces/${workspaceId}/tasks/${taskId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  },

  listComments: async (workspaceId: string, taskId: string): Promise<TaskComment[]> => {
    return apiClient.request<TaskComment[]>(`/workspaces/${workspaceId}/tasks/${taskId}/comments`);
  },

  deleteComment: async (
    workspaceId: string,
    taskId: string,
    commentId: string
  ): Promise<void> => {
    await apiClient.request(`/workspaces/${workspaceId}/tasks/${taskId}/comments/${commentId}`, {
      method: 'DELETE',
    });
  },

  getHistory: async (workspaceId: string, taskId: string): Promise<TaskHistory[]> => {
    return apiClient.request<TaskHistory[]>(`/workspaces/${workspaceId}/tasks/${taskId}/history`);
  },
};
