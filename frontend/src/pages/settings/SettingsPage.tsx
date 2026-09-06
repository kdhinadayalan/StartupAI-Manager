import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkspace } from '../../context/WorkspaceContext';
import { workspaceApi } from '../../api/workspaces';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Input } from '../../components/common/Input';
import { EmptyWorkspaceState } from '../../components/common/EmptyWorkspaceState';
import {
  Settings,
  Building2,
  Calendar,
  AlertTriangle,
  Trash2,
  X,
  Lock,
  FileCheck,
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { currentWorkspace, currentRole, members, refreshWorkspaces } = useWorkspace();
  const navigate = useNavigate();

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [confirmName, setConfirmName] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!currentWorkspace) {
    return (
      <EmptyWorkspaceState
        title="No Startup Workspace Active"
        description="Select or create a startup workspace to manage company configuration and settings."
      />
    );
  }

  const isOwner = currentRole === 'OWNER';

  const handleDeleteWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwner || confirmName.trim() !== currentWorkspace.name) return;

    setIsDeleting(true);
    setError(null);
    try {
      await workspaceApi.delete(currentWorkspace.id);
      setIsDeleteModalOpen(false);
      await refreshWorkspaces();
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      console.error('Failed to delete workspace:', err);
      setError(err?.message || 'Failed to delete workspace. Ensure you have Owner permissions.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Settings className="w-5 h-5 text-brand-400" />
          Workspace Settings & Configuration
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Manage startup identity, tenant properties, and security audit configurations.
        </p>
      </div>

      {/* Overview Card */}
      <Card>
        <div className="flex items-start justify-between border-b border-slate-800 pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">{currentWorkspace.name}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-slate-400">Your role:</span>
                {currentRole && <Badge variant="primary">{currentRole}</Badge>}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-3 rounded-lg bg-slate-800/40 border border-slate-800">
            <span className="text-slate-500 uppercase tracking-wider text-[10px] font-semibold block mb-1">
              Industry & Domain
            </span>
            <span className="text-white font-medium text-sm">
              {currentWorkspace.industry || 'General Technology / Software'}
            </span>
          </div>

          <div className="p-3 rounded-lg bg-slate-800/40 border border-slate-800">
            <span className="text-slate-500 uppercase tracking-wider text-[10px] font-semibold block mb-1">
              Base Currency
            </span>
            <span className="text-white font-medium text-sm">
              {currentWorkspace.currency || 'USD'}
            </span>
          </div>

          <div className="p-3 rounded-lg bg-slate-800/40 border border-slate-800">
            <span className="text-slate-500 uppercase tracking-wider text-[10px] font-semibold block mb-1">
              Team Size
            </span>
            <span className="text-white font-medium text-sm">
              {members.length} active {members.length === 1 ? 'member' : 'members'}
            </span>
          </div>

          <div className="p-3 rounded-lg bg-slate-800/40 border border-slate-800">
            <span className="text-slate-500 uppercase tracking-wider text-[10px] font-semibold block mb-1 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-slate-400" /> Initialized On
            </span>
            <span className="text-white font-medium text-sm">
              {currentWorkspace.created_at ? new Date(currentWorkspace.created_at).toLocaleDateString() : 'N/A'}
            </span>
          </div>
        </div>

        {currentWorkspace.description && (
          <div className="mt-4 p-3 rounded-lg bg-slate-800/20 border border-slate-800/60">
            <span className="text-slate-500 uppercase tracking-wider text-[10px] font-semibold block mb-1">
              Mission / Description
            </span>
            <p className="text-xs text-slate-300 leading-relaxed">{currentWorkspace.description}</p>
          </div>
        )}
      </Card>

      {/* Security & Audit Notice */}
      <Card>
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <FileCheck className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Immutable Security Audit Vault</h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              All administrative operations, role modifications, financial ledger writes, and staged AI approvals
              within this workspace are automatically appended to the immutable database audit ledger with correlation IDs.
            </p>
          </div>
        </div>
      </Card>

      {/* Danger Zone — Workspace Deletion */}
      <Card className="border-rose-900/50 bg-rose-950/10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
              <AlertTriangle className="w-4 h-4" />
              Danger Zone — Workspace Deletion
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-xl">
              Permanently delete this startup workspace and all associated projects, tasks, expenses, risks, and records.
              This operation cannot be undone.
            </p>
          </div>

          {isOwner ? (
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                setConfirmName('');
                setError(null);
                setIsDeleteModalOpen(true);
              }}
              className="shrink-0"
            >
              <Trash2 className="w-4 h-4 mr-1.5" />
              Delete Workspace
            </Button>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-400 shrink-0">
              <Lock className="w-3.5 h-3.5 text-slate-400" />
              <span>Owner Only</span>
            </div>
          )}
        </div>

        {!isOwner && (
          <div className="mt-3 text-[11px] text-slate-500 bg-slate-900/40 p-2.5 rounded-lg border border-slate-800">
            Note: As an Administrator, you can manage workspace operations and team members. Workspace deletion is strictly restricted to the workspace Owner.
          </div>
        )}
      </Card>

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex min-h-screen items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isDeleting) {
              setIsDeleteModalOpen(false);
            }
          }}
        >
          <div className="bg-slate-900 border border-rose-500/40 rounded-2xl w-full max-w-md p-6 shadow-2xl relative my-auto text-left">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2 text-rose-400 font-bold text-base">
                <AlertTriangle className="w-5 h-5" />
                Confirm Workspace Deletion
              </div>
              <button
                onClick={() => !isDeleting && setIsDeleteModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleDeleteWorkspace} className="space-y-4">
              {error && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs">
                  {error}
                </div>
              )}

              <p className="text-xs text-slate-300 leading-relaxed">
                This action is <span className="text-rose-400 font-bold">irreversible</span>. It will permanently destroy
                the workspace <span className="text-white font-bold font-mono">"{currentWorkspace.name}"</span>, along with
                all its projects, Kanban tasks, financial entries, campaigns, and audit history.
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  To confirm, please type <span className="text-white font-bold font-mono">"{currentWorkspace.name}"</span> below:
                </label>
                <Input
                  value={confirmName}
                  onChange={(e) => setConfirmName(e.target.value)}
                  placeholder={currentWorkspace.name}
                  required
                  autoFocus
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  onClick={() => setIsDeleteModalOpen(false)}
                  disabled={isDeleting}
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  type="submit"
                  isLoading={isDeleting}
                  disabled={confirmName.trim() !== currentWorkspace.name}
                >
                  <Trash2 className="w-4 h-4 mr-1.5" />
                  Permanently Delete
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
