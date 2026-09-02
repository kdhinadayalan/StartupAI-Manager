import pytest
from app.services.dashboard_service import calculate_startup_health_score


def test_health_score_full_data_excellent():
    # 100% delivery, 100% runway (12+ months), 100% risk index (0 risks)
    # (100 * 0.40) + (100 * 0.35) + (100 * 0.25) = 100.0
    res = calculate_startup_health_score(
        delivery_score=100.0,
        runway_score=100.0,
        risk_score=100.0,
    )
    assert res["health_score"] == 100.0
    assert res["grade"] == "EXCELLENT"
    assert res["data_confidence"] == "FULL_DATA"
    assert res["limitation_notice"] is None


def test_health_score_weighted_calculation():
    # Delivery = 80.0, Runway = 60.0, Risk = 40.0
    # (80 * 0.40) + (60 * 0.35) + (40 * 0.25) = 32 + 21 + 10 = 63.0
    res = calculate_startup_health_score(
        delivery_score=80.0,
        runway_score=60.0,
        risk_score=40.0,
    )
    assert res["health_score"] == 63.0
    assert res["grade"] == "CAUTION"
    assert res["breakdown"]["delivery_score"] == 80.0
    assert res["breakdown"]["runway_score"] == 60.0
    assert res["breakdown"]["risk_score"] == 40.0


def test_health_score_missing_runway_data():
    # CRITICAL: Missing cash data should NOT hallucinate 100 score
    # Delivery = 90.0, Runway = None, Risk = 70.0
    # Prorated over delivery (55%) and risk (45%):
    # (90 * 0.55) + (70 * 0.45) = 49.5 + 31.5 = 81.0
    res = calculate_startup_health_score(
        delivery_score=90.0,
        runway_score=None,
        risk_score=70.0,
    )
    assert res["health_score"] == 81.0
    assert res["data_confidence"] == "PARTIAL_DATA"
    assert "Runway information is unavailable" in res["limitation_notice"]
    assert res["breakdown"]["runway_score"] is None


def test_health_score_boundary_clamping():
    # Negative and extreme values clamped to 0 - 100
    res = calculate_startup_health_score(
        delivery_score=-50.0,
        runway_score=250.0,
        risk_score=0.0,
    )
    # (0 * 0.40) + (100 * 0.35) + (0 * 0.25) = 35.0
    assert res["health_score"] == 35.0
    assert res["grade"] == "CRITICAL"
