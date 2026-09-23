import React, { useState, useEffect } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Sparkles, X, AlertCircle, Building2 } from 'lucide-react';

export const CreateWorkspaceModal: React.FC = () => {
  const { isCreateModalOpen, setIsCreateModalOpen, createWorkspace } = useWorkspace();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [industry, setIndustry] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isCreateModalOpen) {
      setName('');
      setDescription('');
      setIndustry('');
      setCurrency('INR');
      setError(null);
    }
  }, [isCreateModalOpen]);

  if (!isCreateModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Startup Name is required. Please enter a name.');
      return;
    }

    if (name.trim().length < 2) {
      setError('Startup Name must be at least 2 characters long.');
      return;
    }

    setIsSubmitting(true);
    try {
      await createWorkspace({
        name: name.trim(),
        description: description.trim() || undefined,
        industry: industry.trim() || undefined,
        currency: currency.trim() || 'USD',
      });
      setIsCreateModalOpen(false);
    } catch (err: any) {
      console.error('Failed to create workspace:', err);
      setError(err?.message || 'Failed to create startup workspace. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex min-h-screen items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) {
          setIsCreateModalOpen(false);
        }
      }}
    >
      <div className="bg-white dark:bg-[#252526] border border-slate-200 dark:border-[#2d2d2d] rounded-2xl w-full max-w-lg p-6 sm:p-7 shadow-2xl relative my-auto text-left text-slate-900 dark:text-[#e6edf3]">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-100 dark:border-[#2d2d2d] mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-[#388bfd] shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-[#e6edf3] leading-tight">Initialize Company Workspace</h3>
              <p className="text-xs text-slate-500 dark:text-[#9da7b3] mt-0.5">
                Set up the AI-powered operating system for your company and team
              </p>
            </div>
          </div>
          <button
            onClick={() => !isSubmitting && setIsCreateModalOpen(false)}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-[#e6edf3] transition-colors p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#2a2d2e]"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-500 dark:text-rose-400 text-xs flex items-center gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Input
            label="Company Name *"
            placeholder="e.g. Nexus AI, QuantumStream, Apex Robotics"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (error) setError(null);
            }}
            required
            autoFocus
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Industry"
              placeholder="e.g. Artificial Intelligence, SaaS"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
            />

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-[#9da7b3] mb-1.5">
                Base Currency
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-[#1e1e1e] border border-slate-300 dark:border-[#3c3c3c] rounded-lg text-slate-900 dark:text-[#e6edf3] text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="INR">INR (₹)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="CAD">CAD ($)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-[#9da7b3] mb-1.5">
              Description & Mission
            </label>
            <textarea
              className="w-full px-3.5 py-2.5 bg-white dark:bg-[#1e1e1e] border border-slate-300 dark:border-[#3c3c3c] rounded-lg text-slate-900 dark:text-[#e6edf3] placeholder-slate-400 dark:placeholder-[#6e7681] text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              rows={3}
              placeholder="Describe your company's core vision and deliverables..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-[#2d2d2d]">
            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" isLoading={isSubmitting}>
              <Sparkles className="w-4 h-4 mr-1.5" />
              Initialize Company
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
