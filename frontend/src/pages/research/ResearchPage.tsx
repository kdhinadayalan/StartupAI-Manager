import React, { useEffect, useState } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { researchApi } from '../../api/research';
import { SwotMatrix, CompetitorIntelligence } from '../../types/research';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import {
  Compass,
  Plus,
  ShieldCheck,
  AlertOctagon,
  Sparkles,
  TrendingUp,
  RefreshCw,
  X,
} from 'lucide-react';

export const ResearchPage: React.FC = () => {
  const { currentWorkspace, currentRole } = useWorkspace();
  const [swot, setSwot] = useState<SwotMatrix | null>(null);
  const [competitors, setCompetitors] = useState<CompetitorIntelligence[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Modal
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [topic, setTopic] = useState('COMPETITOR');
  const [swotCategory, setSwotCategory] = useState('OPPORTUNITY');
  const [competitorName, setCompetitorName] = useState('');
  const [sourceName, setSourceName] = useState('Industry Analysis');
  const [sourceUrl, setSourceUrl] = useState('');
  const [content, setContent] = useState('');
  const [keyFindings, setKeyFindings] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canManage = currentRole === 'OWNER' || currentRole === 'ADMIN' || currentRole === 'MANAGER';

  const fetchData = async () => {
    if (!currentWorkspace) return;
    setIsLoading(true);
    try {
      const [swotData, compData] = await Promise.all([
        researchApi.getSwot(currentWorkspace.id),
        researchApi.getCompetitors(currentWorkspace.id),
      ]);
      setSwot(swotData);
      setCompetitors(compData);
    } catch (err) {
      console.error('Failed to load research data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentWorkspace?.id]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWorkspace || !title.trim() || !content.trim()) return;
    setIsSubmitting(true);
    try {
      await researchApi.createItem(currentWorkspace.id, {
        title: title.trim(),
        topic,
        swot_category: swotCategory,
        competitor_name: competitorName.trim() || undefined,
        source_name: sourceName.trim(),
        source_url: sourceUrl.trim() || undefined,
        content: content.trim(),
        key_findings: keyFindings.trim() || undefined,
      });
      setTitle('');
      setContent('');
      setKeyFindings('');
      setCompetitorName('');
      setIsAddOpen(false);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to save research item.');
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
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Compass className="w-5 h-5 text-sky-500 dark:text-sky-400" />
            Market & Competitor Intelligence
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Structured SWOT synthesis, competitor benchmarking, and verified source-backed intelligence.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={fetchData} isLoading={isLoading}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh
          </Button>
          {canManage && (
            <Button variant="primary" size="sm" onClick={() => setIsAddOpen(true)}>
              <Plus className="w-4 h-4 mr-1.5" /> Add Research
            </Button>
          )}
        </div>
      </div>

      {/* 4-Quadrant SWOT Matrix */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          Startup SWOT Matrix
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Strengths */}
          <div className="bg-emerald-50/40 dark:bg-slate-900/60 border border-emerald-500/30 rounded-xl p-4 space-y-3 shadow-sm dark:shadow-none">
            <div className="flex items-center justify-between text-xs font-bold text-emerald-600 dark:text-emerald-400">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" /> Strengths
              </span>
              <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-[10px]">
                {swot?.STRENGTH.length || 0}
              </span>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {!swot?.STRENGTH.length ? (
                <div className="text-slate-400 dark:text-slate-600 text-xs py-4 text-center">No strengths logged</div>
              ) : (
                swot.STRENGTH.map((s) => (
                  <div key={s.id} className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-transparent p-2.5 rounded-lg text-xs space-y-1 shadow-sm dark:shadow-none">
                    <span className="font-semibold text-slate-900 dark:text-white">{s.title}</span>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">{s.key_findings}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Weaknesses */}
          <div className="bg-amber-50/40 dark:bg-slate-900/60 border border-amber-500/30 rounded-xl p-4 space-y-3 shadow-sm dark:shadow-none">
            <div className="flex items-center justify-between text-xs font-bold text-amber-600 dark:text-amber-400">
              <span className="flex items-center gap-1.5">
                <AlertOctagon className="w-4 h-4" /> Weaknesses
              </span>
              <span className="px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-[10px]">
                {swot?.WEAKNESS.length || 0}
              </span>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {!swot?.WEAKNESS.length ? (
                <div className="text-slate-400 dark:text-slate-600 text-xs py-4 text-center">No weaknesses logged</div>
              ) : (
                swot.WEAKNESS.map((w) => (
                  <div key={w.id} className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-transparent p-2.5 rounded-lg text-xs space-y-1 shadow-sm dark:shadow-none">
                    <span className="font-semibold text-slate-900 dark:text-white">{w.title}</span>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">{w.key_findings}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Opportunities */}
          <div className="bg-sky-50/40 dark:bg-slate-900/60 border border-sky-500/30 rounded-xl p-4 space-y-3 shadow-sm dark:shadow-none">
            <div className="flex items-center justify-between text-xs font-bold text-sky-600 dark:text-sky-400">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" /> Opportunities
              </span>
              <span className="px-1.5 py-0.5 rounded bg-sky-500/10 border border-sky-500/20 text-[10px]">
                {swot?.OPPORTUNITY.length || 0}
              </span>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {!swot?.OPPORTUNITY.length ? (
                <div className="text-slate-400 dark:text-slate-600 text-xs py-4 text-center">No opportunities logged</div>
              ) : (
                swot.OPPORTUNITY.map((o) => (
                  <div key={o.id} className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-transparent p-2.5 rounded-lg text-xs space-y-1 shadow-sm dark:shadow-none">
                    <span className="font-semibold text-slate-900 dark:text-white">{o.title}</span>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">{o.key_findings}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Threats */}
          <div className="bg-rose-50/40 dark:bg-slate-900/60 border border-red-500/30 rounded-xl p-4 space-y-3 shadow-sm dark:shadow-none">
            <div className="flex items-center justify-between text-xs font-bold text-red-600 dark:text-red-400">
              <span className="flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4" /> Threats & Competitors
              </span>
              <span className="px-1.5 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-[10px]">
                {swot?.THREAT.length || 0}
              </span>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {!swot?.THREAT.length ? (
                <div className="text-slate-400 dark:text-slate-600 text-xs py-4 text-center">No threats logged</div>
              ) : (
                swot.THREAT.map((t) => (
                  <div key={t.id} className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-transparent p-2.5 rounded-lg text-xs space-y-1 shadow-sm dark:shadow-none">
                    <span className="font-semibold text-slate-900 dark:text-white">{t.title}</span>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">{t.key_findings}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Competitor Benchmarking */}
      {competitors.length > 0 && (
        <Card title="Competitor Roster" subtitle={`${competitors.length} tracked market competitors`}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {competitors.map((c) => (
              <div key={c.competitor} className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-xl p-4 space-y-2 shadow-sm dark:shadow-none">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 dark:text-white text-sm">{c.competitor}</span>
                  <Badge variant="primary">{c.intelligence_count} items</Badge>
                </div>
                <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-700/40 text-xs text-slate-700 dark:text-slate-300">
                  {c.findings.slice(0, 2).map((f, i) => (
                    <div key={i} className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      • {f.findings}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Add Research Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Add Market Intelligence</h3>
              <button onClick={() => setIsAddOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <Input
                label="Research Title"
                placeholder="e.g. RivalCorp Enterprise Pricing Analysis"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                autoFocus
              />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                    Topic
                  </label>
                  <select
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500"
                  >
                    <option value="COMPETITOR">COMPETITOR</option>
                    <option value="MARKET_TREND">MARKET_TREND</option>
                    <option value="CUSTOMER_INSIGHT">CUSTOMER_INSIGHT</option>
                    <option value="PRICING">PRICING</option>
                    <option value="TECHNOLOGY">TECHNOLOGY</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                    SWOT Quadrant
                  </label>
                  <select
                    value={swotCategory}
                    onChange={(e) => setSwotCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500"
                  >
                    <option value="STRENGTH">STRENGTH</option>
                    <option value="WEAKNESS">WEAKNESS</option>
                    <option value="OPPORTUNITY">OPPORTUNITY</option>
                    <option value="THREAT">THREAT</option>
                    <option value="GENERAL">GENERAL</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Competitor Name"
                  placeholder="e.g. RivalCorp"
                  value={competitorName}
                  onChange={(e) => setCompetitorName(e.target.value)}
                />
                <Input
                  label="Source Reference"
                  placeholder="e.g. Gartner Report 2026"
                  value={sourceName}
                  onChange={(e) => setSourceName(e.target.value)}
                  required
                />
              </div>

              <Input
                label="Source URL (Optional)"
                placeholder="e.g. https://gartner.com/..."
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
              />

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                  Detailed Content / Findings
                </label>
                <textarea
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500"
                  rows={3}
                  placeholder="Key discoveries, pricing models, market gaps..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <Button variant="ghost" size="sm" type="button" onClick={() => setIsAddOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" type="submit" isLoading={isSubmitting}>
                  Save Intelligence
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
