export interface Expense {
  id: string;
  workspace_id: string;
  project_id?: string | null;
  title: string;
  amount: number;
  category: string;
  expense_date: string;
  notes?: string | null;
  created_at: string;
}

export interface Budget {
  id: string;
  workspace_id: string;
  category: string;
  amount: number;
  period: string;
  start_date: string;
}

export interface FinancialAccount {
  id: string;
  workspace_id: string;
  account_name: string;
  current_cash_balance: number;
  currency: string;
  last_updated_at: string;
}

export interface BurnRateData {
  monthly_burn_rate: number;
  total_historical_spend: number;
  period_days: number;
  calculation_method: string;
}

export interface RunwayData {
  has_cash_data: boolean;
  available_cash: number;
  monthly_burn_rate: number;
  runway_months: number | null;
  currency?: string;
  message: string;
}

export interface BudgetComparison {
  category: string;
  budget: number;
  actual: number;
  variance: number;
  percent_used: number;
  is_exceeded: boolean;
}
