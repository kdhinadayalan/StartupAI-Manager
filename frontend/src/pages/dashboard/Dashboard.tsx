import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { dashboardApi } from '../../api/dashboard';
import { aiApi } from '../../api/ai';
import { authApi } from '../../api/auth';
import { DashboardSummary } from '../../types/dashboard';
import { UserSession } from '../../types/auth';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { EmptyWorkspaceState } from '../../components/common/EmptyWorkspaceState';
import {
  Sparkles,
  TrendingDown,
  Megaphone,
  Radar,
  ArrowRight,
  AlertTriangle,
  Clock,
  Compass,
  CheckSquare,
  RefreshCw,
  Trash2,
  Bot,
  ExternalLink,
} from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { user, logoutAll } = useAuth();
  const { currentWorkspace, currentRole } = useWorkspace();

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isProcessingApproval, setIsProcessingApproval] = useState<string | null>(null);

  const canApprove = currentRole === 'OWNER' || currentRole === 'ADMIN' || currentRole === 'MANAGER';

  const fetchData = async () => {
    if (!currentWorkspace) return;
    setIsLoading(true);
    try {
      const [sumData, sessData] = await Promise.all([
        dashboardApi.getSummary(currentWorkspace.id),
        authApi.getSessions(),
      ]);
      setSummary(sumData);
      setSessions(sessData);
    } catch (err) {
      console.error('Failed to load dashboard summary:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentWorkspace?.id]);

  const handleApprove = async (approvalId: string) => {
    if (!currentWorkspace) return;
    setIsProcessingApproval(approvalId);
    try {
      await aiApi.approve(currentWorkspace.id, approvalId);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to approve action.');
    } finally {
      setIsProcessingApproval(null);
    }
  };

  const handleReject = async (approvalId: string) => {
    if (!currentWorkspace) return;
    const reason = window.prompt('Enter rejection reason:') || 'Declined by user';
    setIsProcessingApproval(approvalId);
    try {
      await aiApi.reject(currentWorkspace.id, approvalId, reason);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to reject action.');
    } finally {
      setIsProcessingApproval(null);
    }
  };

  const handleRevokeSession = async (jti: string) => {
    try {
      await authApi.revokeSession(jti);
      const sessData = await authApi.getSessions();
      setSessions(sessData);
    } catch (err) {
      console.error('Error revoking session:', err);
    }
  };

  const getHealthBadge = (grade: string) => {
    switch (grade) {
      case 'EXCELLENT':
        return <Badge variant="success">EXCELLENT</Badge>;
      case 'HEALTHY':
        return <Badge variant="primary">HEALTHY</Badge>;
      case 'CAUTION':
        return <Badge variant="warning">CAUTION</Badge>;
      default:
        return <Badge variant="danger">CRITICAL</Badge>;
    }
  };

  if (!currentWorkspace) {
    return (
      <EmptyWorkspaceState
        title="No Startup Workspace Active"
        description="Select or create a startup workspace to access your Executive Command Center, real-time health score, and domain telemetry."
      />
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-brand-950/40 to-slate-900 border border-brand-500/20 rounded-2xl p-6 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                Executive Command Center Operational
              </span>
            </div>
            <h1 className="text-2xl font-bold text-white mt-2">
              Welcome back, {user?.full_name}
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Startup: <span className="text-white font-semibold">{currentWorkspace.name}</span> • Unified Domain Intelligence & AI Governance
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={fetchData} isLoading={isLoading}>
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh
            </Button>
            <Link to="/ai-manager">
              <Button variant="primary" size="sm">
                <Sparkles className="w-3.5 h-3.5 mr-1.5" /> AI Manager
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* 1. STARTUP HEALTH SCORE HERO CARD */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Deterministic Startup Health Score
              </span>
              {summary && getHealthBadge(summary.health.grade)}
              {summary?.health.data_confidence === 'PARTIAL_DATA' && (
                <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                  Partial Data
                </span>
              )}
            </div>
            <div className="text-4xl font-extrabold text-white mt-1">
              {summary?.health.health_score || 0}
              <span className="text-lg font-normal text-slate-500"> / 100</span>
            </div>
          </div>

          <div className="text-right sm:max-w-xs">
            {summary?.health.limitation_notice && (
              <div className="text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5 text-left flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                <span>{summary.health.limitation_notice}</span>
              </div>
            )}
          </div>
        </div>

        {/* 3 Weighted Dimensions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-slate-800">
          <div className="bg-slate-800/50 p-3.5 rounded-xl border border-slate-700/50 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                <CheckSquare className="w-3.5 h-3.5 text-brand-400" /> Delivery Health (40%)
              </span>
              <span className="font-bold text-white">{summary?.delivery.score || 0}/100</span>
            </div>
            <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-brand-500 h-full rounded-full transition-all"
                style={{ width: `${summary?.delivery.score || 0}%` }}
              />
            </div>
            <span className="text-[10px] text-slate-400 block">
              {summary?.delivery.completed_tasks} completed • {summary?.delivery.overdue_tasks} overdue
            </span>
          </div>

          <div className="bg-slate-800/50 p-3.5 rounded-xl border border-slate-700/50 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-emerald-400" /> Runway Safety (35%)
              </span>
              <span className="font-bold text-white">
                {summary?.finance.score !== null && summary?.finance.score !== undefined
                  ? `${summary.finance.score}/100`
                  : 'N/A'}
              </span>
            </div>
            <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all"
                style={{ width: `${summary?.finance.score || 0}%` }}
              />
            </div>
            <span className="text-[10px] text-slate-400 block truncate">
              {summary?.finance.runway_months !== null && summary?.finance.runway_months !== undefined
                ? `${summary.finance.runway_months} months remaining`
                : 'Cash balance not provided'}
            </span>
          </div>

          <div className="bg-slate-800/50 p-3.5 rounded-xl border border-slate-700/50 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                <Radar className="w-3.5 h-3.5 text-purple-400" /> Risk Index (25%)
              </span>
              <span className="font-bold text-white">{summary?.risks.score || 0}/100</span>
            </div>
            <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-purple-500 h-full rounded-full transition-all"
                style={{ width: `${summary?.risks.score || 0}%` }}
              />
            </div>
            <span className="text-[10px] text-slate-400 block">
              {summary?.risks.critical_count} critical • {summary?.risks.high_count} high risks
            </span>
          </div>
        </div>
      </div>

      {/* 2. PENDING AI APPROVAL REVIEW CARDS (Direct Dashboard Action) */}
      {summary?.pending_approvals && summary.pending_approvals.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-amber-400" />
              <span className="font-bold text-white text-sm">
                Action Required: Pending AI Approvals ({summary.pending_approvals.length})
              </span>
            </div>
            <Link
              to="/ai-manager"
              className="text-xs text-amber-300 hover:text-white flex items-center gap-1 font-medium"
            >
              Open AI Manager <ExternalLink className="w-3 h-3" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {summary.pending_approvals.map((appr) => (
              <div
                key={appr.id}
                className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between gap-3 shadow-md"
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-white text-xs font-mono">{appr.action_type}</span>
                    <Badge variant={appr.risk_level === 'HIGH' ? 'danger' : 'warning'}>
                      {appr.risk_level} RISK
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-300 line-clamp-2">{appr.explanation}</p>
                </div>

                {canApprove && (
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleReject(appr.id)}
                      disabled={isProcessingApproval === appr.id}
                    >
                      Reject
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleApprove(appr.id)}
                      isLoading={isProcessingApproval === appr.id}
                    >
                      Authorize & Execute
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. DOMAIN KPI OVERVIEW GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Finance */}
        <Link to="/finance" className="group">
          <Card className="hover:border-slate-600 transition-colors cursor-pointer h-full">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-medium flex items-center gap-1.5">
                <TrendingDown className="w-3.5 h-3.5 text-red-400" /> Monthly Burn Rate
              </span>
              <ArrowRight className="w-3 h-3 group-hover:text-brand-400 transition-colors" />
            </div>
            <div className="mt-2 text-2xl font-bold text-white">
              ${summary?.finance.monthly_burn_rate.toLocaleString() || '0.00'}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Treasury: <span className="text-emerald-400 font-semibold">${summary?.finance.current_cash_balance.toLocaleString()}</span>
            </p>
          </Card>
        </Link>

        {/* Marketing */}
        <Link to="/marketing" className="group">
          <Card className="hover:border-slate-600 transition-colors cursor-pointer h-full">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-medium flex items-center gap-1.5">
                <Megaphone className="w-3.5 h-3.5 text-indigo-400" /> Marketing Spend
              </span>
              <ArrowRight className="w-3 h-3 group-hover:text-brand-400 transition-colors" />
            </div>
            <div className="mt-2 text-2xl font-bold text-white">
              ${summary?.marketing.total_spend.toLocaleString() || '0.00'}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              CAC: ${summary?.marketing.overall_cac || 0} • {summary?.marketing.total_campaigns} campaigns
            </p>
          </Card>
        </Link>

        {/* Research / SWOT */}
        <Link to="/research" className="group">
          <Card className="hover:border-slate-600 transition-colors cursor-pointer h-full">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-medium flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-sky-400" /> Market Research
              </span>
              <ArrowRight className="w-3 h-3 group-hover:text-brand-400 transition-colors" />
            </div>
            <div className="mt-2 text-2xl font-bold text-white">
              {summary?.research.competitors_count || 0}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Tracked Competitors • SWOT Matrix Active
            </p>
          </Card>
        </Link>

        {/* Risks */}
        <Link to="/risks" className="group">
          <Card className="hover:border-slate-600 transition-colors cursor-pointer h-full">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-medium flex items-center gap-1.5">
                <Radar className="w-3.5 h-3.5 text-red-400" /> Active Risks
              </span>
              <ArrowRight className="w-3 h-3 group-hover:text-brand-400 transition-colors" />
            </div>
            <div className="mt-2 text-2xl font-bold text-white">
              {summary?.risks.total_active_risks || 0}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              {summary?.risks.critical_count ? (
                <span className="text-red-400 font-bold">{summary.risks.critical_count} Critical Detected</span>
              ) : (
                'Zero Critical Risks'
              )}
            </p>
          </Card>
        </Link>
      </div>

      {/* 4. PERSISTENT SECURITY SESSIONS & REVOCATION */}
      <Card
        title="Persistent User Sessions & Token Revocation"
        subtitle="PostgreSQL-persisted session store with Argon2id and deterministic JWT JTI validation."
        action={
          <div className="flex items-center gap-2">
            <Button variant="danger" size="sm" onClick={logoutAll}>
              Revoke All Other Sessions
            </Button>
          </div>
        }
      >
        {sessions.length === 0 ? (
          <div className="text-center py-6 text-xs text-slate-400">No active sessions found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900/60 text-slate-400 uppercase font-semibold border-b border-slate-700/60">
                <tr>
                  <th className="py-2.5 px-3">Session JTI</th>
                  <th className="py-2.5 px-3">Client Info</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Created</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {sessions.map((session) => (
                  <tr key={session.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2.5 px-3 font-mono text-slate-400 truncate max-w-[180px]">
                      {session.token_jti}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="block text-white font-medium">{session.ip_address || '127.0.0.1'}</span>
                      <span className="text-[10px] text-slate-500 truncate block max-w-xs">{session.user_agent || 'Web Client'}</span>
                    </td>
                    <td className="py-2.5 px-3">
                      {session.is_revoked ? <Badge variant="danger">Revoked</Badge> : <Badge variant="success">Active</Badge>}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400">{new Date(session.created_at).toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-right">
                      {!session.is_revoked && (
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleRevokeSession(session.token_jti)}
                          title="Revoke session"
                        >
                          <Trash2 className="w-3 h-3 mr-1" /> Revoke
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
  );
};
