import { ApiResponse, TokenResponse } from '../types/auth';

const API_BASE = '/api/v1';

class ApiClient {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private isRefreshing = false;
  private refreshSubscribers: ((token: string) => void)[] = [];

  constructor() {
    this.accessToken = localStorage.getItem('access_token');
    this.refreshToken = localStorage.getItem('refresh_token');
  }

  public setTokens(tokens: { access_token: string; refresh_token: string } | null) {
    if (tokens) {
      this.accessToken = tokens.access_token;
      this.refreshToken = tokens.refresh_token;
      localStorage.setItem('access_token', tokens.access_token);
      localStorage.setItem('refresh_token', tokens.refresh_token);
    } else {
      this.accessToken = null;
      this.refreshToken = null;
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
    }
  }

  public getAccessToken(): string | null {
    return this.accessToken;
  }

  private onRefreshed(token: string) {
    this.refreshSubscribers.forEach((callback) => callback(token));
    this.refreshSubscribers = [];
  }

  private addRefreshSubscriber(callback: (token: string) => void) {
    this.refreshSubscribers.push(callback);
  }

  public async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    // If unauthorized, attempt refresh token rotation once
    if (response.status === 401 && this.refreshToken && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/refresh')) {
      if (!this.isRefreshing) {
        this.isRefreshing = true;
        try {
          const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: this.refreshToken }),
          });

          if (refreshRes.ok) {
            const refreshData: ApiResponse<TokenResponse> = await refreshRes.json();
            if (refreshData.data) {
              this.setTokens({
                access_token: refreshData.data.access_token,
                refresh_token: refreshData.data.refresh_token,
              });
              this.onRefreshed(refreshData.data.access_token);
            }
          } else {
            // Refresh token revoked or invalid
            this.setTokens(null);
            window.location.href = '/login';
            throw new Error('Session has expired. Please sign in again.');
          }
        } finally {
          this.isRefreshing = false;
        }
      }

      // Retry original request with renewed access token
      return new Promise<T>((resolve) => {
        this.addRefreshSubscriber((newToken: string) => {
          headers['Authorization'] = `Bearer ${newToken}`;
          resolve(this.request<T>(endpoint, { ...options, headers }));
        });
      });
    }

    const data: ApiResponse<T> = await response.json();

    if (!response.ok || data.success === false) {
      const errorMessage = data.error?.message || response.statusText || 'An unexpected error occurred';
      throw new Error(errorMessage);
    }

    return (data.data !== undefined ? data.data : (data as unknown)) as T;
  }
}

export const apiClient = new ApiClient();
