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
  const [currency, setCurrency] = useState('USD');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isCreateModalOpen) {
      setName('');
      setDescription('');
      setIndustry('');
      setCurrency('USD');
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
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-lg p-6 sm:p-7 shadow-2xl relative my-auto text-left">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-800 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400 shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white leading-tight">Create Startup Workspace</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Set up an isolated multi-tenant workspace for your team and AI agents
              </p>
            </div>
          </div>
          <button
            onClick={() => !isSubmitting && setIsCreateModalOpen(false)}
            className="text-slate-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-slate-800"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs flex items-center gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Input
            label="Startup Name *"
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
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Base Currency
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="INR">INR (₹)</option>
                <option value="CAD">CAD ($)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Description & Mission
            </label>
            <textarea
              className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"
              rows={3}
              placeholder="Describe your startup's core vision and deliverables..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
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
              Create Workspace
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
