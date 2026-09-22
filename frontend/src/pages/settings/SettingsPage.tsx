import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { authApi } from '../../api/auth';
import { workspaceApi } from '../../api/workspaces';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Input } from '../../components/common/Input';
import { Avatar } from '../../components/common/Avatar';
import { EmptyWorkspaceState } from '../../components/common/EmptyWorkspaceState';
import { UserSession } from '../../types/auth';
import {
  User as UserIcon,
  Building2,
  Lock,
  Key,
  Laptop,
  Check,
  AlertCircle,
  Trash2,
  FileCheck,
  Calendar,
  AlertTriangle,
  X,
  UploadCloud,
  Link as LinkIcon,
  Shield,
} from 'lucide-react';
import { getCurrencySymbol } from '../../utils/currency';

const AVATAR_PRESETS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&auto=format&fit=crop&q=80',
];

export const SettingsPage: React.FC = () => {
  const { user, updateUserProfile, logoutAll } = useAuth();
  const { currentWorkspace, currentRole, members, refreshWorkspaces } = useWorkspace();
  const navigate = useNavigate();

  // Active Tab: 'profile' | 'workspace'
  const [activeTab, setActiveTab] = useState<'profile' | 'workspace'>('profile');

  // Profile Form State
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || '');
  const [customUrlInput, setCustomUrlInput] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Password Change Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Persistent Sessions State
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);

  // Workspace Deletion Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [confirmName, setConfirmName] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setFullName(user.full_name || '');
      setAvatarUrl(user.avatar_url || '');
    }
  }, [user]);

  const loadSessions = async () => {
    setIsLoadingSessions(true);
    try {
      const data = await authApi.getSessions();
      setSessions(data);
    } catch {
      // silently handle session fetch error
    } finally {
      setIsLoadingSessions(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || fullName.trim().length < 2) {
      setProfileError('Full name must be at least 2 characters long.');
      return;
    }

    setIsSavingProfile(true);
    setProfileSuccess(null);
    setProfileError(null);

    try {
      await updateUserProfile({
        full_name: fullName.trim(),
        avatar_url: avatarUrl.trim() || undefined,
      });
      setProfileSuccess('Profile updated successfully!');
      setTimeout(() => setProfileSuccess(null), 4000);
    } catch (err: any) {
      setProfileError(err?.message || 'Failed to update profile.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      setPasswordError('Please enter your current password.');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }

    setIsChangingPassword(true);
    setPasswordSuccess(null);
    setPasswordError(null);

    try {
      await authApi.changePassword(currentPassword, newPassword);
      setPasswordSuccess('Password updated securely with Argon2id. All other sessions revoked.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      loadSessions();
      setTimeout(() => setPasswordSuccess(null), 5000);
    } catch (err: any) {
      setPasswordError(err?.message || 'Failed to change password. Please verify current password.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleRevokeSession = async (jti: string) => {
    try {
      await authApi.revokeSession(jti);
      loadSessions();
    } catch (err: any) {
      console.error('Failed to revoke session:', err);
    }
  };

  const handleRevokeAllSessions = async () => {
    if (!window.confirm('Are you sure you want to revoke all other device sessions? You will need to re-login on those devices.')) {
      return;
    }
    try {
      await logoutAll();
      loadSessions();
    } catch (err: any) {
      console.error('Failed to revoke all sessions:', err);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setProfileError('Avatar image must be under 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        setAvatarUrl(reader.result);
        setProfileSuccess('Image preview ready. Click "Save Profile Changes" to persist.');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWorkspace || currentRole !== 'OWNER' || confirmName.trim() !== currentWorkspace.name) return;

    setIsDeleting(true);
    setWorkspaceError(null);
    try {
      await workspaceApi.delete(currentWorkspace.id);
      setIsDeleteModalOpen(false);
      await refreshWorkspaces();
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      setWorkspaceError(err?.message || 'Failed to delete workspace.');
    } finally {
      setIsDeleting(false);
    }
  };

  const isOwnerOrAdmin = currentRole === 'OWNER' || currentRole === 'ADMIN';

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
          <UserIcon className="w-6 h-6 text-brand-500" />
          Settings & Account Management
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Manage your personal profile, security credentials, active sessions, and workspace governance.
        </p>
      </div>

      {/* Modern SaaS Navigation Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-6">
        <button
          type="button"
          onClick={() => setActiveTab('profile')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'profile'
              ? 'border-brand-500 text-brand-600 dark:text-brand-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          <UserIcon className="w-4 h-4" />
          My Profile & Security
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('workspace')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'workspace'
              ? 'border-brand-500 text-brand-600 dark:text-brand-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          <Building2 className="w-4 h-4" />
          Workspace Configuration
          {!isOwnerOrAdmin && currentWorkspace && (
            <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded">
              View Only
            </span>
          )}
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: MY PROFILE & SECURITY (ALL ROLES) */}
      {/* ========================================================================= */}
      {activeTab === 'profile' && (
        <div className="space-y-6">
          {/* 1. Profile Details & Avatar */}
          <Card
            title="Personal Profile Information"
            subtitle="Customize your displayed avatar and name across projects, tasks, and audit activity."
          >
            <form onSubmit={handleSaveProfile} className="space-y-6">
              {profileSuccess && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
                  <Check className="w-4 h-4 shrink-0" />
                  <span>{profileSuccess}</span>
                </div>
              )}
              {profileError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{profileError}</span>
                </div>
              )}

              {/* Avatar Picker & Live Preview */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                <div className="relative group">
                  <Avatar
                    src={avatarUrl || null}
                    name={fullName || user?.full_name || 'User'}
                    size="xl"
                    showStatus
                    status="online"
                  />
                  {avatarUrl && (
                    <button
                      type="button"
                      onClick={() => setAvatarUrl('')}
                      className="absolute -top-1 -right-1 bg-rose-500 text-white rounded-full p-1 shadow-md hover:bg-rose-600 transition-colors"
                      title="Remove profile image (revert to initials)"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <div className="flex-1 space-y-3">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Profile Avatar</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Select a curated SaaS avatar, enter an image URL, or upload your own picture.
                    </p>
                  </div>

                  {/* Preset Avatars */}
                  <div>
                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-2">
                      Choose Preset
                    </span>
                    <div className="flex flex-wrap gap-2.5">
                      {AVATAR_PRESETS.map((preset, idx) => (
                        <button
                          type="button"
                          key={idx}
                          onClick={() => setAvatarUrl(preset)}
                          className={`relative rounded-full transition-transform hover:scale-110 focus:outline-none ${
                            avatarUrl === preset
                              ? 'ring-2 ring-brand-500 ring-offset-2 dark:ring-offset-slate-900 scale-105'
                              : 'opacity-80 hover:opacity-100'
                          }`}
                        >
                          <img
                            src={preset}
                            alt={`Preset ${idx + 1}`}
                            className="w-9 h-9 rounded-full object-cover shadow-sm"
                          />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Custom URL and File Upload row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Paste image URL (https://...)"
                          value={customUrlInput}
                          onChange={(e) => setCustomUrlInput(e.target.value)}
                          className="text-xs py-1.5"
                        />
                        <Button
                          variant="secondary"
                          size="sm"
                          type="button"
                          onClick={() => {
                            if (customUrlInput.trim()) {
                              setAvatarUrl(customUrlInput.trim());
                              setCustomUrlInput('');
                            }
                          }}
                          disabled={!customUrlInput.trim()}
                        >
                          <LinkIcon className="w-3 h-3 mr-1" /> Apply
                        </Button>
                      </div>
                    </div>

                    <div>
                      <label className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 hover:border-brand-500 text-xs text-slate-600 dark:text-slate-400 hover:text-brand-500 cursor-pointer transition-colors bg-white dark:bg-slate-900">
                        <UploadCloud className="w-4 h-4 text-brand-500" />
                        <span>Upload Local Photo</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Full Name & Immutable Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Full Name <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Enter your full name"
                    required
                  />
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    Displayed across assigned Kanban tasks, team views, and comments.
                  </span>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-slate-400" />
                      Email Address
                    </label>
                    <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
                      Immutable
                    </span>
                  </div>
                  <Input
                    value={user?.email || ''}
                    disabled
                    className="bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 cursor-not-allowed"
                  />
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    Email is cryptographically locked to your multi-tenant workspace account.
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={isSavingProfile}
                  disabled={isSavingProfile || fullName === user?.full_name && avatarUrl === (user?.avatar_url || '')}
                >
                  <Check className="w-4 h-4 mr-1.5" />
                  Save Profile Changes
                </Button>
              </div>
            </form>
          </Card>

          {/* 2. Security & Password Change */}
          <Card
            title="Security & Password"
            subtitle="Update your password with Argon2id cryptographic hashing. Revokes all active device sessions."
          >
            <form onSubmit={handleChangePassword} className="space-y-4">
              {passwordSuccess && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
                  <Check className="w-4 h-4 shrink-0" />
                  <span>{passwordSuccess}</span>
                </div>
              )}
              {passwordError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{passwordError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Current Password
                  </label>
                  <Input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    New Password
                  </label>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 8 chars"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Confirm New Password
                  </label>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    required
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <Shield className="w-4 h-4 text-brand-500" />
                  <span>Protected by Argon2id memory-hard key derivation</span>
                </div>

                <Button
                  type="submit"
                  variant="secondary"
                  size="sm"
                  isLoading={isChangingPassword}
                  disabled={isChangingPassword || !currentPassword || !newPassword}
                >
                  <Key className="w-3.5 h-3.5 mr-1.5" />
                  Update Password
                </Button>
              </div>
            </form>
          </Card>

          {/* 3. Persistent Device Sessions */}
          <Card
            title="Persistent Device Sessions"
            subtitle="Manage logged-in devices and revoke compromised or stale sessions."
            action={
              <Button
                variant="danger"
                size="sm"
                onClick={handleRevokeAllSessions}
                disabled={sessions.length === 0}
              >
                Revoke All Other Sessions
              </Button>
            }
          >
            {isLoadingSessions ? (
              <div className="text-center py-6 text-xs text-slate-400">Loading active sessions...</div>
            ) : sessions.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-400">No active sessions found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 uppercase font-semibold border-b border-slate-200 dark:border-slate-700/60">
                    <tr>
                      <th className="py-2.5 px-3">Device / Client</th>
                      <th className="py-2.5 px-3">Session Token JTI</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Created</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {sessions.map((session) => (
                      <tr key={session.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <Laptop className="w-4 h-4 text-slate-400 shrink-0" />
                            <div>
                              <span className="block text-slate-900 dark:text-white font-medium">
                                {session.ip_address || '127.0.0.1'}
                              </span>
                              <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate block max-w-xs">
                                {session.user_agent || 'Web Browser'}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-500 dark:text-slate-400 truncate max-w-[140px]">
                          {session.token_jti}
                        </td>
                        <td className="py-2.5 px-3">
                          {session.is_revoked ? (
                            <Badge variant="danger">Revoked</Badge>
                          ) : (
                            <Badge variant="success">Active</Badge>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400">
                          {new Date(session.created_at).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {!session.is_revoked && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRevokeSession(session.token_jti)}
                              className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 p-1.5"
                              title="Revoke session"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: WORKSPACE CONFIGURATION */}
      {/* ========================================================================= */}
      {activeTab === 'workspace' && (
        <div className="space-y-6">
          {!currentWorkspace ? (
            <EmptyWorkspaceState
              title="No Startup Workspace Active"
              description="Select or create a startup workspace to manage company configuration and settings."
            />
          ) : (
            <>
              {/* Workspace Overview */}
              <Card>
                <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-5">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-600 dark:text-brand-400">
                      <Building2 className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-slate-900 dark:text-white">{currentWorkspace.name}</h2>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-slate-500 dark:text-slate-400">Your role:</span>
                        {currentRole && <Badge variant="primary">{currentRole}</Badge>}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                    <span className="text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] font-semibold block mb-1">
                      Industry & Domain
                    </span>
                    <span className="text-slate-900 dark:text-white font-medium text-sm">
                      {currentWorkspace.industry || 'General Technology / Software'}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                    <span className="text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] font-semibold block mb-1">
                      Base Currency
                    </span>
                    <span className="text-slate-900 dark:text-white font-medium text-sm">
                      {currentWorkspace.currency || 'INR'} ({getCurrencySymbol(currentWorkspace.currency)})
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                    <span className="text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] font-semibold block mb-1">
                      Team Size
                    </span>
                    <span className="text-slate-900 dark:text-white font-medium text-sm">
                      {members.length} active {members.length === 1 ? 'member' : 'members'}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                    <span className="text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] font-semibold block mb-1 flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-400" /> Initialized On
                    </span>
                    <span className="text-slate-900 dark:text-white font-medium text-sm">
                      {currentWorkspace.created_at ? new Date(currentWorkspace.created_at).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>
                </div>

                {currentWorkspace.description && (
                  <div className="mt-4 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/20 border border-slate-200 dark:border-slate-800/60">
                    <span className="text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] font-semibold block mb-1">
                      Mission / Description
                    </span>
                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">{currentWorkspace.description}</p>
                  </div>
                )}
              </Card>

              {/* Security & Audit Notice */}
              <Card>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                    <FileCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">Immutable Security Audit Vault</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      All administrative operations, role modifications, financial ledger writes, and staged AI approvals
                      within this workspace are automatically appended to the immutable database audit ledger with correlation IDs.
                    </p>
                  </div>
                </div>
              </Card>

              {/* Danger Zone — Workspace Deletion */}
              <Card className="border-rose-200 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/10">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold text-sm">
                      <AlertTriangle className="w-4 h-4" />
                      Danger Zone — Workspace Deletion
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xl">
                      Permanently delete this startup workspace and all associated projects, tasks, expenses, risks, and records.
                      This operation cannot be undone.
                    </p>
                  </div>

                  {currentRole === 'OWNER' ? (
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => {
                        setConfirmName('');
                        setWorkspaceError(null);
                        setIsDeleteModalOpen(true);
                      }}
                      className="shrink-0"
                    >
                      <Trash2 className="w-4 h-4 mr-1.5" />
                      Delete Workspace
                    </Button>
                  ) : (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-400 shrink-0">
                      <Lock className="w-3.5 h-3.5 text-slate-400" />
                      <span>Owner Only</span>
                    </div>
                  )}
                </div>

                {currentRole !== 'OWNER' && (
                  <div className="mt-3 text-[11px] text-slate-600 dark:text-slate-500 bg-slate-100/60 dark:bg-slate-900/40 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
                    Note: Workspace deletion is strictly restricted to the workspace Owner.
                  </div>
                )}
              </Card>
            </>
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && currentWorkspace && (
        <div
          className="fixed inset-0 z-[100] flex min-h-screen items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isDeleting) {
              setIsDeleteModalOpen(false);
            }
          }}
        >
          <div className="bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-500/40 rounded-2xl w-full max-w-md p-6 shadow-2xl relative my-auto text-left">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 mb-4">
              <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold text-base">
                <AlertTriangle className="w-5 h-5" />
                Confirm Workspace Deletion
              </div>
              <button
                onClick={() => !isDeleting && setIsDeleteModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleDeleteWorkspace} className="space-y-4">
              {workspaceError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-600 dark:text-rose-400 text-xs">
                  {workspaceError}
                </div>
              )}

              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                This action is <span className="text-rose-600 dark:text-rose-400 font-bold">irreversible</span>. It will permanently destroy
                the workspace <span className="text-slate-900 dark:text-white font-bold font-mono">"{currentWorkspace.name}"</span>, along with
                all its projects, Kanban tasks, financial entries, campaigns, and audit history.
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  To confirm, please type <span className="text-slate-900 dark:text-white font-bold font-mono">"{currentWorkspace.name}"</span> below:
                </label>
                <Input
                  value={confirmName}
                  onChange={(e) => setConfirmName(e.target.value)}
                  placeholder={currentWorkspace.name}
                  required
                  autoFocus
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
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
