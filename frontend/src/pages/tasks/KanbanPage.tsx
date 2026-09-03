import React, { useEffect, useState } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { taskApi } from '../../api/tasks';
import { projectApi } from '../../api/projects';
import { Task, TaskStatus, TaskPriority, TaskComment, TaskHistory } from '../../types/task';
import { Project } from '../../types/project';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { EmptyWorkspaceState } from '../../components/common/EmptyWorkspaceState';
import {
  CheckSquare,
  Plus,
  User,
  Calendar,
  MessageSquare,
  History,
  X,
  ArrowRight,
  ArrowLeft,
  Trash2,
  Send,
} from 'lucide-react';

const COLUMNS: { id: TaskStatus; label: string; color: string }[] = [
  { id: 'TODO', label: 'To Do', color: 'border-slate-600' },
  { id: 'IN_PROGRESS', label: 'In Progress', color: 'border-brand-500' },
  { id: 'REVIEW', label: 'Review & QA', color: 'border-amber-500' },
  { id: 'DONE', label: 'Done', color: 'border-emerald-500' },
];

export const KanbanPage: React.FC = () => {
  const { currentWorkspace, members, currentRole } = useWorkspace();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  // Modals & Active Task details
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [history, setHistory] = useState<TaskHistory[]>([]);
  const [newComment, setNewComment] = useState('');
  const [activeTab, setActiveTab] = useState<'details' | 'comments' | 'history'>('details');

  // Create Task form
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

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWorkspace || !projectId || !title.trim()) return;
    setIsSubmitting(true);
    try {
      await taskApi.create(currentWorkspace.id, {
        project_id: projectId,
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        assignee_id: assigneeId || undefined,
        due_date: dueDate ? new Date(dueDate).toISOString() : undefined,
        estimated_hours: estimatedHours ? parseFloat(estimatedHours) : undefined,
      });
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

  if (!currentWorkspace) {
    return (
      <EmptyWorkspaceState
        title="No Startup Workspace Active"
        description="Select or create a startup workspace to manage initiatives, Kanban board tasks, and team assignments."
      />
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header & Project Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-brand-400" />
            Tasks & Kanban Board
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Visual workflow management with immutable history and XSS-sanitized collaboration.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          {canCreate && (
            <Button variant="primary" size="sm" onClick={() => setIsCreateOpen(true)}>
              <Plus className="w-4 h-4 mr-1.5" /> New Task
            </Button>
          )}
        </div>
      </div>

      {/* 4-Column Kanban Board */}
      {isLoading ? (
        <div className="text-center py-16 text-xs text-slate-400">Loading Kanban board...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
          {COLUMNS.map((col, colIndex) => {
          const colTasks = tasks.filter((t) => t.status === col.id);
          return (
            <div
              key={col.id}
              className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 flex flex-col min-h-[500px]"
            >
              {/* Column Header */}
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    {col.label}
                  </span>
                  <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 text-[11px] font-bold flex items-center justify-center">
                    {colTasks.length}
                  </span>
                </div>
              </div>

              {/* Tasks List */}
              <div className="space-y-3 flex-1 overflow-y-auto max-h-[calc(100vh-16rem)] pr-1">
                {colTasks.length === 0 ? (
                  <div className="border border-dashed border-slate-800 rounded-lg py-8 text-center text-[11px] text-slate-600">
                    No tasks
                  </div>
                ) : (
                  colTasks.map((task) => (
                    <div
                      key={task.id}
                      onClick={() => openTaskDetails(task)}
                      className="bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 hover:border-brand-500/50 rounded-lg p-3.5 shadow-sm cursor-pointer transition-all space-y-2.5 group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-semibold text-white group-hover:text-brand-300 transition-colors line-clamp-2">
                          {task.title}
                        </span>
                        <Badge variant={getPriorityBadgeVariant(task.priority)} className="text-[10px]">
                          {task.priority}
                        </Badge>
                      </div>

                      {task.description && (
                        <p className="text-[11px] text-slate-400 line-clamp-2">{task.description}</p>
                      )}

                      <div className="flex items-center justify-between pt-2 border-t border-slate-700/40 text-[11px] text-slate-500">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3 h-3 text-slate-400" />
                          <span className="text-slate-300 font-medium">
                            {task.assignee?.full_name || 'Unassigned'}
                          </span>
                        </div>

                        {task.due_date && (
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            <span>{new Date(task.due_date).toLocaleDateString()}</span>
                          </div>
                        )}
                      </div>

                      {/* Quick Column Shift Controls */}
                      <div
                        className="flex items-center justify-between pt-1 text-[10px] text-slate-400"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {colIndex > 0 ? (
                          <button
                            onClick={() => handleStatusTransition(task, COLUMNS[colIndex - 1].id)}
                            className="hover:text-brand-400 p-1 rounded hover:bg-slate-700/40 flex items-center gap-0.5"
                            title={`Move to ${COLUMNS[colIndex - 1].label}`}
                          >
                            <ArrowLeft className="w-3 h-3" /> {COLUMNS[colIndex - 1].id}
                          </button>
                        ) : <div />}

                        {colIndex < COLUMNS.length - 1 && (
                          <button
                            onClick={() => handleStatusTransition(task, COLUMNS[colIndex + 1].id)}
                            className="hover:text-brand-400 p-1 rounded hover:bg-slate-700/40 flex items-center gap-0.5"
                            title={`Move to ${COLUMNS[colIndex + 1].label}`}
                          >
                            {COLUMNS[colIndex + 1].id} <ArrowRight className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
      )}

      {/* Task Details Drawer / Modal */}
      {activeTask && (
        <div
          className="fixed inset-0 z-[100] flex min-h-screen items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveTask(null);
          }}
        >
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl p-6 sm:p-7 shadow-2xl relative my-auto max-h-[90vh] flex flex-col text-left">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-3 border-b border-slate-800 mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant={getPriorityBadgeVariant(activeTask.priority)}>
                    {activeTask.priority}
                  </Badge>
                  <Badge variant="primary">{activeTask.status}</Badge>
                </div>
                <h3 className="text-base font-bold text-white">{activeTask.title}</h3>
              </div>
              <button
                onClick={() => setActiveTask(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-800 text-xs font-semibold mb-4">
              <button
                onClick={() => setActiveTab('details')}
                className={`pb-2 px-3 border-b-2 transition-colors ${
                  activeTab === 'details'
                    ? 'border-brand-500 text-brand-400 font-bold'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                Details
              </button>
              <button
                onClick={() => setActiveTab('comments')}
                className={`pb-2 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
                  activeTab === 'comments'
                    ? 'border-brand-500 text-brand-400 font-bold'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" /> Comments ({comments.length})
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`pb-2 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
                  activeTab === 'history'
                    ? 'border-brand-500 text-brand-400 font-bold'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                <History className="w-3.5 h-3.5" /> Audit History ({history.length})
              </button>
            </div>

            {/* Tab Contents */}
            <div className="flex-1 overflow-y-auto pr-1">
              {activeTab === 'details' && (
                <div className="space-y-4 text-xs text-slate-300">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                      Description
                    </label>
                    <p className="bg-slate-800/60 p-3 rounded-lg text-slate-300 leading-relaxed whitespace-pre-wrap">
                      {activeTask.description || 'No description provided.'}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-800/80">
                    <div>
                      <span className="text-slate-500 block">Assignee</span>
                      <span className="font-semibold text-white mt-0.5 block">
                        {activeTask.assignee?.full_name || 'Unassigned'}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-500 block">Due Date</span>
                      <span className="text-white mt-0.5 block">
                        {activeTask.due_date ? new Date(activeTask.due_date).toLocaleDateString() : 'None'}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-500 block">Estimated Hours</span>
                      <span className="text-white mt-0.5 block">
                        {activeTask.estimated_hours || 'Not set'}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-500 block">Created At</span>
                      <span className="text-white mt-0.5 block">
                        {new Date(activeTask.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-800 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 text-xs">Move status:</span>
                      {COLUMNS.map((c) => (
                        <button
                          key={c.id}
                          disabled={activeTask.status === c.id}
                          onClick={() => handleStatusTransition(activeTask, c.id)}
                          className={`px-2 py-1 rounded text-[11px] font-medium border ${
                            activeTask.status === c.id
                              ? 'bg-brand-600/30 border-brand-500 text-brand-300 opacity-60'
                              : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                          }`}
                        >
                          {c.id}
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
                  {/* Comments list */}
                  <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                    {comments.length === 0 ? (
                      <div className="text-center py-8 text-xs text-slate-500">
                        No comments yet. Start the conversation below.
                      </div>
                    ) : (
                      comments.map((c) => (
                        <div key={c.id} className="bg-slate-800/60 p-3 rounded-lg border border-slate-700/50">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold text-white">
                              {c.user?.full_name || 'Member'}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-slate-500">
                                {new Date(c.created_at).toLocaleTimeString()}
                              </span>
                              <button
                                onClick={() => handleDeleteComment(c.id)}
                                className="text-slate-500 hover:text-red-400 p-0.5"
                                title="Delete comment"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                          <p className="text-xs text-slate-300 whitespace-pre-wrap">{c.content}</p>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Add comment form */}
                  <form onSubmit={handleAddComment} className="flex gap-2 pt-3 border-t border-slate-800">
                    <input
                      type="text"
                      placeholder="Add an update or comment (XSS safe)..."
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    />
                    <Button variant="primary" size="sm" type="submit">
                      <Send className="w-3.5 h-3.5 mr-1" /> Post
                    </Button>
                  </form>
                </div>
              )}

              {activeTab === 'history' && (
                <div className="space-y-2">
                  {history.map((h) => (
                    <div
                      key={h.id}
                      className="flex items-start gap-3 p-2.5 rounded-lg bg-slate-800/40 border border-slate-800 text-xs"
                    >
                      <span className="w-2 h-2 rounded-full bg-brand-400 mt-1.5 shrink-0" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-200">{h.action}</span>
                          <span className="text-[10px] text-slate-500">
                            {new Date(h.created_at).toLocaleString()}
                          </span>
                        </div>
                        {h.field_changed && (
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            Changed <span className="font-mono text-slate-300">{h.field_changed}</span> from{' '}
                            <span className="line-through text-slate-500">{h.old_value}</span> to{' '}
                            <span className="text-emerald-400">{h.new_value}</span>
                          </div>
                        )}
                        {h.user && (
                          <span className="text-[10px] text-slate-500 mt-0.5 block">
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

      {/* Create Task Modal */}
      {isCreateOpen && (
        <div
          className="fixed inset-0 z-[100] flex min-h-screen items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isSubmitting) setIsCreateOpen(false);
          }}
        >
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-lg p-6 sm:p-7 shadow-2xl relative my-auto text-left">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <h3 className="text-base font-bold text-white">Create New Task</h3>
              <button onClick={() => setIsCreateOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Project
                </label>
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500"
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
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Description
                </label>
                <textarea
                  className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"
                  rows={3}
                  placeholder="Task requirements and acceptance criteria..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    Priority
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as TaskPriority)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500"
                  >
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH</option>
                    <option value="URGENT">URGENT</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    Assignee
                  </label>
                  <select
                    value={assigneeId}
                    onChange={(e) => setAssigneeId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500"
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

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
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
