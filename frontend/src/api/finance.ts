import { apiClient } from './client';
import {
  Expense,
  Budget,
  FinancialAccount,
  BurnRateData,
  RunwayData,
  BudgetComparison,
} from '../types/finance';

export const financeApi = {
  getExpenses: async (workspaceId: string, category?: string): Promise<Expense[]> => {
    const qs = category ? `?category=${category}` : '';
    return apiClient.request<Expense[]>(`/workspaces/${workspaceId}/finance/expenses${qs}`);
  },

  recordExpense: async (
    workspaceId: string,
    payload: { title: string; amount: number; category: string; notes?: string }
  ): Promise<Expense> => {
    return apiClient.request<Expense>(`/workspaces/${workspaceId}/finance/expenses`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  getBudgets: async (workspaceId: string): Promise<Budget[]> => {
    return apiClient.request<Budget[]>(`/workspaces/${workspaceId}/finance/budgets`);
  },

  setBudget: async (
    workspaceId: string,
    payload: { category: string; amount: number; period?: string }
  ): Promise<Budget> => {
    return apiClient.request<Budget>(`/workspaces/${workspaceId}/finance/budgets`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  getAccount: async (workspaceId: string): Promise<FinancialAccount> => {
    return apiClient.request<FinancialAccount>(`/workspaces/${workspaceId}/finance/account`);
  },

  setCash: async (workspaceId: string, balance: number, currency?: string): Promise<FinancialAccount> => {
    return apiClient.request<FinancialAccount>(`/workspaces/${workspaceId}/finance/account`, {
      method: 'POST',
      body: JSON.stringify({ balance, ...(currency ? { currency } : {}) }),
    });
  },

  getBurnRate: async (workspaceId: string): Promise<BurnRateData> => {
    return apiClient.request<BurnRateData>(`/workspaces/${workspaceId}/finance/burn-rate`);
  },

  getRunway: async (workspaceId: string): Promise<RunwayData> => {
    return apiClient.request<RunwayData>(`/workspaces/${workspaceId}/finance/runway`);
  },

  getBudgetComparison: async (workspaceId: string): Promise<BudgetComparison[]> => {
    return apiClient.request<BudgetComparison[]>(`/workspaces/${workspaceId}/finance/budget-comparison`);
  },
};
