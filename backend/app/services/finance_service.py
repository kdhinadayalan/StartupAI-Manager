import html
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.permissions import Role, Permission, check_role_permission
from app.database.base import utc_now
from app.models.finance import Expense, Budget, FinancialAccount, ExpenseCategory, BudgetPeriod
from app.models.workspace import Workspace
from app.services.workspace_service import get_member_membership
from app.services.audit_service import log_audit_event


def get_or_create_financial_account(
    db: Session,
    workspace_id: str,
    user_id: str,
) -> FinancialAccount:
    """Get the primary treasury account for the workspace or initialize one."""
    membership = get_member_membership(db, workspace_id, user_id)
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found or access denied.",
        )

    account = db.execute(
        select(FinancialAccount).where(FinancialAccount.workspace_id == workspace_id)
    ).scalar_one_or_none()

    if not account:
        ws = db.execute(select(Workspace).where(Workspace.id == workspace_id)).scalar_one_or_none()
        ws_currency = ws.currency if ws and ws.currency else "INR"
        account = FinancialAccount(
            workspace_id=workspace_id,
            account_name="Primary Treasury",
            current_cash_balance=0.0,
            currency=ws_currency,
        )
        db.add(account)
        db.commit()
        db.refresh(account)

    return account


def set_cash_balance(
    db: Session,
    workspace_id: str,
    user_id: str,
    balance: float,
    currency: str = "USD",
) -> FinancialAccount:
    """Set available liquid cash balance (Requires FINANCE_UPDATE)."""
    membership = get_member_membership(db, workspace_id, user_id)
    if not membership:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found.")
    if not check_role_permission(Role(membership.role), Permission.FINANCE_UPDATE):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied to update finance.")

    account = get_or_create_financial_account(db, workspace_id, user_id)
    account.current_cash_balance = balance
    ws = db.execute(select(Workspace).where(Workspace.id == workspace_id)).scalar_one_or_none()
    target_currency = currency if (currency and currency != "USD") else (account.currency or (ws.currency if ws else "INR"))
    account.currency = target_currency
    account.last_updated_at = utc_now()
    db.commit()
    db.refresh(account)
    return account


def create_expense(
    db: Session,
    workspace_id: str,
    user_id: str,
    title: str,
    amount: float,
    category: str = ExpenseCategory.OPERATIONS.value,
    project_id: Optional[str] = None,
    expense_date: Optional[datetime] = None,
    notes: Optional[str] = None,
) -> Expense:
    """Record an operational expense."""
    membership = get_member_membership(db, workspace_id, user_id)
    if not membership:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found.")
    if not check_role_permission(Role(membership.role), Permission.FINANCE_CREATE):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied to create expenses.")

    if amount <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Expense amount must be positive.")

    expense = Expense(
        workspace_id=workspace_id,
        project_id=project_id,
        title=html.escape(title.strip()),
        amount=amount,
        category=category,
        expense_date=expense_date or utc_now(),
        created_by_id=user_id,
        notes=html.escape(notes.strip()) if notes else None,
    )
    db.add(expense)
    db.commit()
    db.refresh(expense)

    # Check for budget overrun and dispatch notification if exceeded
    budget = db.execute(
        select(Budget).where(Budget.workspace_id == workspace_id, Budget.category == category)
    ).scalar_one_or_none()
    if budget and budget.amount > 0:
        total_spent = db.execute(
            select(func.coalesce(func.sum(Expense.amount), 0.0)).where(
                Expense.workspace_id == workspace_id,
                Expense.category == category,
            )
        ).scalar_one()
        if float(total_spent) > budget.amount:
            from app.services.notification_service import create_notification
            create_notification(
                db=db,
                workspace_id=workspace_id,
                type="BUDGET_OVERRUN",
                severity="WARNING",
                title=f"Budget Exceeded in {category}",
                message=f"Category '{category}' spending (${float(total_spent):,.2f}) exceeded allocated budget (${budget.amount:,.2f}).",
                link="/finance",
                resource_type="expense",
                resource_id=expense.id,
                event_key=f"OVERRUN:{workspace_id}:{category}",
            )

    return expense


def list_expenses(
    db: Session,
    workspace_id: str,
    user_id: str,
    category: Optional[str] = None,
    limit: int = 100,
) -> List[Expense]:
    """List recorded expenses for a workspace."""
    membership = get_member_membership(db, workspace_id, user_id)
    if not membership:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found.")

    query = select(Expense).where(Expense.workspace_id == workspace_id)
    if category:
        query = query.where(Expense.category == category)
    query = query.order_by(Expense.expense_date.desc()).limit(limit)
    return list(db.execute(query).scalars().all())


def set_budget(
    db: Session,
    workspace_id: str,
    user_id: str,
    category: str,
    amount: float,
    period: str = BudgetPeriod.MONTHLY.value,
) -> Budget:
    """Set category budget target."""
    membership = get_member_membership(db, workspace_id, user_id)
    if not membership:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found.")
    if not check_role_permission(Role(membership.role), Permission.FINANCE_UPDATE):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied to set budget.")

    budget = db.execute(
        select(Budget).where(
            Budget.workspace_id == workspace_id,
            Budget.category == category,
        )
    ).scalar_one_or_none()

    if budget:
        budget.amount = amount
        budget.period = period
    else:
        budget = Budget(
            workspace_id=workspace_id,
            category=category,
            amount=amount,
            period=period,
        )
        db.add(budget)

    db.commit()
    db.refresh(budget)
    return budget


