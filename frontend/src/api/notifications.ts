import { apiClient } from './client';
import { Notification } from '../types/notification';

export const notificationApi = {
  getNotifications: async (workspaceId: string, unreadOnly?: boolean): Promise<Notification[]> => {
    const qs = unreadOnly ? '?unread_only=true' : '';
    return apiClient.request<Notification[]>(`/workspaces/${workspaceId}/notifications${qs}`);
  },

  getUnreadCount: async (workspaceId: string): Promise<number> => {
    const res = await apiClient.request<{ unread_count: number }>(`/workspaces/${workspaceId}/notifications/unread-count`);
    return res.unread_count;
  },

  markRead: async (workspaceId: string, notificationId: string): Promise<Notification> => {
    return apiClient.request<Notification>(`/workspaces/${workspaceId}/notifications/${notificationId}/read`, {
      method: 'PATCH',
    });
  },

  markAllRead: async (workspaceId: string): Promise<{ marked_count: number }> => {
    return apiClient.request<{ marked_count: number }>(`/workspaces/${workspaceId}/notifications/read-all`, {
      method: 'POST',
    });
  },
};
