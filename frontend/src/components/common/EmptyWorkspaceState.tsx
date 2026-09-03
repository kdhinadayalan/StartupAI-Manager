import React from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { Button } from './Button';
import { Card } from './Card';
import { Building2, Plus } from 'lucide-react';

interface EmptyWorkspaceStateProps {
  title?: string;
  description?: string;
}

export const EmptyWorkspaceState: React.FC<EmptyWorkspaceStateProps> = ({
  title = 'No Startup Workspace Active',
  description = 'You need an active startup workspace to access initiatives, tasks, financial runway, and AI agents.',
}) => {
  const { setIsCreateModalOpen, workspaces, selectWorkspace } = useWorkspace();

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <Card className="max-w-md w-full text-center p-8 border-slate-700/80 shadow-2xl bg-gradient-to-b from-slate-900 to-slate-900/90 relative overflow-hidden">
        <div className="absolute inset-0 bg-brand-500/5 pointer-events-none" />

        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-brand-600/20 to-indigo-500/20 border border-brand-500/30 flex items-center justify-center mx-auto mb-5 text-brand-400 shadow-xl shadow-brand-500/10">
          <Building2 className="w-8 h-8" />
        </div>

        <h2 className="text-xl font-bold text-white mb-2 tracking-tight">{title}</h2>
        <p className="text-xs sm:text-sm text-slate-400 mb-6 leading-relaxed max-w-sm mx-auto">
          {description}
        </p>

        <div className="flex flex-col gap-3">
          <Button
            variant="primary"
            size="md"
            className="w-full justify-center shadow-lg shadow-brand-600/25 py-2.5 text-sm"
            onClick={() => setIsCreateModalOpen(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Startup Workspace
          </Button>

          {workspaces.length > 0 && (
            <div className="pt-4 border-t border-slate-800">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                Or select an existing workspace:
              </span>
              <div className="flex flex-wrap justify-center gap-2 max-h-32 overflow-y-auto">
                {workspaces.map((ws) => (
                  <button
                    key={ws.id}
                    onClick={() => selectWorkspace(ws.id)}
                    className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 transition-colors"
                  >
                    {ws.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};
