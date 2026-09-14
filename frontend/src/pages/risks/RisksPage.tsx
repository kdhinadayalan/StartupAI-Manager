import React, { useEffect, useState } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { riskApi } from '../../api/risk';
import { RiskItem, RiskScanSignal, RiskSeverity } from '../../types/risk';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import {
  ShieldAlert,
  Plus,
  Radar,
  RefreshCw,
  X,
} from 'lucide-react';

export const RisksPage: React.FC = () => {
  const { currentWorkspace, currentRole } = useWorkspace();
  const [risks, setRisks] = useState<RiskItem[]>([]);
  const [scanSignals, setScanSignals] = useState<RiskScanSignal[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Modal
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('OPERATIONAL');
  const [likelihood, setLikelihood] = useState('3');
  const [impact, setImpact] = useState('3');
  const [description, setDescription] = useState('');
  const [mitigationPlan, setMitigationPlan] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canManage = currentRole === 'OWNER' || currentRole === 'ADMIN' || currentRole === 'MANAGER';

  const fetchData = async () => {
    if (!currentWorkspace) return;
    setIsLoading(true);
    try {
      const list = await riskApi.getRisks(currentWorkspace.id);
      setRisks(list);
    } catch (err) {
      console.error('Failed to load risks:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentWorkspace?.id]);

  const handleRunScan = async () => {
    if (!currentWorkspace) return;
    setIsScanning(true);
    try {
      const signals = await riskApi.scanRisks(currentWorkspace.id);
      setScanSignals(signals);
    } catch (err: any) {
      alert(err.message || 'Risk scan failed.');
    } finally {
      setIsScanning(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWorkspace || !title.trim()) return;
    setIsSubmitting(true);
    try {
      await riskApi.createRisk(currentWorkspace.id, {
        title: title.trim(),
        category,
        likelihood: parseInt(likelihood),
        impact: parseInt(impact),
        description: description.trim() || undefined,
        mitigation_plan: mitigationPlan.trim() || undefined,
      });
      setTitle('');
      setDescription('');
      setMitigationPlan('');
      setIsAddOpen(false);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to create risk.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = async (riskId: string, newStatus: string) => {
    if (!currentWorkspace) return;
    try {
      await riskApi.updateStatus(currentWorkspace.id, riskId, newStatus);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to update status.');
    }
  };

  const getSeverityBadge = (sev: RiskSeverity) => {
    switch (sev) {
      case 'CRITICAL':
        return <Badge variant="danger">CRITICAL</Badge>;
      case 'HIGH':
        return <Badge variant="warning">HIGH</Badge>;
      case 'MEDIUM':
        return <Badge variant="primary">MEDIUM</Badge>;
      default:
        return <Badge variant="neutral">LOW</Badge>;
    }
  };

  if (!currentWorkspace) {
    return (
      <div className="text-center py-12 text-slate-400 text-sm">
        Please select or create a startup workspace first.
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-red-500 dark:text-red-400" />
            Automated Risk Detection & Governance
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Deterministic risk scoring (Likelihood × Impact), cross-domain automated scanning, and mitigation plans.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={fetchData} isLoading={isLoading}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh
          </Button>

          <Button variant="ghost" size="sm" onClick={handleRunScan} isLoading={isScanning}>
            <Radar className="w-4 h-4 mr-1.5 text-brand-500 dark:text-brand-400" /> Run Automated Scan
          </Button>

          {canManage && (
            <Button variant="primary" size="sm" onClick={() => setIsAddOpen(true)}>
              <Plus className="w-4 h-4 mr-1.5" /> Log Risk Item
            </Button>
          )}
        </div>
      </div>

      {/* Live Scanner Findings if Scan Triggered */}
      {scanSignals.length > 0 && (
        <div className="bg-white dark:bg-slate-900/90 border border-brand-500/40 rounded-xl p-5 space-y-3 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-sm">
              <Radar className="w-4 h-4 text-brand-500 dark:text-brand-400 animate-pulse" />
              Automated Scanner Findings ({scanSignals.length} signals detected)
            </div>
            <button
              onClick={() => setScanSignals([])}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {scanSignals.map((s, idx) => (
              <div
                key={idx}
                className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 rounded-lg p-3.5 space-y-1.5 text-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-bold text-slate-900 dark:text-white leading-tight">{s.title}</span>
                  {getSeverityBadge(s.severity)}
                </div>
                <p className="text-slate-600 dark:text-slate-300 text-[11px]">{s.description}</p>
                <div className="text-[11px] text-amber-600 dark:text-amber-300 font-medium pt-1">
                  💡 {s.indicator}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tracked Risks Table */}
      <Card title="Risk Registry" subtitle={`${risks.length} registered risks across operational and financial categories`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 uppercase font-semibold border-b border-slate-200 dark:border-slate-700/60">
              <tr>
                <th className="py-3 px-4">Risk</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">L × I</th>
                <th className="py-3 px-4">Score</th>
                <th className="py-3 px-4">Severity</th>
                <th className="py-3 px-4">Status</th>
                {canManage && <th className="py-3 px-4 text-right">Update</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {risks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No risks currently tracked. Run an automated scan above.
                  </td>
                </tr>
              ) : (
                risks.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4">
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white block">{r.title}</span>
                        {r.description && (
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 block line-clamp-1">
                            {r.description}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[11px] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        {r.category}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-500 dark:text-slate-400">
                      {r.likelihood} × {r.impact}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">{r.risk_score}/25</td>
                    <td className="py-3 px-4">{getSeverityBadge(r.severity)}</td>
                    <td className="py-3 px-4">
                      <span className="text-slate-700 dark:text-slate-300 font-medium">{r.status}</span>
                    </td>
                    {canManage && (
                      <td className="py-3 px-4 text-right">
                        <select
                          value={r.status}
                          onChange={(e) => handleStatusChange(r.id, e.target.value)}
                          className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-[11px] text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500"
                        >
                          <option value="IDENTIFIED">IDENTIFIED</option>
                          <option value="MONITORING">MONITORING</option>
                          <option value="MITIGATED">MITIGATED</option>
                          <option value="ACCEPTED">ACCEPTED</option>
                        </select>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add Risk Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Log Identified Risk</h3>
              <button onClick={() => setIsAddOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <Input
                label="Risk Title"
                placeholder="e.g. Single point of failure in payment gateway"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                autoFocus
              />

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  <option value="OPERATIONAL">OPERATIONAL</option>
                  <option value="FINANCIAL">FINANCIAL</option>
                  <option value="PROJECT">PROJECT</option>
                  <option value="MARKETING">MARKETING</option>
                  <option value="MARKET">MARKET</option>
                  <option value="TECHNICAL">TECHNICAL</option>
                  <option value="TEAM">TEAM</option>
                  <option value="STRATEGIC">STRATEGIC</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                    Likelihood (1 - 5)
                  </label>
                  <select
                    value={likelihood}
                    onChange={(e) => setLikelihood(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500"
                  >
                    <option value="1">1 - Rare</option>
                    <option value="2">2 - Unlikely</option>
                    <option value="3">3 - Possible</option>
                    <option value="4">4 - Likely</option>
                    <option value="5">5 - Almost Certain</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                    Impact (1 - 5)
                  </label>
                  <select
                    value={impact}
                    onChange={(e) => setImpact(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500"
                  >
                    <option value="1">1 - Negligible</option>
                    <option value="2">2 - Minor</option>
                    <option value="3">3 - Moderate</option>
                    <option value="4">4 - Major</option>
                    <option value="5">5 - Catastrophic</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                  Mitigation Plan
                </label>
                <textarea
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500"
                  rows={2}
                  placeholder="Actionable steps to mitigate or prevent this risk..."
                  value={mitigationPlan}
                  onChange={(e) => setMitigationPlan(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <Button variant="ghost" size="sm" type="button" onClick={() => setIsAddOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" type="submit" isLoading={isSubmitting}>
                  Log Risk
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
