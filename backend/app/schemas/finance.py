from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class ExpenseCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(..., min_length=1, max_length=255)
    amount: float = Field(..., gt=0)
    category: str = "OPERATIONS"
    project_id: Optional[str] = None
    expense_date: Optional[datetime] = None
    notes: Optional[str] = None


class ExpenseResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="ignore")

    id: str
    workspace_id: str
    project_id: Optional[str] = None
    title: str
    amount: float
    category: str
    expense_date: datetime
    notes: Optional[str] = None
    created_at: datetime


class BudgetCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    category: str
    amount: float = Field(..., gt=0)
    period: str = "MONTHLY"


class BudgetResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="ignore")

    id: str
    workspace_id: str
    category: str
    amount: float
    period: str
    start_date: datetime


class CashBalanceUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    balance: float = Field(..., ge=0)
    currency: str = "USD"


class FinancialAccountResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    workspace_id: str
    account_name: str
    current_cash_balance: float
    currency: str
    last_updated_at: datetime