def list_budgets(db: Session, workspace_id: str, user_id: str) -> List[Budget]:
    membership = get_member_membership(db, workspace_id, user_id)
    if not membership:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found.")

    return list(db.execute(select(Budget).where(Budget.workspace_id == workspace_id)).scalars().all())


# =========================================================================
# DETERMINISTIC FINANCIAL CALCULATIONS
# =========================================================================

def calculate_monthly_burn_rate(db: Session, workspace_id: str) -> Dict[str, Any]:
    """
    Deterministic Monthly Burn Rate calculation:
    Calculates total operating expenses incurred in the last 30 days.
    If no expenses in the last 30 days, calculates all-time average monthly burn.
    """
    now = utc_now()
    thirty_days_ago = now - timedelta(days=30)

    # 30-day window
    recent_spend = db.execute(
        select(func.coalesce(func.sum(Expense.amount), 0.0)).where(
            Expense.workspace_id == workspace_id,
            Expense.expense_date >= thirty_days_ago,
        )
    ).scalar_one()

    # Total spend
    total_spend = db.execute(
        select(func.coalesce(func.sum(Expense.amount), 0.0)).where(
            Expense.workspace_id == workspace_id,
        )
    ).scalar_one()

    # Determine burn rate
    burn_rate = float(recent_spend) if recent_spend > 0 else float(total_spend)

    return {
        "monthly_burn_rate": round(burn_rate, 2),
        "total_historical_spend": round(float(total_spend), 2),
        "period_days": 30,
        "calculation_method": "deterministic_trailing_30_days" if recent_spend > 0 else "total_historical",
    }


def calculate_cash_runway(db: Session, workspace_id: str) -> Dict[str, Any]:
    """
    Deterministic Cash Runway calculation:
    Runway = Available Cash / Monthly Burn Rate.
    If available cash balance has not been provided, does NOT guess; returns structured notification.
    """
    account = db.execute(
        select(FinancialAccount).where(FinancialAccount.workspace_id == workspace_id)
    ).scalar_one_or_none()

    burn_data = calculate_monthly_burn_rate(db, workspace_id)
    monthly_burn = burn_data["monthly_burn_rate"]

    if not account or account.current_cash_balance <= 0:
        return {
            "has_cash_data": False,
            "available_cash": 0.0,
            "monthly_burn_rate": monthly_burn,
            "runway_months": None,
            "message": "I cannot calculate runway because available cash balance has not been provided.",
        }

    if monthly_burn <= 0:
        return {
            "has_cash_data": True,
            "available_cash": account.current_cash_balance,
            "monthly_burn_rate": 0.0,
            "runway_months": None,
            "message": "Zero monthly burn rate detected; cash runway is effectively indefinite.",
        }

    runway_months = round(account.current_cash_balance / monthly_burn, 1)

    return {
        "has_cash_data": True,
        "available_cash": account.current_cash_balance,
        "monthly_burn_rate": monthly_burn,
        "runway_months": runway_months,
        "currency": account.currency,
        "message": f"At the current burn rate of ${monthly_burn:,.2f}/mo, available cash (${account.current_cash_balance:,.2f}) provides approximately {runway_months} months of runway.",
    }


def compare_budget_vs_actual(db: Session, workspace_id: str) -> List[Dict[str, Any]]:
    """
    Deterministic Budget vs Actual analysis:
    Groups actual expenses by category and compares with allocated budgets.
    """
    budgets = db.execute(
        select(Budget).where(Budget.workspace_id == workspace_id)
    ).scalars().all()

    # Aggregate expenses by category
    expense_rows = db.execute(
        select(Expense.category, func.coalesce(func.sum(Expense.amount), 0.0))
        .where(Expense.workspace_id == workspace_id)
        .group_by(Expense.category)
    ).all()
    expense_map = {cat: float(amt) for cat, amt in expense_rows}

    comparisons = []
    seen_categories = set()

    for b in budgets:
        seen_categories.add(b.category)
        actual = expense_map.get(b.category, 0.0)
        variance = round(b.amount - actual, 2)
        pct = round((actual / b.amount * 100), 1) if b.amount > 0 else 0.0
        comparisons.append({
            "category": b.category,
            "budget": b.amount,
            "actual": actual,
            "variance": variance,
            "percent_used": pct,
            "is_exceeded": actual > b.amount,
        })

    # Any category with expenses but no budget defined
    for cat, actual in expense_map.items():
        if cat not in seen_categories:
            comparisons.append({
                "category": cat,
                "budget": 0.0,
                "actual": actual,
                "variance": -actual,
                "percent_used": 100.0 if actual > 0 else 0.0,
                "is_exceeded": True,
            })

    return comparisons


def get_spending_trends(db: Session, workspace_id: str) -> Dict[str, Any]:
    """
    Deterministic Spending Trends analysis:
    Calculates category-wise spending distribution and top expenditure area.
    """
    expense_rows = db.execute(
        select(Expense.category, func.coalesce(func.sum(Expense.amount), 0.0))
        .where(Expense.workspace_id == workspace_id)
        .group_by(Expense.category)
    ).all()

    total = sum(float(amt) for _, amt in expense_rows)
    breakdown = []
    top_category = None
    top_amount = 0.0

    for cat, amt in expense_rows:
        val = float(amt)
        pct = round((val / total * 100), 1) if total > 0 else 0.0
        breakdown.append({"category": cat, "amount": val, "percentage": pct})
        if val > top_amount:
            top_amount = val
            top_category = cat

    return {
        "total_spend": round(total, 2),
        "breakdown": breakdown,
        "highest_spending_category": top_category or "None",
        "highest_spending_amount": round(top_amount, 2),
    }
