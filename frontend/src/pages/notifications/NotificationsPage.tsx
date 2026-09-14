import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkspace } from '../../context/WorkspaceContext';
import { notificationApi } from '../../api/notifications';
import { Notification } from '../../types/notification';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import {
  Bell,
  CheckCheck,
  CheckCircle2,
  AlertTriangle,
  Bot,
  DollarSign,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';

export const NotificationsPage: React.FC = () => {
  const { currentWorkspace } = useWorkspace();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadOnly, setUnreadOnly] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchNotifications = async () => {
    if (!currentWorkspace) return;
    setIsLoading(true);
    try {
      const list = await notificationApi.getNotifications(currentWorkspace.id, unreadOnly);
      setNotifications(list);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [currentWorkspace?.id, unreadOnly]);

  const handleMarkRead = async (id: string) => {
    if (!currentWorkspace) return;
    try {
      await notificationApi.markRead(currentWorkspace.id, id);
      fetchNotifications();
    } catch (err) {
      console.error('Error marking notification read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    if (!currentWorkspace) return;
    try {
      await notificationApi.markAllRead(currentWorkspace.id);
      fetchNotifications();
    } catch (err) {
      console.error('Error marking all read:', err);
    }
  };

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case 'CRITICAL':
        return <Badge variant="danger">CRITICAL</Badge>;
      case 'WARNING':
        return <Badge variant="warning">WARNING</Badge>;
      default:
        return <Badge variant="neutral">INFO</Badge>;
    }
  };

  const getIcon = (type: string, severity: string) => {
    if (severity === 'CRITICAL' || type === 'RISK_ALERT') {
      return <AlertTriangle className="w-4 h-4 text-red-400" />;
    }
    if (type === 'AI_APPROVAL_PENDING') {
      return <Bot className="w-4 h-4 text-brand-400" />;
    }
    if (type === 'BUDGET_OVERRUN') {
      return <DollarSign className="w-4 h-4 text-amber-400" />;
    }
    return <CheckCircle2 className="w-4 h-4 text-sky-400" />;
  };

  if (!currentWorkspace) {
    return (
      <div className="text-center py-12 text-slate-400 text-sm">
        Please select or create a startup workspace first.
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Bell className="w-5 h-5 text-brand-500 dark:text-brand-400" />
            Notifications & User Alerts
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Real-time notifications for AI approvals, critical risks, budget overruns, and task assignments.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={fetchNotifications} isLoading={isLoading}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh
          </Button>
          <Button variant="secondary" size="sm" onClick={handleMarkAllRead}>
            <CheckCheck className="w-3.5 h-3.5 mr-1.5" /> Mark All Read
          </Button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <button
          onClick={() => setUnreadOnly(false)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            !unreadOnly
              ? 'bg-brand-50 dark:bg-brand-600/15 text-brand-600 dark:text-brand-400 border border-brand-200 dark:border-brand-500/30'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          All Notifications
        </button>
        <button
          onClick={() => setUnreadOnly(true)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            unreadOnly
              ? 'bg-brand-50 dark:bg-brand-600/15 text-brand-600 dark:text-brand-400 border border-brand-200 dark:border-brand-500/30'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          Unread Only
        </button>
      </div>

      {/* Notifications List */}
      <Card title="Alert Feed" subtitle={`${notifications.length} alerts in feed`}>
        {notifications.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-xs">
            No notifications to display.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {notifications.map((n) => (
              <div
                key={n.id}
                className={`py-3.5 px-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                  !n.is_read ? 'bg-slate-50/70 dark:bg-slate-800/20' : 'opacity-70'
                }`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 mt-0.5">
                    {getIcon(n.type, n.severity)}
                  </div>
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-900 dark:text-white text-xs">{n.title}</span>
                      {getSeverityBadge(n.severity)}
                      {!n.is_read && (
                        <span className="w-2 h-2 rounded-full bg-brand-500 dark:bg-brand-400" title="Unread" />
                      )}
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300">{n.message}</p>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 block">
                      {new Date(n.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  {n.link && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (!n.is_read) handleMarkRead(n.id);
                        navigate(n.link!);
                      }}
                      className="text-xs text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300"
                    >
                      Inspect <ExternalLink className="w-3 h-3 ml-1" />
                    </Button>
                  )}
                  {!n.is_read && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleMarkRead(n.id)}
                      title="Mark as read"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};
