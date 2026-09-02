import React, { useEffect, useState } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { financeApi } from '../../api/finance';
import {
  Expense,
  FinancialAccount,
  BurnRateData,
  RunwayData,
  BudgetComparison,
} from '../../types/finance';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import {
  DollarSign,
  TrendingDown,
  Clock,
  Plus,
  AlertTriangle,
  Wallet,
  RefreshCw,
  X,
} from 'lucide-react';

export const FinancePage: React.FC = () => {
  const { currentWorkspace, currentRole } = useWorkspace();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [account, setAccount] = useState<FinancialAccount | null>(null);
  const [burnRate, setBurnRate] = useState<BurnRateData | null>(null);
  const [runway, setRunway] = useState<RunwayData | null>(null);
  const [comparisons, setComparisons] = useState<BudgetComparison[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Modals
  const [isExpenseOpen, setIsExpenseOpen] = useState(false);
  const [isCashOpen, setIsCashOpen] = useState(false);

  // Form states
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('OPERATIONS');
  const [cashBalance, setCashBalance] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canManageFinance = currentRole === 'OWNER' || currentRole === 'ADMIN';

  const fetchData = async () => {
    if (!currentWorkspace) return;
    setIsLoading(true);
    try {
      const [expList, accData, burnData, runwayData, compData] = await Promise.all([
        financeApi.getExpenses(currentWorkspace.id),
        financeApi.getAccount(currentWorkspace.id),
        financeApi.getBurnRate(currentWorkspace.id),
        financeApi.getRunway(currentWorkspace.id),
        financeApi.getBudgetComparison(currentWorkspace.id),
      ]);
      setExpenses(expList);
      setAccount(accData);
      setBurnRate(burnData);
      setRunway(runwayData);
      setComparisons(compData);
    } catch (err) {
      console.error('Failed to load finance data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentWorkspace?.id]);

  const handleRecordExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWorkspace || !amount) return;
    setIsSubmitting(true);
    try {
      await financeApi.recordExpense(currentWorkspace.id, {
        title: title.trim(),
        amount: parseFloat(amount),
        category,
      });
      setTitle('');
      setAmount('');
      setIsExpenseOpen(false);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to record expense.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateCash = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWorkspace || !cashBalance) return;
    setIsSubmitting(true);
    try {
      await financeApi.setCash(currentWorkspace.id, parseFloat(cashBalance));
      setCashBalance('');
      setIsCashOpen(false);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to update cash balance.');
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
            <DollarSign className="w-5 h-5 text-emerald-400" />
            Financial Intelligence & Cash Runway
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Deterministic burn rate, cash runway calculations, and category budget enforcement.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={fetchData} isLoading={isLoading}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh
          </Button>
          {canManageFinance && (
            <>
              <Button variant="ghost" size="sm" onClick={() => setIsCashOpen(true)}>
                <Wallet className="w-3.5 h-3.5 mr-1.5" /> Set Cash Balance
              </Button>
              <Button variant="primary" size="sm" onClick={() => setIsExpenseOpen(true)}>
                <Plus className="w-3.5 h-3.5 mr-1.5" /> Record Expense
              </Button>
            </>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5 font-medium">
              <TrendingDown className="w-4 h-4 text-red-400" /> Monthly Burn Rate
            </span>
            <span className="text-[10px] text-slate-500">Trailing 30d</span>
          </div>
          <div className="text-2xl font-bold text-white">
            ${burnRate?.monthly_burn_rate.toLocaleString() || '0.00'}
          </div>
          <div className="text-[11px] text-slate-500">
            Total Spend: ${burnRate?.total_historical_spend.toLocaleString() || '0.00'}
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5 font-medium">
              <Clock className="w-4 h-4 text-amber-400" /> Cash Runway
            </span>
            <Badge variant={runway?.has_cash_data ? 'primary' : 'warning'} className="text-[10px]">
              {runway?.has_cash_data ? 'Verified' : 'Missing Cash'}
            </Badge>
          </div>
          <div className="text-2xl font-bold text-white">
            {runway?.runway_months !== null && runway?.runway_months !== undefined
              ? `${runway.runway_months} Months`
              : 'Unknown'}
          </div>
          <div className="text-[11px] text-slate-400 truncate" title={runway?.message}>
            {runway?.message}
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5 font-medium">
              <Wallet className="w-4 h-4 text-emerald-400" /> Liquid Cash Available
            </span>
            <span className="text-[10px] text-slate-500">{account?.currency || 'USD'}</span>
          </div>
          <div className="text-2xl font-bold text-emerald-400">
            ${account?.current_cash_balance.toLocaleString() || '0.00'}
          </div>
          <div className="text-[11px] text-slate-500">
            Last Updated:{' '}
            {account?.last_updated_at
              ? new Date(account.last_updated_at).toLocaleDateString()
              : 'Never'}
          </div>
        </div>
      </div>

      {/* Budget vs Actual Breakdown */}
      <Card title="Budget vs. Actual Variance" subtitle="Real-time category spending against allocated budgets">
        {comparisons.length === 0 ? (
          <div className="text-center py-6 text-xs text-slate-500">
            No budgets configured. Add budgets to track category variances.
          </div>
        ) : (
          <div className="space-y-4">
            {comparisons.map((c) => (
              <div key={c.category} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-white flex items-center gap-2">
                    {c.category}
                    {c.is_exceeded && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 font-bold flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Exceeded by ${Math.abs(c.variance).toLocaleString()}
                      </span>
                    )}
                  </span>
                  <span className="text-slate-400">
                    ${c.actual.toLocaleString()} / ${c.budget.toLocaleString()} ({c.percent_used}%)
                  </span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      c.is_exceeded ? 'bg-red-500' : c.percent_used > 80 ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(100, c.percent_used)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Expenses Ledger */}
      <Card title="Expenses Ledger" subtitle={`${expenses.length} recorded operational expenses`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/60 text-slate-400 uppercase font-semibold border-b border-slate-700/60">
              <tr>
                <th className="py-3 px-4">Title</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {expenses.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-500">
                    No expenses recorded yet.
                  </td>
                </tr>
              ) : (
                expenses.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4 font-semibold text-white">{e.title}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-[11px] text-slate-300 border border-slate-700">
                        {e.category}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-bold text-red-400">
                      -${e.amount.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      {new Date(e.expense_date).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Record Expense Modal */}
      {isExpenseOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <h3 className="text-base font-bold text-white">Record Operational Expense</h3>
              <button onClick={() => setIsExpenseOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRecordExpense} className="space-y-4">
              <Input
                label="Expense Title"
                placeholder="e.g. AWS Cloud Cluster"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                autoFocus
              />

              <Input
                label="Amount (USD)"
                type="number"
                placeholder="e.g. 1500"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  <option value="PAYROLL">PAYROLL</option>
                  <option value="INFRASTRUCTURE">INFRASTRUCTURE</option>
                  <option value="MARKETING">MARKETING</option>
                  <option value="SOFTWARE">SOFTWARE</option>
                  <option value="OPERATIONS">OPERATIONS</option>
                  <option value="LEGAL">LEGAL</option>
                  <option value="OTHER">OTHER</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <Button variant="ghost" size="sm" type="button" onClick={() => setIsExpenseOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" type="submit" isLoading={isSubmitting}>
                  Record Expense
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Set Cash Modal */}
      {isCashOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <h3 className="text-base font-bold text-white">Update Liquid Cash Treasury</h3>
              <button onClick={() => setIsCashOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateCash} className="space-y-4">
              <Input
                label="Available Liquid Cash (USD)"
                type="number"
                placeholder="e.g. 250000"
                value={cashBalance}
                onChange={(e) => setCashBalance(e.target.value)}
                required
                autoFocus
              />
              <p className="text-[11px] text-slate-500">
                Used to compute exact runway months: Available Cash / Monthly Burn Rate.
              </p>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <Button variant="ghost" size="sm" type="button" onClick={() => setIsCashOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" type="submit" isLoading={isSubmitting}>
                  Update Balance
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
