import React from 'react';
import { NavLink } from 'react-router-dom';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useSidebar } from '../../context/SidebarContext';
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
  ChevronRight,
  X,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';

interface NavItem {
  label: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  allowedRoles?: Role[];
}

interface NavGroup {
  groupTitle: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    groupTitle: 'OPERATIONS',
    items: [
      { label: 'Executive Health', to: '/dashboard', icon: LayoutDashboard },
      { label: 'Projects', to: '/projects', icon: FolderKanban },
      { label: 'Tasks & Kanban', to: '/tasks', icon: CheckSquare },
      { label: 'Notifications', to: '/notifications', icon: Bell },
      { label: 'Reports', to: '/reports', icon: FileText },
    ],
  },
  {
    groupTitle: 'AUTONOMOUS AI',
    items: [
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
    ],
  },
  {
    groupTitle: 'STRATEGY & GOVERNANCE',
    items: [
      {
        label: 'Finance & Burn',
        to: '/finance',
        icon: DollarSign,
        allowedRoles: ['OWNER', 'ADMIN', 'MANAGER'],
      },
      { label: 'Marketing', to: '/marketing', icon: TrendingUp },
      { label: 'Research', to: '/research', icon: Search },
      { label: 'Risks', to: '/risks', icon: AlertTriangle },
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
      },
    ],
  },
];

export const Sidebar: React.FC = () => {
  const { currentRole, currentWorkspace } = useWorkspace();
  const { isOpen, setIsOpen, toggleOpen } = useSidebar();

  const isRolePermitted = (allowedRoles?: Role[]) => {
    if (!allowedRoles) return true;
    if (currentRole) return allowedRoles.includes(currentRole);
    if (currentWorkspace) return allowedRoles.includes('TEAM_MEMBER');
    return true;
  };

  const handleNavClick = () => {
    if (window.innerWidth < 1024) {
      setIsOpen(false);
    }
  };

  return (
    <>
      {/* Mobile/Tablet Backdrop Overlay with subtle blur */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-200 lg:hidden ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsOpen(false)}
        aria-hidden="true"
      />

      {/* Slide-over Drawer / Collapsible Desktop Sidebar */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex flex-col transition-all duration-200 ease-in-out
          bg-[#f8fafc] border-[#e2e8f0] text-[#0f172a]
          dark:bg-[#181818] dark:border-[#2d2d2d] dark:text-[#e6edf3]
          lg:static lg:z-auto lg:h-full shrink-0 border-r overflow-hidden
          ${
            isOpen
              ? 'w-[270px] lg:w-[260px] translate-x-0 opacity-100 shadow-2xl lg:shadow-none'
              : 'w-0 -translate-x-full opacity-0 pointer-events-none lg:w-16 lg:translate-x-0 lg:opacity-100 lg:pointer-events-auto'
          }`}
      >
        {/* Upper Header Branding Area */}
        <div className="h-16 px-3 flex items-center justify-between border-b border-[#e2e8f0] dark:border-[#2d2d2d] shrink-0">
          <div className={`flex items-center gap-3 overflow-hidden select-none ${!isOpen ? 'w-full justify-center' : ''}`}>
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shrink-0 shadow-sm shadow-blue-500/20">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            {isOpen && (
              <div className="min-w-0 flex-1">
                <div className="font-bold text-sm tracking-tight text-[#0f172a] dark:text-white leading-none truncate">
                  StartupAI
                </div>
                <div className="text-[10px] font-semibold text-[#007acc] dark:text-[#388bfd] mt-0.5 tracking-wider uppercase truncate">
                  Operating System
                </div>
              </div>
            )}
          </div>

          {/* Close button (when expanded) */}
          {isOpen && (
            <button
              onClick={toggleOpen}
              aria-label="Collapse navigation drawer"
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 dark:text-[#9da7b3] dark:hover:text-white dark:hover:bg-[#2a2d2e] transition-colors"
              title="Collapse navigation"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Scrollable Navigation Body with independent scrolling */}
        <div className="flex-1 overflow-y-auto overscroll-contain py-3 px-2 space-y-4 custom-scrollbar">
          {NAV_GROUPS.map((group) => {
            const visibleItems = group.items.filter((item) => isRolePermitted(item.allowedRoles));
            if (visibleItems.length === 0) return null;

            return (
              <div key={group.groupTitle} className="space-y-1">
                {/* Tracked-out uppercase group label when open, or subtle divider when collapsed */}
                {isOpen ? (
                  <div className="px-3 text-[10px] font-bold tracking-wider uppercase text-slate-500 dark:text-[#9da7b3] select-none truncate">
                    {group.groupTitle}
                  </div>
                ) : (
                  <div className="h-px bg-slate-200 dark:bg-[#2d2d2d] my-2 mx-1" />
                )}

                {visibleItems.map((item) => {
                  const Icon = item.icon;

                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={() => {
                        handleNavClick();
                        if (!isOpen) {
                          setIsOpen(true);
                        }
                      }}
                      title={!isOpen ? item.label : undefined}
                      className={({ isActive }) =>
                        `group relative flex items-center h-10 rounded-lg text-xs font-medium transition-all duration-150 outline-none
                        ${isOpen ? 'px-3' : 'justify-center w-10 mx-auto'}
                        ${
                          isActive
                            ? 'text-[#007acc] bg-[#007acc]/10 font-semibold dark:text-[#388bfd] dark:bg-[#388bfd]/15'
                            : 'text-slate-600 hover:text-[#0f172a] hover:bg-slate-200/60 dark:text-[#9da7b3] dark:hover:text-white dark:hover:bg-[#2a2d2e]'
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          {/* Active state indicator */}
                          {isActive && (
                            <span className={`absolute left-0 top-1/2 -translate-y-1/2 rounded-r-full bg-[#007acc] dark:bg-[#388bfd] ${isOpen ? 'w-1 h-5' : 'w-1 h-4'}`} />
                          )}

                          {/* Item Icon */}
                          <Icon
                            className={`w-4 h-4 shrink-0 transition-transform duration-150 group-hover:scale-110 ${
                              isOpen ? 'mr-3' : ''
                            } ${
                              isActive
                                ? 'text-[#007acc] dark:text-[#388bfd]'
                                : 'text-slate-500 group-hover:text-[#0f172a] dark:text-[#9da7b3] dark:group-hover:text-white'
                            }`}
                          />

                          {/* Label Text and Right Chevron (only shown when expanded) */}
                          {isOpen && (
                            <>
                              <span className="truncate flex-1 font-medium">{item.label}</span>
                              <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-0 group-hover:opacity-100 transition-opacity duration-150 text-slate-400 dark:text-[#9da7b3]" />
                            </>
                          )}
                        </>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Sticky Footer: System Badge & Role Metadata */}
        <div className="p-3 border-t border-[#e2e8f0] dark:border-[#2d2d2d] shrink-0 bg-[#f8fafc] dark:bg-[#181818]">
          {isOpen ? (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-white dark:bg-[#252526] border border-[#e2e8f0] dark:border-[#2d2d2d]">
              {/* Live pulsing green system dot */}
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider truncate">
                    System Online
                  </span>
                  {currentRole && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-600 dark:bg-sky-500/20 dark:text-sky-400">
                      {currentRole}
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-sky-500 shrink-0" />
                  <span className="truncate">{currentWorkspace?.name || 'Workspace'}</span>
                </div>
              </div>
            </div>
          ) : (
            <div
              className="w-full flex items-center justify-center p-2 select-none"
              title="System Online"
            >
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
