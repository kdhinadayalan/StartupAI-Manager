import { User } from './auth';

export type ProjectStatus = 'PLANNING' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'ARCHIVED';

export interface Project {
  id: string;
  workspace_id: string;
  name: string;
  description?: string | null;
  status: ProjectStatus;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  deadline?: string | null;
  budget?: number | null;
  owner_id?: string | null;
  created_by_id?: string | null;
  created_at: string;
  updated_at: string;
  owner?: User | null;
  created_by?: User | null;
}

export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role: string;
  joined_at: string;
  user?: User;
}

export interface ProjectCreatePayload {
  name: string;
  description?: string;
  status?: ProjectStatus;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  deadline?: string;
  budget?: number;
  owner_id?: string;
}
