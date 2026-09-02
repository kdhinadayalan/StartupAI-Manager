import pytest
from datetime import timedelta
from sqlalchemy.orm import Session

from app.database.base import utc_now
from app.models.finance import Expense, Budget, FinancialAccount
from app.models.workspace import Workspace
from app.models.user import User
from app.services.finance_service import (
    calculate_monthly_burn_rate,
    calculate_cash_runway,
    compare_budget_vs_actual,
    get_spending_trends,
)


def test_deterministic_burn_rate_and_missing_cash_runway(db: Session):
    # Setup test workspace
    user = User(email="fin_test@startup.io", hashed_password="pw", full_name="Fin User")
    db.add(user)
    db.flush()

    ws = Workspace(name="Finance Test WS", owner_id=user.id)
    db.add(ws)
    db.flush()

    # 1. No expenses yet
    burn1 = calculate_monthly_burn_rate(db, ws.id)
    assert burn1["monthly_burn_rate"] == 0.0

    # 2. Runway when cash balance is not provided -> Do NOT guess!
    runway1 = calculate_cash_runway(db, ws.id)
    assert runway1["has_cash_data"] is False
    assert runway1["runway_months"] is None
    assert "cannot calculate runway because available cash balance has not been provided" in runway1["message"]

    # 3. Add expenses (e.g. $10,000 payroll, $2,000 software)
    now = utc_now()
    e1 = Expense(workspace_id=ws.id, title="Payroll", amount=10000.0, category="PAYROLL", expense_date=now)
    e2 = Expense(workspace_id=ws.id, title="AWS", amount=2000.0, category="INFRASTRUCTURE", expense_date=now)
    db.add_all([e1, e2])
    db.commit()

    burn2 = calculate_monthly_burn_rate(db, ws.id)
    assert burn2["monthly_burn_rate"] == 12000.0

    # 4. Configure cash account ($60,000)
    account = FinancialAccount(workspace_id=ws.id, current_cash_balance=60000.0, currency="USD")
    db.add(account)
    db.commit()

    runway2 = calculate_cash_runway(db, ws.id)
    assert runway2["has_cash_data"] is True
    # 60000 / 12000 = 5.0 months
    assert runway2["runway_months"] == 5.0
    assert "5.0 months of runway" in runway2["message"]


def test_budget_vs_actual_and_spending_trends(db: Session):
    user = User(email="budget_test@startup.io", hashed_password="pw", full_name="Budget User")
    db.add(user)
    db.flush()

    ws = Workspace(name="Budget Test WS", owner_id=user.id)
    db.add(ws)
    db.flush()

    # Budgets: $5,000 Marketing, $15,000 Payroll
    b1 = Budget(workspace_id=ws.id, category="MARKETING", amount=5000.0)
    b2 = Budget(workspace_id=ws.id, category="PAYROLL", amount=15000.0)
    db.add_all([b1, b2])

    # Expenses: Marketing spent $6,500 (exceeded!), Payroll spent $12,000 (under budget)
    e1 = Expense(workspace_id=ws.id, title="Google Ads", amount=6500.0, category="MARKETING")
    e2 = Expense(workspace_id=ws.id, title="Engineers", amount=12000.0, category="PAYROLL")
    db.add_all([e1, e2])
    db.commit()

    comparison = compare_budget_vs_actual(db, ws.id)
    mkt = next(c for c in comparison if c["category"] == "MARKETING")
    assert mkt["is_exceeded"] is True
    assert mkt["variance"] == -1500.0
    assert mkt["percent_used"] == 130.0

    pay = next(c for c in comparison if c["category"] == "PAYROLL")
    assert pay["is_exceeded"] is False
    assert pay["variance"] == 3000.0
    assert pay["percent_used"] == 80.0

    trends = get_spending_trends(db, ws.id)
    assert trends["total_spend"] == 18500.0
    assert trends["highest_spending_category"] == "PAYROLL"
    assert trends["highest_spending_amount"] == 12000.0
