import React, { useState } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Badge } from '../common/Badge';
import { Briefcase, ChevronDown, Plus, X, AlertCircle } from 'lucide-react';

export const WorkspaceSelector: React.FC = () => {
  const { currentWorkspace, workspaces, selectWorkspace, createWorkspace, currentRole } = useWorkspace();
  const [isOpen, setIsOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [industry, setIndustry] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError('Startup Name is required. Please scroll up and enter a name.');
      return;
    }
    if (name.trim().length < 2) {
      setError('Startup Name must be at least 2 characters long.');
      return;
    }
    setIsSubmitting(true);
    try {
      await createWorkspace({
        name: name.trim(),
        description: description.trim() || undefined,
        industry: industry.trim() || undefined,
      });
      setName('');
      setDescription('');
      setIndustry('');
      setError(null);
      setIsModalOpen(false);
    } catch (err: any) {
      console.error('Failed to create workspace:', err);
      setError(err?.message || 'Failed to create workspace. Please check your connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
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
          <div className="absolute left-0 mt-2 w-64 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl py-1 z-50">
            <div className="px-3 py-2 border-b border-slate-700/60 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Your Workspaces
            </div>
            <div className="max-h-56 overflow-y-auto py-1">
              {workspaces.map((ws) => (
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
              ))}
            </div>

            <div className="p-2 border-t border-slate-700/60">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs text-brand-400 hover:text-brand-300 justify-start"
                onClick={() => {
                  setIsOpen(false);
                  setError(null);
                  setIsModalOpen(true);
                }}
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" /> Create New Startup
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Create Workspace Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm p-4 flex min-h-full items-center justify-center">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative my-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
              <div>
                <h3 className="text-base font-bold text-white">Create Startup Workspace</h3>
                <p className="text-xs text-slate-400 mt-0.5">Initialize an isolated workspace for your startup</p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              {error && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Input
                label="Startup Name *"
                placeholder="e.g. NextGen Robotics"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (error) setError(null);
                }}
                required
                autoFocus
              />

              <Input
                label="Industry"
                placeholder="e.g. AI / SaaS / Healthcare"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
              />

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Description & Mission
                </label>
                <textarea
                  className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"
                  rows={3}
                  placeholder="What problem are you solving?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <Button variant="ghost" size="sm" type="button" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" type="submit" isLoading={isSubmitting}>
                  Create Workspace
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
