import React, { useEffect } from 'react';
import { Outlet, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { Role } from '../../types/auth';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { CreateWorkspaceModal } from './CreateWorkspaceModal';

// Route-level RBAC requirements based on backend permissions
export const ROUTE_ROLE_REQUIREMENTS: Record<string, Role[]> = {
  '/settings': ['OWNER', 'ADMIN'],
  '/ai-monitoring': ['OWNER', 'ADMIN', 'MANAGER'],
  '/ai-manager': ['OWNER', 'ADMIN', 'TEAM_LEAD', 'MANAGER', 'TEAM_MEMBER'],
  '/finance': ['OWNER', 'ADMIN', 'MANAGER'],
  '/team': ['OWNER', 'ADMIN', 'TEAM_LEAD'],
};

export const AppLayout: React.FC = () => {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const { currentRole, currentWorkspace, isLoading: isWorkspaceLoading } = useWorkspace();
  const location = useLocation();
  const navigate = useNavigate();

  // Gracefully redirect user to /dashboard if their role in the currently active workspace
  // does not permit accessing the current route.
  useEffect(() => {
    if (isWorkspaceLoading || !currentWorkspace || !currentRole) return;

    const allowedRoles = ROUTE_ROLE_REQUIREMENTS[location.pathname];
    if (allowedRoles && !allowedRoles.includes(currentRole)) {
      navigate('/dashboard', { replace: true });
    }
  }, [location.pathname, currentRole, currentWorkspace?.id, isWorkspaceLoading, navigate]);

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin h-8 w-8 text-brand-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-sm font-medium">Verifying security session...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 transition-colors duration-150">
      <Navbar />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-6 bg-slate-100/60 dark:bg-slate-900/50">
          <Outlet />
        </main>
      </div>
      <CreateWorkspaceModal />
    </div>
  );
};
