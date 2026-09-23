import React, { useEffect, useState, useMemo } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { taskApi } from '../../api/tasks';
import { projectApi } from '../../api/projects';
import { Task, TaskStatus, TaskPriority, TaskComment, TaskHistory } from '../../types/task';
import { Project } from '../../types/project';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Avatar } from '../../components/common/Avatar';
import { EmptyWorkspaceState } from '../../components/common/EmptyWorkspaceState';
import {
  CheckSquare,
  Plus,
  Calendar,
  MessageSquare,
  History,
  X,
  ArrowRight,
  ArrowLeft,
  Trash2,
  Send,
  Search,
  Filter,
  RotateCcw,
  Clock,
  AlertCircle,
  FolderKanban,
  CheckCircle2,
} from 'lucide-react';

interface ColumnDef {
  id: TaskStatus;
  label: string;
  headerAccent: string;
  badgeBg: string;
  badgeText: string;
}

const COLUMNS: ColumnDef[] = [
  {
    id: 'TODO',
    label: 'To Do',
    headerAccent: 'border-t-slate-500 dark:border-t-slate-400',
    badgeBg: 'bg-slate-100 dark:bg-slate-800',
    badgeText: 'text-slate-600 dark:text-slate-300',
  },
  {
    id: 'IN_PROGRESS',
    label: 'In Progress',
    headerAccent: 'border-t-indigo-500 dark:border-t-indigo-400',
    badgeBg: 'bg-indigo-50 dark:bg-indigo-950/40',
    badgeText: 'text-indigo-600 dark:text-indigo-400',
  },
  {
    id: 'REVIEW',
    label: 'Review & QA',
    headerAccent: 'border-t-amber-500 dark:border-t-amber-400',
    badgeBg: 'bg-amber-50 dark:bg-amber-950/40',
    badgeText: 'text-amber-600 dark:text-amber-400',
  },
  {
    id: 'DONE',
    label: 'Done',
    headerAccent: 'border-t-emerald-500 dark:border-t-emerald-400',
    badgeBg: 'bg-emerald-50 dark:bg-emerald-950/40',
    badgeText: 'text-emerald-600 dark:text-emerald-400',
  },
];

const PRIORITY_PILLS: Array<{ id: 'ALL' | TaskPriority; label: string }> = [
  { id: 'ALL', label: 'All' },
  { id: 'URGENT', label: 'Urgent' },
  { id: 'HIGH', label: 'High' },
  { id: 'MEDIUM', label: 'Medium' },
  { id: 'LOW', label: 'Low' },
];

