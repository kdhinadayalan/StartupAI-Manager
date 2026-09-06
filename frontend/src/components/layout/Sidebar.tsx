import React from 'react';
import { NavLink } from 'react-router-dom';
import { useWorkspace } from '../../context/WorkspaceContext';
import { Role } from '../../types/auth';
import {
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  Bot,
  DollarSign,
  TrendingUp,
  Search,
  AlertTriangle,
  FileText,
  Settings,
  Users,
  Activity,
  Bell,
} from 'lucide-react';

interface NavItem {
  label: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  allowedRoles?: Role[];
}

const navItems: NavItem[] = [
  { label: 'Executive Health', to: '/dashboard', icon: LayoutDashboard },
  {
    label: 'AI Manager',
    to: '/ai-manager',
    icon: Bot,
    allowedRoles: ['OWNER', 'ADMIN', 'TEAM_LEAD', 'MANAGER', 'TEAM_MEMBER'],
  },
  {
    label: 'AI Monitoring',
    to: '/ai-monitoring',
    icon: Activity,
    allowedRoles: ['OWNER', 'ADMIN', 'MANAGER'],
  },
  { label: 'Notifications', to: '/notifications', icon: Bell },
  { label: 'Projects', to: '/projects', icon: FolderKanban },
  { label: 'Tasks & Kanban', to: '/tasks', icon: CheckSquare },
  {
    label: 'Finance & Burn',
    to: '/finance',
    icon: DollarSign,
    allowedRoles: ['OWNER', 'ADMIN', 'MANAGER'],
  },
  { label: 'Marketing', to: '/marketing', icon: TrendingUp },
  { label: 'Research', to: '/research', icon: Search },
  { label: 'Risks', to: '/risks', icon: AlertTriangle },
  { label: 'Reports', to: '/reports', icon: FileText },
  {
    label: 'Team',
    to: '/team',
    icon: Users,
    allowedRoles: ['OWNER', 'ADMIN', 'TEAM_LEAD'],
  },
  {
    label: 'Settings & Audit',
    to: '/settings',
    icon: Settings,
    allowedRoles: ['OWNER', 'ADMIN'],
  },
];

export const Sidebar: React.FC = () => {
  const { currentRole, currentWorkspace } = useWorkspace();

  const visibleNavItems = navItems.filter((item) => {
    if (!item.allowedRoles) return true;
    if (currentRole) {
      return item.allowedRoles.includes(currentRole);
    }
    // If workspace is active but role is still resolving, show member items
    if (currentWorkspace) {
      return item.allowedRoles.includes('TEAM_MEMBER');
    }
    return true;
  });

  return (
    <aside className="w-64 border-r border-slate-800 bg-slate-900/60 flex flex-col shrink-0 min-h-[calc(100vh-4rem)]">
      <div className="p-4 flex-1 space-y-1">
        <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider px-3 mb-2 flex items-center justify-between">
          <span>Operations</span>
          {currentRole && (
            <span className="text-[10px] text-slate-400 font-medium normal-case tracking-normal">
              {currentRole}
            </span>
          )}
        </div>
        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-brand-600/15 text-brand-400 border border-brand-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </div>

      <div className="p-4 border-t border-slate-800/80">
        <div className="rounded-lg bg-slate-800/50 p-3 border border-slate-700/40">
          <div className="flex items-center gap-2 text-xs font-semibold text-white">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            System Online
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Multi-Agent Core Ready</p>
        </div>
      </div>
    </aside>
  );
};
