export type Role = 'OWNER' | 'ADMIN' | 'MANAGER' | 'TEAM_MEMBER' | 'VIEWER';

export interface User {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string | null;
  is_active: boolean;
  is_superuser: boolean;
  created_at: string;
  updated_at: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

export interface UserSession {
  id: string;
  token_jti: string;
  ip_address?: string | null;
  user_agent?: string | null;
  is_revoked: boolean;
  revoked_at?: string | null;
  expires_at: string;
  created_at: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  correlation_id?: string;
}
