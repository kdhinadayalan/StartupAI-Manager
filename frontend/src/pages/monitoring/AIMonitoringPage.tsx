import React, { useEffect, useState } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { monitoringApi } from '../../api/monitoring';
import { AIMonitoringTelemetry } from '../../types/monitoring';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import {
  Activity,
  Cpu,
  Clock,
  DollarSign,
  Wrench,
  RefreshCw,
  Zap,
} from 'lucide-react';

export const AIMonitoringPage: React.FC = () => {
  const { currentWorkspace, currentRole } = useWorkspace();
  const [telemetry, setTelemetry] = useState<AIMonitoringTelemetry | null>(null);
  const [days, setDays] = useState<number>(30);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const canView = currentRole === 'OWNER' || currentRole === 'ADMIN' || currentRole === 'MANAGER';

  const fetchTelemetry = async () => {
    if (!currentWorkspace) return;
    setIsLoading(true);
    try {
      const data = await monitoringApi.getTelemetry(currentWorkspace.id, days);
      setTelemetry(data);
    } catch (err) {
      console.error('Failed to load telemetry:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTelemetry();
  }, [currentWorkspace?.id, days]);

  if (!currentWorkspace) {
    return (
      <div className="text-center py-12 text-slate-400 text-sm">
        Please select or create a startup workspace first.
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="text-center py-12 text-amber-400 text-sm">
        Access Denied. AI Monitoring requires Manager, Admin, or Owner permissions.
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-purple-400" />
            AI Multi-Agent Telemetry & Observability
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time tracking of agent execution latency, token consumption, tool invocation frequencies, and error rates.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Time Window Selector */}
          <div className="flex bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-xs">
            {[
              { label: '24h', val: 1 },
              { label: '7d', val: 7 },
              { label: '30d', val: 30 },
            ].map((t) => (
              <button
                key={t.val}
                onClick={() => setDays(t.val)}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                  days === t.val ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <Button variant="ghost" size="sm" onClick={fetchTelemetry} isLoading={isLoading}>
            <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh
          </Button>
        </div>
      </div>

      {/* Primary Telemetry Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-1">
          <span className="text-slate-400 text-xs flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-brand-400" /> Total Agent Runs
          </span>
          <div className="text-2xl font-bold text-white">
            {telemetry?.total_runs.toLocaleString() || 0}
          </div>
          <span className="text-[11px] text-slate-500">
            {telemetry?.status_distribution?.success || 0} successful • {telemetry?.status_distribution?.error || 0} failed
          </span>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-1">
          <span className="text-slate-400 text-xs flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-400" /> Token Consumption
          </span>
          <div className="text-2xl font-bold text-white">
            {telemetry?.total_tokens.toLocaleString() || 0}
          </div>
          <span className="text-[11px] text-slate-500">Across Gemini & OpenAI models</span>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-1">
          <span className="text-slate-400 text-xs flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5 text-emerald-400" /> Estimated LLM Cost
          </span>
          <div className="text-2xl font-bold text-emerald-400">
            ${telemetry?.estimated_cost.toFixed(4) || '0.0000'}
          </div>
          <span className="text-[11px] text-slate-500">Blended provider usage</span>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-1">
          <span className="text-slate-400 text-xs flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-purple-400" /> Average Latency
          </span>
          <div className="text-2xl font-bold text-white">
            {telemetry?.avg_execution_time_ms || 0} ms
          </div>
          <span className="text-[11px] text-slate-500">
            Min: {telemetry?.latency?.min_ms || 0}ms • Max: {telemetry?.latency?.max_ms || 0}ms
          </span>
        </div>
      </div>

      {/* Tool Invocation Frequency & Reliability Table */}
      <Card
        title="Tool Registry Telemetry"
        subtitle="Invocation volume, execution reliability, and error breakdown by tool"
        action={<Badge variant="primary">{telemetry?.tool_usage?.length || 0} tools invoked</Badge>}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/60 text-slate-400 uppercase font-semibold border-b border-slate-700/60">
              <tr>
                <th className="py-2.5 px-4">Tool Name</th>
                <th className="py-2.5 px-4">Total Calls</th>
                <th className="py-2.5 px-4">Failed Calls</th>
                <th className="py-2.5 px-4">Error Rate</th>
                <th className="py-2.5 px-4">Reliability</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {!telemetry?.tool_usage?.length ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    No tools invoked yet in this time window.
                  </td>
                </tr>
              ) : (
                telemetry.tool_usage.map((t) => (
                  <tr key={t.tool_name} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2.5 px-4 font-mono font-semibold text-white flex items-center gap-2">
                      <Wrench className="w-3.5 h-3.5 text-brand-400" /> {t.tool_name}
                    </td>
                    <td className="py-2.5 px-4 font-semibold text-slate-200">{t.call_count}</td>
                    <td className="py-2.5 px-4 text-red-400">{t.error_count}</td>
                    <td className="py-2.5 px-4">
                      <span className={t.error_rate_percent > 10 ? 'text-red-400 font-bold' : 'text-slate-400'}>
                        {t.error_rate_percent}%
                      </span>
                    </td>
                    <td className="py-2.5 px-4">
                      {t.error_count === 0 ? (
                        <Badge variant="success">100% SUCCESS</Badge>
                      ) : (
                        <Badge variant="warning">{100 - t.error_rate_percent}%</Badge>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Execution Traces Table */}
      <Card
        title="Recent Multi-Agent Execution Traces"
        subtitle="Data-minimized audit log of agent queries and execution metadata"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/60 text-slate-400 uppercase font-semibold border-b border-slate-700/60">
              <tr>
                <th className="py-2.5 px-4">Agent</th>
                <th className="py-2.5 px-4">Query Snippet</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4">Latency</th>
                <th className="py-2.5 px-4">Tokens</th>
                <th className="py-2.5 px-4">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {!telemetry?.recent_executions?.length ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    No execution traces recorded yet.
                  </td>
                </tr>
              ) : (
                telemetry.recent_executions.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2.5 px-4 font-bold text-white flex items-center gap-1.5">
                      <Cpu className="w-3.5 h-3.5 text-purple-400" /> {r.agent_name}
                    </td>
                    <td className="py-2.5 px-4 text-slate-300 max-w-xs truncate" title={r.query_snippet}>
                      {r.query_snippet}
                    </td>
                    <td className="py-2.5 px-4">
                      <Badge
                        variant={
                          r.status === 'SUCCESS'
                            ? 'success'
                            : r.status === 'AWAITING_APPROVAL'
                            ? 'warning'
                            : 'danger'
                        }
                      >
                        {r.status}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-4 text-slate-400 font-mono">{r.execution_time_ms}ms</td>
                    <td className="py-2.5 px-4 text-slate-400 font-mono">{r.tokens_used}</td>
                    <td className="py-2.5 px-4 text-slate-500">
                      {new Date(r.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
