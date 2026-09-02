import React, { useEffect, useState } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { projectApi } from '../../api/projects';
import { Project, ProjectStatus } from '../../types/project';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import {
  FolderKanban,
  Plus,
  Search,
  Calendar,
  DollarSign,
  User,
  Trash2,
  X,
  Clock,
} from 'lucide-react';

export const ProjectsPage: React.FC = () => {
  const { currentWorkspace, currentRole } = useWorkspace();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Form fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<ProjectStatus>('PLANNING');
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>('MEDIUM');
  const [budget, setBudget] = useState<string>('');
  const [deadline, setDeadline] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canCreateProject =
    currentRole === 'OWNER' || currentRole === 'ADMIN' || currentRole === 'MANAGER';

  const fetchProjects = async () => {
    if (!currentWorkspace) return;
    setIsLoading(true);
    try {
      const data = await projectApi.list(
        currentWorkspace.id,
        statusFilter ? (statusFilter as ProjectStatus) : undefined,
        search || undefined
      );
      setProjects(data);
    } catch (err) {
      console.error('Failed to load projects:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, [currentWorkspace?.id, statusFilter, search]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWorkspace || !name.trim()) return;
    setIsSubmitting(true);
    try {
      await projectApi.create(currentWorkspace.id, {
        name: name.trim(),
        description: description.trim() || undefined,
        status,
        priority,
        budget: budget ? parseFloat(budget) : undefined,
        deadline: deadline ? new Date(deadline).toISOString() : undefined,
      });
      setName('');
      setDescription('');
      setBudget('');
      setDeadline('');
      setIsCreateOpen(false);
      fetchProjects();
    } catch (err: any) {
      alert(err.message || 'Failed to create project.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (projectId: string) => {
    if (!currentWorkspace || !confirm('Are you sure you want to delete this project and its tasks?')) return;
    try {
      await projectApi.delete(currentWorkspace.id, projectId);
      fetchProjects();
    } catch (err: any) {
      alert(err.message || 'Failed to delete project.');
    }
  };

  const getStatusBadgeVariant = (st: ProjectStatus) => {
    switch (st) {
      case 'ACTIVE':
        return 'success';
      case 'PLANNING':
        return 'primary';
      case 'ON_HOLD':
        return 'warning';
      case 'COMPLETED':
        return 'success';
      default:
        return 'neutral';
    }
  };

  if (!currentWorkspace) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400 text-sm">Please select or create a startup workspace first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <FolderKanban className="w-5 h-5 text-brand-400" />
            Projects
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Manage startup projects, strategic deadlines, and budgets.
          </p>
        </div>

        {canCreateProject && (
          <Button variant="primary" size="sm" onClick={() => setIsCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" /> Create Project
          </Button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3 justify-between bg-slate-800/40 border border-slate-700/60 p-3 rounded-xl">
        <div className="flex items-center gap-2 w-full sm:w-72 relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3" />
          <input
            type="text"
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-900/80 border border-slate-700 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {['', 'PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === st
                  ? 'bg-brand-600 text-white font-semibold'
                  : 'text-slate-400 hover:bg-slate-700/50 hover:text-white'
              }`}
            >
              {st || 'ALL'}
            </button>
          ))}
        </div>
      </div>

      {/* Project Cards Grid */}
      {isLoading ? (
        <div className="text-center py-12 text-slate-400 text-xs">Loading projects...</div>
      ) : projects.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <FolderKanban className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-white">No projects found</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Get started by creating your first milestone or initiative.
            </p>
            {canCreateProject && (
              <div className="mt-4">
                <Button variant="primary" size="sm" onClick={() => setIsCreateOpen(true)}>
                  <Plus className="w-4 h-4 mr-1.5" /> Create Project
                </Button>
              </div>
            )}
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {projects.map((proj) => (
            <div
              key={proj.id}
              className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5 hover:border-slate-600 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="text-sm font-bold text-white leading-snug">{proj.name}</h3>
                  <Badge variant={getStatusBadgeVariant(proj.status)}>{proj.status}</Badge>
                </div>

                <p className="text-xs text-slate-400 line-clamp-2 mb-4">
                  {proj.description || 'No description provided.'}
                </p>

                <div className="space-y-2 pt-2 border-t border-slate-700/40 text-[11px] text-slate-400">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3 h-3 text-slate-500" /> Priority
                    </span>
                    <span className="font-semibold text-slate-200">{proj.priority}</span>
                  </div>

                  {proj.budget !== null && proj.budget !== undefined && (
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <DollarSign className="w-3 h-3 text-slate-500" /> Budget
                      </span>
                      <span className="font-semibold text-white">
                        ${proj.budget.toLocaleString()}
                      </span>
                    </div>
                  )}

                  {proj.deadline && (
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3 h-3 text-slate-500" /> Deadline
                      </span>
                      <span className="text-slate-300">
                        {new Date(proj.deadline).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-700/50 flex items-center justify-between text-xs">
                <span className="text-[11px] text-slate-500 flex items-center gap-1">
                  <User className="w-3 h-3" /> {proj.owner?.full_name || 'Unassigned'}
                </span>

                {(currentRole === 'OWNER' || currentRole === 'ADMIN') && (
                  <button
                    onClick={() => handleDelete(proj.id)}
                    className="text-slate-500 hover:text-red-400 transition-colors p-1"
                    title="Delete project"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Project Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <h3 className="text-base font-bold text-white">Create New Project</h3>
              <button onClick={() => setIsCreateOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <Input
                label="Project Name"
                placeholder="e.g. Mobile App MVP"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
              />

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Description
                </label>
                <textarea
                  className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"
                  rows={2}
                  placeholder="Key milestones and deliverables..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    Initial Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as ProjectStatus)}
                    className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-lg text-slate-100 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500"
                  >
                    <option value="PLANNING">PLANNING</option>
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="ON_HOLD">ON_HOLD</option>
                    <option value="COMPLETED">COMPLETED</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    Priority
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-lg text-slate-100 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500"
                  >
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH</option>
                    <option value="URGENT">URGENT</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Budget (USD)"
                  type="number"
                  placeholder="e.g. 25000"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                />

                <Input
                  label="Deadline"
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <Button variant="ghost" size="sm" type="button" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" type="submit" isLoading={isSubmitting}>
                  Create Project
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
