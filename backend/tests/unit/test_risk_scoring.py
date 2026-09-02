import pytest
from app.services.risk_service import calculate_risk_score


def test_risk_scoring_deterministic_formula():
    # 1. Low risk: 1-4
    score, sev = calculate_risk_score(1, 1)
    assert score == 1
    assert sev == "LOW"

    score, sev = calculate_risk_score(2, 2)
    assert score == 4
    assert sev == "LOW"

    # 2. Medium risk: 5-9
    score, sev = calculate_risk_score(3, 2)
    assert score == 6
    assert sev == "MEDIUM"

    score, sev = calculate_risk_score(3, 3)
    assert score == 9
    assert sev == "MEDIUM"

    # 3. High risk: 10-16
    score, sev = calculate_risk_score(4, 3)
    assert score == 12
    assert sev == "HIGH"

    score, sev = calculate_risk_score(4, 4)
    assert score == 16
    assert sev == "HIGH"

    # 4. Critical risk: 17-25
    score, sev = calculate_risk_score(4, 5)
    assert score == 20
    assert sev == "CRITICAL"

    score, sev = calculate_risk_score(5, 5)
    assert score == 25
    assert sev == "CRITICAL"


def test_risk_scoring_boundary_clamping():
    # Test values outside 1-5 boundary are safely clamped
    score1, sev1 = calculate_risk_score(0, -10)
    assert score1 == 1
    assert sev1 == "LOW"

    score2, sev2 = calculate_risk_score(10, 99)
    assert score2 == 25
    assert sev2 == "CRITICAL"
