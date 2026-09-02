import React, { useEffect, useState } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { marketingApi } from '../../api/marketing';
import { MarketingCampaign, MarketingPerformance } from '../../types/marketing';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import {
  Megaphone,
  Plus,
  TrendingUp,
  MousePointer,
  Target,
  DollarSign,
  AlertTriangle,
  RefreshCw,
  X,
} from 'lucide-react';

export const MarketingPage: React.FC = () => {
  const { currentWorkspace, currentRole } = useWorkspace();
  const [campaigns, setCampaigns] = useState<MarketingCampaign[]>([]);
  const [performance, setPerformance] = useState<MarketingPerformance | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [channel, setChannel] = useState('SOCIAL_MEDIA');
  const [budget, setBudget] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canManage = currentRole === 'OWNER' || currentRole === 'ADMIN' || currentRole === 'MANAGER';

  const fetchData = async () => {
    if (!currentWorkspace) return;
    setIsLoading(true);
    try {
      const [list, perf] = await Promise.all([
        marketingApi.getCampaigns(currentWorkspace.id),
        marketingApi.getPerformance(currentWorkspace.id),
      ]);
      setCampaigns(list);
      setPerformance(perf);
    } catch (err) {
      console.error('Failed to load marketing data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentWorkspace?.id]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWorkspace || !name.trim()) return;
    setIsSubmitting(true);
    try {
      await marketingApi.createCampaign(currentWorkspace.id, {
        name: name.trim(),
        channel,
        budget: budget ? parseFloat(budget) : 0,
        target_audience: targetAudience.trim() || undefined,
      });
      setName('');
      setBudget('');
      setTargetAudience('');
      setIsCreateOpen(false);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to create campaign.');
    } finally {
      setIsSubmitting(false);
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
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-indigo-400" />
            Marketing Campaigns & Performance
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Data-driven acquisition tracking, conversion efficiency, and channel metrics.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={fetchData} isLoading={isLoading}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh
          </Button>
          {canManage && (
            <Button variant="primary" size="sm" onClick={() => setIsCreateOpen(true)}>
              <Plus className="w-4 h-4 mr-1.5" /> New Campaign
            </Button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-1">
          <span className="text-slate-400 text-xs flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5 text-emerald-400" /> Total Ad Spend
          </span>
          <div className="text-2xl font-bold text-white">
            ${performance?.total_spend.toLocaleString() || '0.00'}
          </div>
          <span className="text-[11px] text-slate-500">
            Budget: ${performance?.total_budget.toLocaleString() || '0.00'}
          </span>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-1">
          <span className="text-slate-400 text-xs flex items-center gap-1.5">
            <MousePointer className="w-3.5 h-3.5 text-brand-400" /> Click-Through Rate
          </span>
          <div className="text-2xl font-bold text-white">
            {performance?.overall_ctr || 0.0}%
          </div>
          <span className="text-[11px] text-slate-500">Industry benchmark: 1.5%</span>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-1">
          <span className="text-slate-400 text-xs flex items-center gap-1.5">
            <Target className="w-3.5 h-3.5 text-amber-400" /> Conversion Rate
          </span>
          <div className="text-2xl font-bold text-white">
            {performance?.overall_cvr || 0.0}%
          </div>
          <span className="text-[11px] text-slate-500">From click to lead/user</span>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-1">
          <span className="text-slate-400 text-xs flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-purple-400" /> Blended CAC
          </span>
          <div className="text-2xl font-bold text-white">
            ${performance?.overall_cac || 0.0}
          </div>
          <span className="text-[11px] text-slate-500">Per acquired conversion</span>
        </div>
      </div>

      {/* Underperforming Campaigns Warning Banner if any */}
      {performance?.underperforming_count ? (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <span className="font-bold text-amber-300">
              {performance.underperforming_count} Underperforming Campaign(s) Flagged
            </span>
            <p className="text-slate-300">
              Low CTR (&lt;1%) or spend without conversions detected. Review channel messaging or ask the Marketing Agent for optimization ideas.
            </p>
          </div>
        </div>
      ) : null}

      {/* Campaigns Table */}
      <Card title="Active Campaigns" subtitle={`${campaigns.length} campaigns across acquisition channels`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/60 text-slate-400 uppercase font-semibold border-b border-slate-700/60">
              <tr>
                <th className="py-3 px-4">Campaign</th>
                <th className="py-3 px-4">Channel</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Spend / Budget</th>
                <th className="py-3 px-4">Impressions</th>
                <th className="py-3 px-4">Clicks</th>
                <th className="py-3 px-4">Conversions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {campaigns.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No marketing campaigns configured yet.
                  </td>
                </tr>
              ) : (
                campaigns.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4 font-semibold text-white">{c.name}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-[11px] text-slate-300 border border-slate-700">
                        {c.channel}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={c.status === 'ACTIVE' ? 'success' : 'neutral'}>
                        {c.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <div className="space-y-1">
                        <span className="text-slate-200 font-medium">
                          ${c.spend.toLocaleString()} / ${c.budget.toLocaleString()}
                        </span>
                        <div className="w-24 bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-brand-500 h-full"
                            style={{
                              width: `${c.budget > 0 ? Math.min(100, (c.spend / c.budget) * 100) : 0}%`,
                            }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-400">{c.impressions.toLocaleString()}</td>
                    <td className="py-3 px-4 text-slate-400">{c.clicks.toLocaleString()}</td>
                    <td className="py-3 px-4 font-bold text-emerald-400">{c.conversions}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Create Campaign Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <h3 className="text-base font-bold text-white">Create Marketing Campaign</h3>
              <button onClick={() => setIsCreateOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <Input
                label="Campaign Name"
                placeholder="e.g. Q3 Growth Initiative"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
              />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    Channel
                  </label>
                  <select
                    value={channel}
                    onChange={(e) => setChannel(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500"
                  >
                    <option value="SOCIAL_MEDIA">SOCIAL_MEDIA</option>
                    <option value="SEARCH_ADS">SEARCH_ADS</option>
                    <option value="EMAIL">EMAIL</option>
                    <option value="CONTENT">CONTENT</option>
                    <option value="EVENTS">EVENTS</option>
                  </select>
                </div>

                <Input
                  label="Budget (USD)"
                  type="number"
                  placeholder="e.g. 5000"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                />
              </div>

              <Input
                label="Target Audience"
                placeholder="e.g. B2B Founders & CTOs"
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
              />

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <Button variant="ghost" size="sm" type="button" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" type="submit" isLoading={isSubmitting}>
                  Create Campaign
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
