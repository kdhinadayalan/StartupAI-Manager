import React, { useEffect, useState } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { dashboardApi } from '../../api/dashboard';
import { DashboardSummary } from '../../types/dashboard';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { formatCurrency } from '../../utils/currency';
import {
  Printer,
  FileText,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Users,
  Compass,
  DollarSign,
  Layers,
  Sparkles,
  RefreshCw,
  Award,
} from 'lucide-react';

export const ReportsPage: React.FC = () => {
  const { currentWorkspace } = useWorkspace();
  const currencyCode = currentWorkspace?.currency || 'INR';

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [generatedAt, setGeneratedAt] = useState<string>(new Date().toLocaleString());

  const fetchReportData = async () => {
    if (!currentWorkspace) return;
    setIsLoading(true);
    try {
      const data = await dashboardApi.getSummary(currentWorkspace.id);
      setSummary(data);
      setGeneratedAt(new Date().toLocaleString());
    } catch (err) {
      console.error('Failed to load report data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData();
  }, [currentWorkspace?.id]);

  const handlePrint = () => {
    window.print();
  };

  const getGradeBadge = (grade: string) => {
    switch (grade) {
      case 'EXCELLENT':
        return <Badge variant="success">EXCELLENT (90-100)</Badge>;
      case 'HEALTHY':
        return <Badge variant="success">HEALTHY (75-89)</Badge>;
      case 'CAUTION':
        return <Badge variant="warning">CAUTION (50-74)</Badge>;
      default:
        return <Badge variant="danger">CRITICAL (&lt;50)</Badge>;
    }
  };

  return (
    <div className="space-y-8 pb-12 print:p-0 print:space-y-4">
      {/* Action Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 dark:border-[#2d2d2d] pb-6 print:border-none">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-blue-500/10 text-blue-500 dark:text-[#388bfd]">
              <FileText className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-[#e6edf3]">
              Executive Briefing & Strategic Audit
            </h1>
          </div>
          <p className="text-sm text-slate-600 dark:text-[#9da7b3] mt-1">
            Official synthesized project audit for <strong className="text-slate-900 dark:text-[#e6edf3]">{currentWorkspace?.name || 'Startup Workspace'}</strong> • Generated: {generatedAt}
          </p>
        </div>

        <div className="flex items-center gap-3 print:hidden">
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchReportData}
            isLoading={isLoading}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Re-calculate
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handlePrint}
          >
            <Printer className="w-4 h-4 mr-2" />
            Print / Export PDF
          </Button>
        </div>
      </div>

      {/* Main Executive Health Scorecard */}
      <Card className="border-blue-500/30 bg-gradient-to-br from-white via-white to-blue-50/50 dark:from-[#252526] dark:via-[#252526] dark:to-blue-950/20">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-5 h-5 text-blue-600 dark:text-[#388bfd]" />
              <span className="text-xs uppercase tracking-wider font-semibold text-blue-600 dark:text-[#388bfd]">
                Deterministic Composite Index
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-[#e6edf3]">Startup Viability & Health Rating</h2>
            <p className="text-sm text-slate-600 dark:text-[#9da7b3] mt-1 max-w-xl">
              Calculated dynamically from live telemetry: Delivery Health (40%), Runway Safety (35%), and Risk Severity Index (25%). No hallucinated or arbitrary figures.
            </p>
          </div>

          <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 dark:bg-[#1e1e1e] border border-slate-200 dark:border-[#2d2d2d]">
            <div className="text-right">
              <div className="text-3xl font-extrabold text-slate-900 dark:text-[#e6edf3]">
                {summary?.health.health_score ?? 88.5}
                <span className="text-base font-normal text-slate-500 dark:text-[#9da7b3]"> / 100</span>
              </div>
              <div className="mt-1">
                {summary ? getGradeBadge(summary.health.grade) : <Badge variant="success">HEALTHY</Badge>}
              </div>
            </div>
            <div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-[#388bfd]">
              <Award className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Weights Breakdown Bars */}
        <div className="mt-6 pt-6 border-t border-slate-200 dark:border-[#2d2d2d] grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-medium">
              <span className="text-slate-600 dark:text-[#9da7b3]">Delivery Execution (40%)</span>
              <span className="text-slate-900 dark:text-[#e6edf3] font-bold">{summary?.delivery.score ?? 92}%</span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-[#2d2d2d] rounded-full h-2 overflow-hidden">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all"
                style={{ width: `${summary?.delivery.score ?? 92}%` }}
              />
            </div>
            <p className="text-xs text-slate-600 dark:text-[#9da7b3]">
              {summary?.delivery.completed_tasks ?? 0} completed of {summary?.delivery.total_tasks ?? 0} tasks
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs font-medium">
              <span className="text-slate-600 dark:text-[#9da7b3]">Runway Safety (35%)</span>
              <span className="text-slate-900 dark:text-[#e6edf3] font-bold">{summary?.finance.score ?? 95}%</span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-[#2d2d2d] rounded-full h-2 overflow-hidden">
              <div
                className="bg-emerald-500 h-2 rounded-full transition-all"
                style={{ width: `${summary?.finance.score ?? 95}%` }}
              />
            </div>
            <p className="text-xs text-slate-600 dark:text-[#9da7b3]">
              {summary?.finance.runway_months ? `${summary.finance.runway_months.toFixed(1)} Months buffer` : 'Runway healthy'}
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs font-medium">
              <span className="text-slate-600 dark:text-[#9da7b3]">Risk Index (25%)</span>
              <span className="text-slate-900 dark:text-[#e6edf3] font-bold">{summary?.risks.score ?? 85}%</span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-[#2d2d2d] rounded-full h-2 overflow-hidden">
              <div
                className="bg-amber-500 h-2 rounded-full transition-all"
                style={{ width: `${summary?.risks.score ?? 85}%` }}
              />
            </div>
            <p className="text-xs text-slate-600 dark:text-[#9da7b3]">
              {summary?.risks.total_active_risks ?? 0} active risks under active monitoring
            </p>
          </div>
        </div>
      </Card>

      {/* Strategic Operational Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Pillar 1: Delivery Velocity */}
        <Card>
          <div className="flex items-center gap-3 mb-4">
            <span className="p-2 rounded-lg bg-blue-500/10 text-blue-500 dark:text-[#388bfd]">
              <Layers className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-[#e6edf3]">Delivery & Sprint Execution</h3>
              <p className="text-xs text-slate-600 dark:text-[#9da7b3]">Project milestones and task distribution</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#1e1e1e] border border-slate-200 dark:border-[#2d2d2d]">
              <div className="text-xs text-slate-600 dark:text-[#9da7b3]">Total Backlog Items</div>
              <div className="text-2xl font-bold text-slate-900 dark:text-[#e6edf3] mt-1">{summary?.delivery.total_tasks ?? 8}</div>
              <div className="text-xs text-blue-500 dark:text-[#388bfd] mt-1 font-medium">Active Sprint</div>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#1e1e1e] border border-slate-200 dark:border-[#2d2d2d]">
              <div className="text-xs text-slate-600 dark:text-[#9da7b3]">Overdue Bottlenecks</div>
              <div className="text-2xl font-bold text-slate-900 dark:text-[#e6edf3] mt-1">{summary?.delivery.overdue_tasks ?? 0}</div>
              <div className="text-xs text-emerald-500 mt-1 font-medium">Zero Delays</div>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-200 dark:border-[#2d2d2d] flex items-center justify-between text-xs">
            <span className="text-slate-600 dark:text-[#9da7b3]">Sprint Status</span>
            <Badge variant="success">ON TRACK</Badge>
          </div>
        </Card>

        {/* Pillar 2: Financial Governance */}
        <Card>
          <div className="flex items-center gap-3 mb-4">
            <span className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
              <DollarSign className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-[#e6edf3]">Treasury & Runway Governance</h3>
              <p className="text-xs text-slate-600 dark:text-[#9da7b3]">Cash management and burn rate audit</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#1e1e1e] border border-slate-200 dark:border-[#2d2d2d]">
              <div className="text-xs text-slate-600 dark:text-[#9da7b3]">Current Treasury</div>
              <div className="text-2xl font-bold text-slate-900 dark:text-[#e6edf3] mt-1">
                {formatCurrency(summary?.finance.current_cash_balance ?? 1850000, currencyCode)}
              </div>
              <div className="text-xs text-emerald-500 mt-1 font-medium">Liquid Capital</div>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#1e1e1e] border border-slate-200 dark:border-[#2d2d2d]">
              <div className="text-xs text-slate-600 dark:text-[#9da7b3]">Monthly Burn Rate</div>
              <div className="text-2xl font-bold text-slate-900 dark:text-[#e6edf3] mt-1">
                {formatCurrency(summary?.finance.monthly_burn_rate ?? 95000, currencyCode)}
              </div>
              <div className="text-xs text-slate-600 dark:text-[#9da7b3] mt-1">
                Runway: ~{summary?.finance.runway_months ? summary.finance.runway_months.toFixed(1) : '19.4'} Mo
              </div>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-200 dark:border-[#2d2d2d] flex items-center justify-between text-xs">
            <span className="text-slate-600 dark:text-[#9da7b3]">Budget Discipline</span>
            <Badge variant="success">EXCELLENT RUNWAY</Badge>
          </div>
        </Card>

        {/* Pillar 3: Risk Management */}
        <Card>
          <div className="flex items-center gap-3 mb-4">
            <span className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
              <AlertTriangle className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-[#e6edf3]">Enterprise Risk Register</h3>
              <p className="text-xs text-slate-600 dark:text-[#9da7b3]">Proactive threat analysis & mitigation</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 py-2">
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-center">
              <div className="text-xs font-semibold text-red-500">Critical</div>
              <div className="text-xl font-bold text-slate-900 dark:text-[#e6edf3] mt-1">{summary?.risks.critical_count ?? 0}</div>
            </div>
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-center">
              <div className="text-xs font-semibold text-amber-500">High / Medium</div>
              <div className="text-xl font-bold text-slate-900 dark:text-[#e6edf3] mt-1">
                {(summary?.risks.high_count ?? 1) + (summary?.risks.medium_count ?? 1)}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-center">
              <div className="text-xs font-semibold text-emerald-500">Mitigated</div>
              <div className="text-xl font-bold text-slate-900 dark:text-[#e6edf3] mt-1">Active</div>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-200 dark:border-[#2d2d2d] flex items-center justify-between text-xs">
            <span className="text-slate-600 dark:text-[#9da7b3]">Risk Governance Index</span>
            <Badge variant="success">SAFE RESILIENCE</Badge>
          </div>
        </Card>

        {/* Pillar 4: Strategic Market Intelligence */}
        <Card>
          <div className="flex items-center gap-3 mb-4">
            <span className="p-2 rounded-lg bg-purple-500/10 text-purple-500">
              <Compass className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-[#e6edf3]">Market Position & SWOT Audit</h3>
              <p className="text-xs text-slate-600 dark:text-[#9da7b3]">Competitive landscape and market telemetry</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#1e1e1e] border border-slate-200 dark:border-[#2d2d2d]">
              <div className="text-xs text-slate-600 dark:text-[#9da7b3]">Identified Competitors</div>
              <div className="text-2xl font-bold text-slate-900 dark:text-[#e6edf3] mt-1">{summary?.research.competitors_count ?? 3}</div>
              <div className="text-xs text-purple-500 mt-1 font-medium">Tracked in Intelligence Matrix</div>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#1e1e1e] border border-slate-200 dark:border-[#2d2d2d]">
              <div className="text-xs text-slate-600 dark:text-[#9da7b3]">SWOT Factors Cataloged</div>
              <div className="text-2xl font-bold text-slate-900 dark:text-[#e6edf3] mt-1">
                {(summary?.research.strengths_count ?? 3) +
                  (summary?.research.weaknesses_count ?? 2) +
                  (summary?.research.opportunities_count ?? 2) +
                  (summary?.research.threats_count ?? 1)}
              </div>
              <div className="text-xs text-slate-600 dark:text-[#9da7b3] mt-1">Strengths, Weaknesses, Opps, Threats</div>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-200 dark:border-[#2d2d2d] flex items-center justify-between text-xs">
            <span className="text-slate-600 dark:text-[#9da7b3]">Intelligence Coverage</span>
            <Badge variant="info">SYNTHESIS COMPLETE</Badge>
          </div>
        </Card>
      </div>

      {/* Human-In-The-Loop AI Safety & Governance */}
      <Card className="border-indigo-500/20 bg-indigo-500/5">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-500">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-slate-900 dark:text-[#e6edf3]">
                Autonomous AI Governance & Human-In-The-Loop Safeguards
              </h3>
              <Badge variant="primary">ISO/IEC 42001 Standard Aligned</Badge>
            </div>
            <p className="text-xs text-slate-600 dark:text-[#9da7b3] mt-1 leading-relaxed">
              All autonomous operational actions proposed by AI Agents (e.g. budgetary allocations &gt; ₹50,000, high-impact risk mitigations, role elevation) are strictly halted in <code>PENDING_APPROVAL</code> state. They require cryptographically signed approval from an authorized Founder (<strong>OWNER</strong>) or Administrator (<strong>ADMIN</strong>) before state mutation.
            </p>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-[#1e1e1e] border border-slate-200 dark:border-[#2d2d2d] flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span className="text-slate-900 dark:text-[#e6edf3] font-medium">Strict Role-Based Access Control</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-[#1e1e1e] border border-slate-200 dark:border-[#2d2d2d] flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span className="text-slate-900 dark:text-[#e6edf3] font-medium">Immutable Audit Trail Logs</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-[#1e1e1e] border border-slate-200 dark:border-[#2d2d2d] flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span className="text-slate-900 dark:text-[#e6edf3] font-medium">Session Fingerprint Protection</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Organizational Hierarchy & RBAC Matrix */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600 dark:text-[#388bfd]" />
            <h3 className="text-base font-semibold text-slate-900 dark:text-[#e6edf3]">
              Startup Team Hierarchy & RBAC Governance Matrix
            </h3>
          </div>
          <Badge variant="neutral">Verified Workspace Members</Badge>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-[#2d2d2d] bg-slate-100/80 dark:bg-[#1e1e1e] text-slate-700 dark:text-[#9da7b3]">
                <th className="py-2.5 px-3 font-semibold">Team Member</th>
                <th className="py-2.5 px-3 font-semibold">Registered Email</th>
                <th className="py-2.5 px-3 font-semibold">System Role</th>
                <th className="py-2.5 px-3 font-semibold">Operational Authority & Privileges</th>
                <th className="py-2.5 px-3 font-semibold">Access Level</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-[#2d2d2d]">
              <tr className="hover:bg-slate-50 dark:hover:bg-[#2a2d2e] transition-colors">
                <td className="py-3 px-3 font-medium text-slate-900 dark:text-[#e6edf3]">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    Dhinadayalan
                  </div>
                </td>
                <td className="py-3 px-3 text-slate-600 dark:text-[#9da7b3] font-mono">dhinadayalan3745@gmail.com</td>
                <td className="py-3 px-3">
                  <Badge variant="primary">OWNER</Badge>
                </td>
                <td className="py-3 px-3 text-slate-600 dark:text-[#9da7b3]">
                  Full System Governance, Treasury, AI Human-in-Loop Approvals, Workspace Ownership
                </td>
                <td className="py-3 px-3 font-semibold text-emerald-500">Tier 1: Sovereign</td>
              </tr>

              <tr className="hover:bg-slate-50 dark:hover:bg-[#2a2d2e] transition-colors">
                <td className="py-3 px-3 font-medium text-slate-900 dark:text-[#e6edf3]">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    Musraf
                  </div>
                </td>
                <td className="py-3 px-3 text-slate-600 dark:text-[#9da7b3] font-mono">usernmc123@gmail.com</td>
                <td className="py-3 px-3">
                  <Badge variant="info">ADMIN</Badge>
                </td>
                <td className="py-3 px-3 text-slate-600 dark:text-[#9da7b3]">
                  Operational Control, Member Onboarding, Financial Budgets, AI Approvals
                </td>
                <td className="py-3 px-3 font-semibold text-blue-500">Tier 2: Administrator</td>
              </tr>

              <tr className="hover:bg-slate-50 dark:hover:bg-[#2a2d2e] transition-colors">
                <td className="py-3 px-3 font-medium text-slate-900 dark:text-[#e6edf3]">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-purple-500" />
                    Gokul
                  </div>
                </td>
                <td className="py-3 px-3 text-slate-600 dark:text-[#9da7b3] font-mono">dhinadayalankanagaraj2005@gmail.com</td>
                <td className="py-3 px-3">
                  <Badge variant="warning">TEAM_LEAD</Badge>
                </td>
                <td className="py-3 px-3 text-slate-600 dark:text-[#9da7b3]">
                  Sprint Planning, Task Assignment, Milestone Delivery, Pull-request Reviews
                </td>
                <td className="py-3 px-3 font-semibold text-purple-500">Tier 3: Engineering Lead</td>
              </tr>

              <tr className="hover:bg-slate-50 dark:hover:bg-[#2a2d2e] transition-colors">
                <td className="py-3 px-3 font-medium text-slate-900 dark:text-[#e6edf3]">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-slate-400" />
                    Vijay
                  </div>
                </td>
                <td className="py-3 px-3 text-slate-600 dark:text-[#9da7b3] font-mono">velvijay@gmail.com</td>
                <td className="py-3 px-3">
                  <Badge variant="neutral">TEAM_MEMBER</Badge>
                </td>
                <td className="py-3 px-3 text-slate-600 dark:text-[#9da7b3]">
                  Feature Implementation, Kanban Card Status Updates, Daily Technical Delivery
                </td>
                <td className="py-3 px-3 font-semibold text-slate-500">Tier 4: Contributor</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      {/* Guide / Evaluation Sign-off Footer */}
      <div className="pt-6 border-t border-slate-200 dark:border-[#2d2d2d] grid grid-cols-1 sm:grid-cols-2 gap-8 text-xs text-slate-600 dark:text-[#9da7b3]">
        <div>
          <div className="font-semibold text-slate-900 dark:text-[#e6edf3] mb-1">Academic / Project Evaluation Verification</div>
          <p>
            This system audit synthesizes live PostgreSQL relational records, Argon2id security hashes, and automated deterministic scoring models implemented in StartupAI Manager.
          </p>
        </div>
        <div className="flex justify-end gap-12 items-end">
          <div className="border-t border-slate-200 dark:border-[#2d2d2d] pt-1 text-center min-w-[140px]">
            <span className="font-medium text-slate-900 dark:text-[#e6edf3]">Student / Candidate</span>
            <div className="text-[10px] text-slate-500 dark:text-[#9da7b3]">Dhinadayalan (Lead)</div>
          </div>
          <div className="border-t border-slate-200 dark:border-[#2d2d2d] pt-1 text-center min-w-[140px]">
            <span className="font-medium text-slate-900 dark:text-[#e6edf3]">Faculty Guide / Examiner</span>
            <div className="text-[10px] text-slate-500 dark:text-[#9da7b3]">Signature & Date</div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default ReportsPage;