export const KanbanPage: React.FC = () => {
  const { currentWorkspace, members, currentRole } = useWorkspace();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Multi-dimensional filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string>('ALL');
  const [selectedPriority, setSelectedPriority] = useState<'ALL' | TaskPriority>('ALL');

  // Modals & Active Task details
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createInitialStatus, setCreateInitialStatus] = useState<TaskStatus>('TODO');
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [history, setHistory] = useState<TaskHistory[]>([]);
  const [newComment, setNewComment] = useState('');
  const [activeTab, setActiveTab] = useState<'details' | 'comments' | 'history'>('details');

  // Create Task form fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('MEDIUM');
  const [assigneeId, setAssigneeId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [estimatedHours, setEstimatedHours] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canCreate = currentRole !== 'VIEWER';

  const fetchTasksAndProjects = async () => {
    if (!currentWorkspace) return;
    setIsLoading(true);
    try {
      const [allTasks, allProjects] = await Promise.all([
        taskApi.list(currentWorkspace.id, {
          project_id: selectedProjectId || undefined,
        }),
        projectApi.list(currentWorkspace.id),
      ]);
      setTasks(allTasks);
      setProjects(allProjects);
      if (allProjects.length > 0 && !projectId) {
        setProjectId(allProjects[0].id);
      }
    } catch (err) {
      console.error('Failed to load Kanban data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTasksAndProjects();
  }, [currentWorkspace?.id, selectedProjectId]);

  // Client-side filtering across Search Query, Assignee, and Priority
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      // 1. Text Search (title and description)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = t.title.toLowerCase().includes(query);
        const matchesDesc = (t.description || '').toLowerCase().includes(query);
        if (!matchesTitle && !matchesDesc) return false;
      }

      // 2. Assignee Filter
      if (selectedAssigneeId === 'UNASSIGNED') {
        if (t.assignee_id) return false;
      } else if (selectedAssigneeId !== 'ALL') {
        if (t.assignee_id !== selectedAssigneeId) return false;
      }

      // 3. Priority Filter
      if (selectedPriority !== 'ALL') {
        if (t.priority !== selectedPriority) return false;
      }

      return true;
    });
  }, [tasks, searchQuery, selectedAssigneeId, selectedPriority]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (searchQuery.trim()) count++;
    if (selectedProjectId) count++;
    if (selectedAssigneeId !== 'ALL') count++;
    if (selectedPriority !== 'ALL') count++;
    return count;
  }, [searchQuery, selectedProjectId, selectedAssigneeId, selectedPriority]);

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedProjectId('');
    setSelectedAssigneeId('ALL');
    setSelectedPriority('ALL');
  };

  const handleStatusTransition = async (task: Task, newStatus: TaskStatus) => {
    if (!currentWorkspace || task.status === newStatus) return;
    try {
      const updated = await taskApi.updateStatus(currentWorkspace.id, task.id, newStatus);
      setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
      if (activeTask && activeTask.id === task.id) {
        setActiveTask(updated);
        loadTaskHistory(task.id);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update task status.');
    }
  };

  const openCreateForColumn = (columnStatus: TaskStatus) => {
    setCreateInitialStatus(columnStatus);
    setIsCreateOpen(true);
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWorkspace || !projectId || !title.trim()) return;
    setIsSubmitting(true);
    try {
      const created = await taskApi.create(currentWorkspace.id, {
        project_id: projectId,
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        assignee_id: assigneeId || undefined,
        due_date: dueDate ? new Date(dueDate).toISOString() : undefined,
        estimated_hours: estimatedHours ? parseFloat(estimatedHours) : undefined,
      });

      // If initial status was not TODO, immediately transition
      if (createInitialStatus !== 'TODO') {
        await taskApi.updateStatus(currentWorkspace.id, created.id, createInitialStatus);
      }

      setTitle('');
      setDescription('');
      setEstimatedHours('');
      setDueDate('');
      setIsCreateOpen(false);
      fetchTasksAndProjects();
    } catch (err: any) {
      alert(err.message || 'Failed to create task.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openTaskDetails = async (task: Task) => {
    setActiveTask(task);
    setActiveTab('details');
    loadTaskComments(task.id);
    loadTaskHistory(task.id);
  };

  const loadTaskComments = async (taskId: string) => {
    if (!currentWorkspace) return;
    try {
      const comms = await taskApi.listComments(currentWorkspace.id, taskId);
      setComments(comms);
    } catch (err) {
      console.error('Failed to fetch comments:', err);
    }
  };

  const loadTaskHistory = async (taskId: string) => {
    if (!currentWorkspace) return;
    try {
      const hist = await taskApi.getHistory(currentWorkspace.id, taskId);
      setHistory(hist);
    } catch (err) {
      console.error('Failed to fetch history:', err);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWorkspace || !activeTask || !newComment.trim()) return;
    try {
      await taskApi.addComment(currentWorkspace.id, activeTask.id, newComment.trim());
      setNewComment('');
      loadTaskComments(activeTask.id);
      loadTaskHistory(activeTask.id);
    } catch (err: any) {
      alert(err.message || 'Failed to post comment.');
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!currentWorkspace || !activeTask) return;
    try {
      await taskApi.deleteComment(currentWorkspace.id, activeTask.id, commentId);
      loadTaskComments(activeTask.id);
      loadTaskHistory(activeTask.id);
    } catch (err: any) {
      alert(err.message || 'Failed to delete comment.');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!currentWorkspace || !confirm('Are you sure you want to delete this task?')) return;
    try {
      await taskApi.delete(currentWorkspace.id, taskId);
      setActiveTask(null);
      fetchTasksAndProjects();
    } catch (err: any) {
      alert(err.message || 'Failed to delete task.');
    }
  };

  const getPriorityBadgeVariant = (p: TaskPriority) => {
    switch (p) {
      case 'URGENT':
        return 'danger';
      case 'HIGH':
        return 'warning';
      case 'MEDIUM':
        return 'primary';
      default:
        return 'neutral';
    }
  };

  const isOverdue = (dateStr?: string | null, status?: TaskStatus) => {
    if (!dateStr || status === 'DONE') return false;
    return new Date(dateStr) < new Date();
  };

  if (!currentWorkspace) {
    return (
      <EmptyWorkspaceState
        title="No Startup Workspace Active"
        description="Select or create a startup workspace to manage initiatives, Kanban board tasks, and team assignments."
      />
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* 1. Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <CheckSquare className="w-6 h-6 text-indigo-500" />
            Tasks & Kanban Board
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Linear-style project execution with live filtering, immutable audit trail, and member avatars.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {canCreate && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => openCreateForColumn('TODO')}
              className="shadow-md shadow-indigo-500/20"
            >
              <Plus className="w-4 h-4 mr-1.5" /> New Task
            </Button>
          )}
        </div>
      </div>

      {/* 2. Comprehensive Filter & Search Bar */}
      <div className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-soft space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Keyword Search */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search tasks by title or requirements..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Project Dropdown Filter */}
          <div className="flex items-center gap-2">
            <FolderKanban className="w-4 h-4 text-slate-400 shrink-0 hidden sm:block" />
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all"
            >
              <option value="">All Projects ({projects.length})</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Assignee Avatar Dropdown */}
          <div className="flex items-center gap-2">
            <select
              value={selectedAssigneeId}
              onChange={(e) => setSelectedAssigneeId(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all"
            >
              <option value="ALL">All Assignees</option>
              <option value="UNASSIGNED">Unassigned</option>
              {members.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.user?.full_name || m.user_id}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Priority Filter Pills Row & Reset Filter */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800/80 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mr-1 flex items-center gap-1">
              <Filter className="w-3 h-3" /> Priority:
            </span>
            {PRIORITY_PILLS.map((pill) => {
              const isActive = selectedPriority === pill.id;
              return (
                <button
                  type="button"
                  key={pill.id}
                  onClick={() => setSelectedPriority(pill.id)}
                  className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/30'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {pill.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Showing <span className="font-semibold text-slate-900 dark:text-white">{filteredTasks.length}</span> of {tasks.length} tasks
            </span>

            {activeFiltersCount > 0 && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 font-medium px-2 py-1 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
                title="Reset all active search and filter criteria"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Clear Filters ({activeFiltersCount})
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 3. Four-Column Modern Kanban Board */}
      {isLoading ? (
        <div className="text-center py-20 text-xs text-slate-500 dark:text-slate-400">
          <div className="inline-flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            Loading tasks...
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
          {COLUMNS.map((col, colIndex) => {
            const colTasks = filteredTasks.filter((t) => t.status === col.id);
            const totalTasksCount = filteredTasks.length;
            const percentage = totalTasksCount > 0 ? Math.round((colTasks.length / totalTasksCount) * 100) : 0;

            return (
              <div
                key={col.id}
                className={`bg-slate-100/70 dark:bg-slate-900/60 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-3 flex flex-col min-h-[560px] border-t-4 ${col.headerAccent} shadow-soft`}
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200/80 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">
                      {col.label}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${col.badgeBg} ${col.badgeText} border border-slate-200/60 dark:border-slate-700/60`}
                    >
                      {colTasks.length} ({percentage}%)
                    </span>
                  </div>

                  {canCreate && (
                    <button
                      type="button"
                      onClick={() => openCreateForColumn(col.id)}
                      className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800 transition-colors"
                      title={`Quick add task to ${col.label}`}
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Tasks List Container */}
                <div className="space-y-3 flex-1 overflow-y-auto max-h-[calc(100vh-17rem)] pr-0.5">
                  {colTasks.length === 0 ? (
                    <div className="border border-dashed border-slate-300 dark:border-slate-800 rounded-xl py-12 text-center text-xs text-slate-400 dark:text-slate-600 flex flex-col items-center justify-center gap-2">
                      <CheckCircle2 className="w-6 h-6 opacity-40 text-slate-400" />
                      <span>No tasks in {col.label}</span>
                    </div>
                  ) : (
                    colTasks.map((task) => {
                      const overdue = isOverdue(task.due_date, task.status);
                      const project = projects.find((p) => p.id === task.project_id);

                      return (
                        <div
                          key={task.id}
                          onClick={() => openTaskDetails(task)}
                          className="bg-white dark:bg-slate-800/90 hover:bg-slate-50/90 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700/70 hover:border-indigo-500/50 dark:hover:border-indigo-400/50 rounded-xl p-3.5 shadow-sm hover:shadow-soft hover:-translate-y-0.5 cursor-pointer transition-all duration-150 space-y-2.5 group"
                        >
                          {/* Project tag & Priority */}
                          <div className="flex items-center justify-between gap-2">
                            {project ? (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 truncate max-w-[130px]">
                                {project.name}
                              </span>
                            ) : (
                              <span />
                            )}
                            <Badge variant={getPriorityBadgeVariant(task.priority)} className="text-[10px] uppercase font-bold">
                              {task.priority}
                            </Badge>
                          </div>

                          {/* Task Title */}
                          <h4 className="text-xs font-semibold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-2">
                            {task.title}
                          </h4>

                          {/* Task Description snippet */}
                          {task.description && (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                              {task.description}
                            </p>
                          )}

                          {/* Card Footer: Assignee, Due Date, Estimated Hours */}
                          <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-700/50 text-[11px] text-slate-500 dark:text-slate-400">
                            {/* Assignee with Avatar */}
                            <div className="flex items-center gap-1.5 truncate max-w-[120px]">
                              <Avatar
                                src={task.assignee?.avatar_url}
                                name={task.assignee?.full_name || 'Unassigned'}
                                size="xs"
                              />
                              <span className="text-slate-700 dark:text-slate-300 font-medium truncate text-[11px]">
                                {task.assignee?.full_name || 'Unassigned'}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              {task.estimated_hours && (
                                <span className="flex items-center gap-1 text-[10px] text-slate-400" title="Estimated hours">
                                  <Clock className="w-3 h-3" />
                                  {task.estimated_hours}h
                                </span>
                              )}

                              {task.due_date && (
                                <span
                                  className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded ${
                                    overdue
                                      ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold'
                                      : 'text-slate-400'
                                  }`}
                                  title={overdue ? 'Overdue deadline' : 'Target due date'}
                                >
                                  {overdue && <AlertCircle className="w-3 h-3 text-rose-500" />}
                                  <Calendar className="w-3 h-3" />
                                  <span>{new Date(task.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Quick Status Shift Controls */}
                          <div
                            className="flex items-center justify-between pt-1 text-[10px] text-slate-500 dark:text-slate-400 border-t border-slate-50 dark:border-slate-800"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {colIndex > 0 ? (
                              <button
                                type="button"
                                onClick={() => handleStatusTransition(task, COLUMNS[colIndex - 1].id)}
                                className="hover:text-indigo-600 dark:hover:text-indigo-400 px-1.5 py-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700/60 flex items-center gap-0.5 transition-colors"
                                title={`Move backward to ${COLUMNS[colIndex - 1].label}`}
                              >
                                <ArrowLeft className="w-3 h-3" /> {COLUMNS[colIndex - 1].id}
                              </button>
                            ) : <div />}

                            {colIndex < COLUMNS.length - 1 && (
                              <button
                                type="button"
                                onClick={() => handleStatusTransition(task, COLUMNS[colIndex + 1].id)}
                                className="hover:text-indigo-600 dark:hover:text-indigo-400 px-1.5 py-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700/60 flex items-center gap-0.5 transition-colors"
                                title={`Move forward to ${COLUMNS[colIndex + 1].label}`}
                              >
                                {COLUMNS[colIndex + 1].id} <ArrowRight className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 4. Task Details, Comments & Audit History Modal */}
      {activeTask && (
        <div
          className="fixed inset-0 z-[100] flex min-h-screen items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveTask(null);
          }}
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl p-6 shadow-2xl relative my-auto max-h-[90vh] flex flex-col text-left">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-3.5 border-b border-slate-200 dark:border-slate-800 mb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant={getPriorityBadgeVariant(activeTask.priority)}>
                    {activeTask.priority}
                  </Badge>
                  <Badge variant="primary">{activeTask.status}</Badge>
                  {isOverdue(activeTask.due_date, activeTask.status) && (
                    <Badge variant="danger">Overdue</Badge>
                  )}
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-snug">
                  {activeTask.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveTask(null)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-200 dark:border-[#2d2d2d] text-xs font-semibold mb-4 gap-4">
              <button
                type="button"
                onClick={() => setActiveTab('details')}
                className={`pb-2.5 border-b-2 transition-all ${
                  activeTab === 'details'
                    ? 'border-blue-600 text-blue-600 dark:text-[#388bfd] font-bold'
                    : 'border-transparent text-slate-500 dark:text-[#9da7b3] hover:text-slate-900 dark:hover:text-[#e6edf3]'
                }`}
              >
                Task Details
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('comments')}
                className={`pb-2.5 border-b-2 transition-all flex items-center gap-1.5 ${
                  activeTab === 'comments'
                    ? 'border-blue-600 text-blue-600 dark:text-[#388bfd] font-bold'
                    : 'border-transparent text-slate-500 dark:text-[#9da7b3] hover:text-slate-900 dark:hover:text-[#e6edf3]'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" /> Comments ({comments.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('history')}
                className={`pb-2.5 border-b-2 transition-all flex items-center gap-1.5 ${
                  activeTab === 'history'
                    ? 'border-blue-600 text-blue-600 dark:text-[#388bfd] font-bold'
                    : 'border-transparent text-slate-500 dark:text-[#9da7b3] hover:text-slate-900 dark:hover:text-[#e6edf3]'
                }`}
              >
                <History className="w-3.5 h-3.5" /> Audit History ({history.length})
              </button>
            </div>

            {/* Tab Contents */}
            <div className="flex-1 overflow-y-auto pr-1">
              {activeTab === 'details' && (
                <div className="space-y-4 text-xs text-slate-600 dark:text-[#9da7b3]">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                      Description & Requirements
                    </label>
                    <p className="bg-slate-50 dark:bg-[#1e1e1e] border border-slate-200 dark:border-[#2d2d2d] p-3.5 rounded-xl text-slate-800 dark:text-[#e6edf3] leading-relaxed whitespace-pre-wrap">
                      {activeTask.description || 'No description provided.'}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-200 dark:border-[#2d2d2d]">
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 block mb-1">Assignee</span>
                      <div className="flex items-center gap-2">
                        <Avatar
                          src={activeTask.assignee?.avatar_url}
                          name={activeTask.assignee?.full_name || 'Unassigned'}
                          size="sm"
                        />
                        <span className="font-semibold text-slate-900 dark:text-[#e6edf3]">
                          {activeTask.assignee?.full_name || 'Unassigned'}
                        </span>
                      </div>
                    </div>

                    <div>
                      <span className="text-slate-500 dark:text-slate-400 block mb-1">Due Date</span>
                      <span className="font-semibold text-slate-900 dark:text-[#e6edf3]">
                        {activeTask.due_date ? new Date(activeTask.due_date).toLocaleDateString() : 'None'}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-500 dark:text-slate-400 block mb-1">Estimated Hours</span>
                      <span className="font-semibold text-slate-900 dark:text-[#e6edf3]">
                        {activeTask.estimated_hours ? `${activeTask.estimated_hours} hrs` : 'Not specified'}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-500 dark:text-slate-400 block mb-1">Created At</span>
                      <span className="font-semibold text-slate-900 dark:text-[#e6edf3]">
                        {new Date(activeTask.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 dark:text-slate-400 text-xs">Set Status:</span>
                      {COLUMNS.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          disabled={activeTask.status === c.id}
                          onClick={() => handleStatusTransition(activeTask, c.id)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                            activeTask.status === c.id
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                              : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                          }`}
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>

                    {currentRole !== 'VIEWER' && (
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleDeleteTask(activeTask.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete Task
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'comments' && (
                <div className="space-y-4">
                  <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                    {comments.length === 0 ? (
                      <div className="text-center py-8 text-xs text-slate-500">
                        No discussion comments yet. Add an update below.
                      </div>
                    ) : (
                      comments.map((c) => (
                        <div key={c.id} className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700/50">
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                              <Avatar
                                src={c.user?.avatar_url}
                                name={c.user?.full_name || 'Member'}
                                size="xs"
                              />
                              <span className="text-xs font-semibold text-slate-900 dark:text-white">
                                {c.user?.full_name || 'Member'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-slate-400">
                                {new Date(c.created_at).toLocaleTimeString()}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleDeleteComment(c.id)}
                                className="text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 p-0.5"
                                title="Delete comment"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                          <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed pl-7">
                            {c.content}
                          </p>
                        </div>
                      ))
                    )}
                  </div>

                  <form onSubmit={handleAddComment} className="flex gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                    <input
                      type="text"
                      placeholder="Add an update or comment (XSS safe)..."
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <Button variant="primary" size="sm" type="submit">
                      <Send className="w-3.5 h-3.5 mr-1" /> Post
                    </Button>
                  </form>
                </div>
              )}

              {activeTab === 'history' && (
                <div className="space-y-2.5">
                  {history.map((h) => (
                    <div
                      key={h.id}
                      className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-xs"
                    >
                      <span className="w-2 h-2 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{h.action}</span>
                          <span className="text-[10px] text-slate-400">
                            {new Date(h.created_at).toLocaleString()}
                          </span>
                        </div>
                        {h.field_changed && (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                            Changed <span className="font-mono text-slate-700 dark:text-slate-300">{h.field_changed}</span> from{' '}
                            <span className="line-through text-slate-400 dark:text-slate-500">{h.old_value}</span> to{' '}
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{h.new_value}</span>
                          </div>
                        )}
                        {h.user && (
                          <span className="text-[10px] text-slate-400 mt-1 block">
                            By {h.user.full_name}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 5. Create Task Modal */}
      {isCreateOpen && (
        <div
          className="fixed inset-0 z-[100] flex min-h-screen items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isSubmitting) setIsCreateOpen(false);
          }}
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg p-6 sm:p-7 shadow-2xl relative my-auto text-left">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Create New Task</h3>
                <span className="text-xs bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full font-semibold">
                  Status: {createInitialStatus}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                  Project <span className="text-rose-500">*</span>
                </label>
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <Input
                label="Task Title"
                placeholder="e.g. Design Stripe webhook handler"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                autoFocus
              />

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                  Description & Requirements
                </label>
                <textarea
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  rows={3}
                  placeholder="Task requirements and acceptance criteria..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                    Priority
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as TaskPriority)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH</option>
                    <option value="URGENT">URGENT</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                    Assignee
                  </label>
                  <select
                    value={assigneeId}
                    onChange={(e) => setAssigneeId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Unassigned</option>
                    {members.map((m) => (
                      <option key={m.user_id} value={m.user_id}>
                        {m.user?.full_name || m.user_id}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Estimated Hours"
                  type="number"
                  placeholder="e.g. 8"
                  value={estimatedHours}
                  onChange={(e) => setEstimatedHours(e.target.value)}
                />

                <Input
                  label="Due Date"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <Button variant="ghost" size="sm" type="button" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" type="submit" isLoading={isSubmitting}>
                  Create Task
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
