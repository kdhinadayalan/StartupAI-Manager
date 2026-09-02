import { apiClient } from './client';
import { TokenResponse, User, UserSession } from '../types/auth';

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  full_name: string;
}

export const authApi = {
  login: async (payload: LoginPayload): Promise<TokenResponse> => {
    const data = await apiClient.request<TokenResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    apiClient.setTokens({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
    });
    return data;
  },

  register: async (payload: RegisterPayload): Promise<User> => {
    return apiClient.request<User>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  getMe: async (): Promise<User> => {
    return apiClient.request<User>('/auth/me');
  },

  logout: async (): Promise<void> => {
    try {
      await apiClient.request('/auth/logout', { method: 'POST' });
    } finally {
      apiClient.setTokens(null);
    }
  },

  logoutAll: async (): Promise<void> => {
    try {
      await apiClient.request('/auth/logout-all', { method: 'POST' });
    } finally {
      apiClient.setTokens(null);
    }
  },

  getSessions: async (): Promise<UserSession[]> => {
    return apiClient.request<UserSession[]>('/auth/sessions');
  },

  revokeSession: async (jti: string): Promise<void> => {
    await apiClient.request(`/auth/sessions/${jti}`, { method: 'DELETE' });
  },
};
