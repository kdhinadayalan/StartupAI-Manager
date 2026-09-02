export type NotificationSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export interface Notification {
  id: string;
  workspace_id: string;
  user_id?: string | null;
  type: string;
  severity: NotificationSeverity;
  title: string;
  message: string;
  link?: string | null;
  resource_type?: string | null;
  resource_id?: string | null;
  is_read: boolean;
  created_at: string;
}
