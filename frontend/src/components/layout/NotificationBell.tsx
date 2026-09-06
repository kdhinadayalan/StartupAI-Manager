import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useWorkspace } from '../../context/WorkspaceContext';
import { notificationApi } from '../../api/notifications';
import { Notification } from '../../types/notification';
import {
  Bell,
  CheckCheck,
  AlertTriangle,
  Bot,
  DollarSign,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';

export const NotificationBell: React.FC = () => {
  const { currentWorkspace } = useWorkspace();
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [recentNotifications, setRecentNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchUnread = async () => {
    if (!currentWorkspace) return;
    try {
      const [count, list] = await Promise.all([
        notificationApi.getUnreadCount(currentWorkspace.id),
        notificationApi.getNotifications(currentWorkspace.id, true),
      ]);
      setUnreadCount(count);
      setRecentNotifications(list.slice(0, 5));
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  };

  useEffect(() => {
    fetchUnread();
  }, [currentWorkspace?.id]);

  // Close dropdown on any route change
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname, location.search]);

  // Close dropdown on click outside or Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleMarkAllRead = async () => {
    if (!currentWorkspace) return;
    try {
      await notificationApi.markAllRead(currentWorkspace.id);
      setUnreadCount(0);
      setRecentNotifications([]);
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const handleNotificationClick = async (item: Notification) => {
    if (!currentWorkspace) return;
    try {
      if (!item.is_read) {
        await notificationApi.markRead(currentWorkspace.id, item.id);
        fetchUnread();
      }
      setIsOpen(false);
      if (item.link) {
        navigate(item.link);
      }
    } catch (err) {
      console.error('Error handling notification click:', err);
    }
  };

  const getNotificationIcon = (type: string, severity: string) => {
    if (severity === 'CRITICAL' || type === 'RISK_ALERT') {
      return <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />;
    }
    if (type === 'AI_APPROVAL_PENDING') {
      return <Bot className="w-4 h-4 text-brand-400 shrink-0 mt-0.5" />;
    }
    if (type === 'BUDGET_OVERRUN') {
      return <DollarSign className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />;
    }
    return <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />;
  };

  if (!currentWorkspace) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        title="Notifications"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-slate-900">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="p-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
            <div className="flex items-center gap-2">
              <span className="font-bold text-white text-xs">Notifications</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded bg-brand-500/10 text-brand-400 text-[10px] font-semibold border border-brand-500/20">
                  {unreadCount} unread
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-[11px] text-slate-400 hover:text-brand-400 flex items-center gap-1 transition-colors"
              >
                <CheckCheck className="w-3.5 h-3.5" /> Mark all read
              </button>
            )}
          </div>

          {/* List of Alerts */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/60">
            {recentNotifications.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                No unread notifications. You're all caught up!
              </div>
            ) : (
              recentNotifications.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleNotificationClick(item)}
                  className="p-3 hover:bg-slate-800/40 cursor-pointer transition-colors flex items-start gap-3"
                >
                  {getNotificationIcon(item.type, item.severity)}
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-semibold text-white text-xs truncate">
                        {item.title}
                      </span>
                      <span className="text-[10px] text-slate-500 shrink-0">
                        {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-2">{item.message}</p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-2.5 bg-slate-950/60 border-t border-slate-800 text-center">
            <button
              onClick={() => {
                setIsOpen(false);
                navigate('/notifications');
              }}
              className="text-xs text-brand-400 hover:text-brand-300 font-medium inline-flex items-center gap-1 transition-colors"
            >
              View all notifications <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
