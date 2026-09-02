from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database.session import get_db
from app.models.user import User
from app.schemas.common import SuccessResponse
from app.schemas.finance import (
    ExpenseCreate,
    ExpenseResponse,
    BudgetCreate,
    BudgetResponse,
    CashBalanceUpdate,
    FinancialAccountResponse,
)
from app.services.finance_service import (
    create_expense,
    list_expenses,
    set_budget,
    list_budgets,
    set_cash_balance,
    get_or_create_financial_account,
    calculate_monthly_burn_rate,
    calculate_cash_runway,
    compare_budget_vs_actual,
    get_spending_trends,
)

router = APIRouter(prefix="/workspaces/{workspace_id}/finance", tags=["Finance Management"])


@router.get("/expenses", response_model=SuccessResponse[List[ExpenseResponse]])
def get_expenses(
    workspace_id: str,
    category: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    expenses = list_expenses(db, workspace_id, current_user.id, category=category)
    return SuccessResponse(data=expenses)


@router.post("/expenses", response_model=SuccessResponse[ExpenseResponse], status_code=status.HTTP_201_CREATED)
def record_expense(
    workspace_id: str,
    body: ExpenseCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    expense = create_expense(
        db,
        workspace_id=workspace_id,
        user_id=current_user.id,
        title=body.title,
        amount=body.amount,
        category=body.category,
        project_id=body.project_id,
        expense_date=body.expense_date,
        notes=body.notes,
    )
    return SuccessResponse(message="Expense recorded.", data=expense)


@router.get("/budgets", response_model=SuccessResponse[List[BudgetResponse]])
def get_budgets(
    workspace_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    budgets = list_budgets(db, workspace_id, current_user.id)
    return SuccessResponse(data=budgets)


@router.post("/budgets", response_model=SuccessResponse[BudgetResponse])
def configure_budget(
    workspace_id: str,
    body: BudgetCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    budget = set_budget(
        db,
        workspace_id=workspace_id,
        user_id=current_user.id,
        category=body.category,
        amount=body.amount,
        period=body.period,
    )
    return SuccessResponse(message="Budget set.", data=budget)


@router.get("/account", response_model=SuccessResponse[FinancialAccountResponse])
def get_account(
    workspace_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    account = get_or_create_financial_account(db, workspace_id, current_user.id)
    return SuccessResponse(data=account)


@router.post("/account", response_model=SuccessResponse[FinancialAccountResponse])
def update_cash_balance(
    workspace_id: str,
    body: CashBalanceUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    account = set_cash_balance(
        db,
        workspace_id=workspace_id,
        user_id=current_user.id,
        balance=body.balance,
        currency=body.currency,
    )
    return SuccessResponse(message="Cash balance updated.", data=account)


@router.get("/burn-rate", response_model=SuccessResponse[Dict[str, Any]])
def get_burn_rate(
    workspace_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Verify membership
    get_or_create_financial_account(db, workspace_id, current_user.id)
    burn = calculate_monthly_burn_rate(db, workspace_id)
    return SuccessResponse(data=burn)


@router.get("/runway", response_model=SuccessResponse[Dict[str, Any]])
def get_runway(
    workspace_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    get_or_create_financial_account(db, workspace_id, current_user.id)
    runway = calculate_cash_runway(db, workspace_id)
    return SuccessResponse(data=runway)


@router.get("/budget-comparison", response_model=SuccessResponse[List[Dict[str, Any]]])
def get_budget_comparison(
    workspace_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    get_or_create_financial_account(db, workspace_id, current_user.id)
    comparison = compare_budget_vs_actual(db, workspace_id)
    return SuccessResponse(data=comparison)


@router.get("/spending-trends", response_model=SuccessResponse[Dict[str, Any]])
def get_trends(
    workspace_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    get_or_create_financial_account(db, workspace_id, current_user.id)
    trends = get_spending_trends(db, workspace_id)
    return SuccessResponse(data=trends)
