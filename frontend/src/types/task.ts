import { User } from './auth';

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface Task {
  id: string;
  workspace_id: string;
  project_id: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date?: string | null;
  estimated_hours?: number | null;
  actual_hours?: number | null;
  tags?: string | null;
  assignee_id?: string | null;
  created_by_id?: string | null;
  created_at: string;
  updated_at: string;
  assignee?: User | null;
  created_by?: User | null;
}

export interface TaskComment {
  id: string;
  workspace_id: string;
  task_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  user?: User;
}

export interface TaskHistory {
  id: string;
  workspace_id: string;
  task_id: string;
  user_id?: string | null;
  action: string;
  field_changed?: string | null;
  old_value?: string | null;
  new_value?: string | null;
  created_at: string;
  user?: User;
}

export interface TaskCreatePayload {
  project_id: string;
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  due_date?: string;
  estimated_hours?: number;
  actual_hours?: number;
  tags?: string;
  assignee_id?: string;
}
