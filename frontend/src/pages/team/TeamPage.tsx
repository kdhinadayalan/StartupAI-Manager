import React, { useState } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { workspaceApi } from '../../api/workspaces';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Avatar } from '../../components/common/Avatar';
import { Role } from '../../types/auth';
import { Users, UserPlus, Shield, Trash2, CheckCircle } from 'lucide-react';

export const TeamPage: React.FC = () => {
  const { currentWorkspace, members, currentRole, refreshMembers } = useWorkspace();
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('TEAM_MEMBER');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canManageMembers = currentRole === 'OWNER' || currentRole === 'ADMIN';

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWorkspace || !email.trim()) return;
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);

    try {
      await workspaceApi.inviteMember(currentWorkspace.id, {
        email: email.trim(),
        role,
      });
      setSuccess(`Invited ${email} with role ${role}`);
      setEmail('');
      refreshMembers();
      setTimeout(() => {
        setIsInviteOpen(false);
        setSuccess(null);
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to invite member. Please ensure the user has registered.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRoleChange = async (memberId: string, newRole: Role) => {
    if (!currentWorkspace) return;
    try {
      await workspaceApi.updateMemberRole(currentWorkspace.id, memberId, newRole);
      refreshMembers();
    } catch (err: any) {
      alert(err.message || 'Failed to update member role.');
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!currentWorkspace || !confirm('Are you sure you want to remove this member from the workspace?')) return;
    try {
      await workspaceApi.removeMember(currentWorkspace.id, memberId);
      refreshMembers();
    } catch (err: any) {
      alert(err.message || 'Failed to remove member.');
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-brand-500 dark:text-brand-400" />
            Team & Role-Based Access Control
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Workspace: <span className="text-slate-900 dark:text-white font-medium">{currentWorkspace.name}</span> • RBAC strictly validated on backend
          </p>
        </div>

        {canManageMembers && (
          <Button variant="primary" size="sm" onClick={() => setIsInviteOpen(true)}>
            <UserPlus className="w-4 h-4 mr-1.5" /> Invite Team Member
          </Button>
        )}
      </div>

      <Card
        title="Workspace Members"
        subtitle={`${members.length} member${members.length === 1 ? '' : 's'} with assigned roles`}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 uppercase font-semibold border-b border-slate-200 dark:border-slate-700/60">
              <tr>
                <th className="py-3 px-4">Member</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Joined Date</th>
                {canManageMembers && <th className="py-3 px-4 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {members.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2.5">
                      <Avatar
                        src={m.user?.avatar_url}
                        name={m.user?.full_name || 'Member'}
                        size="sm"
                      />
                      <span className="font-semibold text-slate-900 dark:text-white">{m.user?.full_name || 'Member'}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-slate-500 dark:text-slate-400">{m.user?.email}</td>
                  <td className="py-3 px-4">
                    {canManageMembers && m.role !== 'OWNER' && (m.role !== 'ADMIN' || currentRole === 'OWNER') ? (
                      <select
                        value={m.role}
                        onChange={(e) => handleRoleChange(m.id, e.target.value as Role)}
                        className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500"
                      >
                        {currentRole === 'OWNER' && <option value="ADMIN">ADMIN</option>}
                        <option value="TEAM_LEAD">TEAM_LEAD</option>
                        <option value="MANAGER">MANAGER</option>
                        <option value="TEAM_MEMBER">TEAM_MEMBER</option>
                        <option value="VIEWER">VIEWER</option>
                      </select>
                    ) : (
                      <Badge variant={m.role === 'OWNER' ? 'primary' : m.role === 'ADMIN' ? 'warning' : m.role === 'TEAM_LEAD' ? 'info' : m.role === 'MANAGER' ? 'success' : 'neutral'}>
                        {m.role}
                      </Badge>
                    )}
                  </td>
                  <td className="py-3 px-4 text-slate-500 dark:text-slate-400">
                    {new Date(m.joined_at).toLocaleDateString()}
                  </td>
                  {canManageMembers && (
                    <td className="py-3 px-4 text-right">
                      {m.role !== 'OWNER' && (m.role !== 'ADMIN' || currentRole === 'OWNER') && (
                        <button
                          onClick={() => handleRemoveMember(m.id)}
                          className="text-slate-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400 transition-colors p-1"
                          title="Remove from company"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Invite Member Modal */}
      {isInviteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">Invite Workspace Member</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Enter the registered email of the user you want to add to this workspace.
            </p>

            {error && (
              <div className="mb-4 p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500 dark:text-red-400 text-xs flex items-center gap-2">
                <Shield className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="mb-4 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span>{success}</span>
              </div>
            )}

            <form onSubmit={handleInvite} className="space-y-4">
              <Input
                label="User Email"
                type="email"
                placeholder="colleague@startup.io"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                  RBAC Role
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as Role)}
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  {currentRole === 'OWNER' && (
                    <option value="ADMIN">ADMIN — Full management except company deletion</option>
                  )}
                  <option value="TEAM_LEAD">TEAM_LEAD — Manage team tasks, assignments, and monitor progress</option>
                  <option value="MANAGER">MANAGER — Manage assigned projects, tasks, and reports</option>
                  <option value="TEAM_MEMBER">TEAM_MEMBER — Update assigned tasks and add comments</option>
                  <option value="VIEWER">VIEWER — Read-only access to company resources</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <Button variant="ghost" size="sm" type="button" onClick={() => setIsInviteOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" type="submit" isLoading={isSubmitting}>
                  Send Invitation
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
