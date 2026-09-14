import React from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { Badge } from '../common/Badge';
import { Building2 } from 'lucide-react';

export const WorkspaceSelector: React.FC = () => {
  const { currentWorkspace, currentRole } = useWorkspace();

  if (!currentWorkspace) {
    return null;
  }

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'OWNER':
        return 'primary';
      case 'ADMIN':
        return 'warning';
      case 'TEAM_LEAD':
        return 'info';
      case 'MANAGER':
        return 'success';
      default:
        return 'neutral';
    }
  };

  return (
    <div
      data-testid="single-company-indicator"
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-xs font-medium text-slate-700 dark:text-slate-200 shadow-sm transition-colors duration-150"
    >
      <Building2 className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400 shrink-0" />
      <span className="font-semibold text-slate-900 dark:text-white max-w-[160px] truncate" title={currentWorkspace.name}>
        {currentWorkspace.name}
      </span>
      {currentRole && (
        <Badge
          variant={getRoleBadgeVariant(currentRole)}
          className="text-[10px] py-0.5 px-2 ml-1 tracking-wide font-semibold"
        >
          {currentRole}
        </Badge>
      )}
    </div>
  );
};
