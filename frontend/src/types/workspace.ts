import { Role, User } from './auth';

export interface Workspace {
  id: string;
  name: string;
  description?: string | null;
  industry?: string | null;
  stage?: string | null;
  website?: string | null;
  region?: string | null;
  currency: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: Role;
  joined_at: string;
  user?: User;
}

export interface WorkspaceCreatePayload {
  name: string;
  description?: string;
  industry?: string;
  stage?: string;
  website?: string;
  region?: string;
  currency?: string;
}

export interface MemberInvitePayload {
  email: string;
  role: Role;
}
