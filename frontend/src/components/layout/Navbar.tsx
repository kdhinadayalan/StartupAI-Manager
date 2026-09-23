import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSidebar } from '../../context/SidebarContext';
import { Button } from '../common/Button';
import { ThemeToggle } from '../common/ThemeToggle';
import { WorkspaceSelector } from './WorkspaceSelector';
import { NotificationBell } from './NotificationBell';
import { Link } from 'react-router-dom';
import { Avatar } from '../common/Avatar';
import { LogOut, Sparkles, ShieldCheck, Menu } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const { toggleOpen } = useSidebar();

  return (
    <header className="h-16 border-b border-slate-200 dark:border-[#2d2d2d] bg-white/95 dark:bg-[#1e1e1e]/95 backdrop-blur px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 transition-colors duration-150">
      <div className="flex items-center gap-3 sm:gap-6">
        {/* Mobile / Desktop Hamburger Menu Trigger */}
        <button
          onClick={toggleOpen}
          aria-label="Toggle navigation drawer"
          className="p-2 -ml-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-[#9da7b3] dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#2a2d2e] transition-colors focus:outline-none focus:ring-2 focus:ring-[#007acc]/40"
          title="Toggle Navigation Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Startup Brand Logo & Icon */}
        <div className="flex items-center gap-2.5 select-none">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center text-white font-bold shadow-md shadow-brand-500/20">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div className="hidden xs:block">
            <span className="font-bold text-slate-900 dark:text-white text-base tracking-tight">
              StartupAI
            </span>
            <span className="text-brand-600 dark:text-brand-400 font-semibold text-xs ml-1.5 px-2 py-0.5 rounded bg-brand-500/10 border border-brand-500/20">
              Manager
            </span>
          </div>
        </div>

        <WorkspaceSelector />
      </div>

      <div className="flex items-center gap-3">
        <ThemeToggle />
        <NotificationBell />

        {user && (
          <div className="flex items-center gap-3 pl-3 border-l border-slate-200 dark:border-[#2d2d2d]">
            <Link
              to="/settings"
              className="flex items-center gap-2.5 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-[#2a2d2e] transition-colors group"
              title="View & Edit Profile"
            >
              <Avatar
                src={user.avatar_url}
                name={user.full_name}
                size="sm"
                showStatus
                status="online"
              />
              <div className="hidden sm:block text-left">
                <div className="text-xs font-semibold text-slate-900 dark:text-white leading-none group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                  {user.full_name}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-500 dark:text-emerald-400" />
                  {user.email}
                </div>
              </div>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              className="text-slate-500 hover:text-red-500 dark:text-slate-400 dark:hover:text-red-400 ml-1"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </header>
  );
};
