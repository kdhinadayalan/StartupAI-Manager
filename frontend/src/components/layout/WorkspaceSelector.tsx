import React, { useState } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { Briefcase, ChevronDown, Plus } from 'lucide-react';

export const WorkspaceSelector: React.FC = () => {
  const { currentWorkspace, workspaces, selectWorkspace, currentRole, setIsCreateModalOpen } = useWorkspace();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 text-xs font-medium text-slate-200 transition-colors"
      >
        <Briefcase className="w-3.5 h-3.5 text-brand-400" />
        <span className="font-semibold text-white max-w-[140px] truncate">
          {currentWorkspace ? currentWorkspace.name : 'Select Startup'}
        </span>
        {currentRole && (
          <Badge variant="primary" className="text-[10px] py-0 px-1.5 ml-1">
            {currentRole}
          </Badge>
        )}
        <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-1" />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-2 w-64 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl py-1 z-50 animate-in fade-in duration-150">
          <div className="px-3 py-2 border-b border-slate-700/60 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Your Workspaces
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            {workspaces.length === 0 ? (
              <div className="px-3 py-3 text-center text-xs text-slate-400">
                No startups created yet.
              </div>
            ) : (
              workspaces.map((ws) => (
                <button
                  key={ws.id}
                  onClick={() => {
                    selectWorkspace(ws.id);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-700/50 transition-colors ${
                    currentWorkspace?.id === ws.id ? 'text-brand-400 font-semibold bg-brand-500/10' : 'text-slate-300'
                  }`}
                >
                  <span className="truncate">{ws.name}</span>
                  {currentWorkspace?.id === ws.id && (
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-400"></span>
                  )}
                </button>
              ))
            )}
          </div>

          <div className="p-2 border-t border-slate-700/60">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs text-brand-400 hover:text-brand-300 justify-start"
              onClick={() => {
                setIsOpen(false);
                setIsCreateModalOpen(true);
              }}
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" /> Create New Startup
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
