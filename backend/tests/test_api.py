"""CivicPulse AI — Comprehensive Test Suite"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base, get_db
from app.main import app
from app.models.report import Report, generate_report_id
from app.services.priority import PriorityService

from sqlalchemy.pool import StaticPool

# In-memory SQLite for isolated tests
SQLALCHEMY_TEST_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base.metadata.create_all(bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)

def test_health():
    """Verify health endpoint reports status ok."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "services" in data
    assert data["services"]["database"] == "available"

def test_public_config():
    """Verify public config endpoint exposes public keys without secrets."""
    response = client.get("/api/v1/config/public")
    assert response.status_code == 200
    data = response.json()
    assert "firebase_configured" in data
    assert "categories" in data or "max_upload_size_mb" in data

def test_create_and_fetch_report():
    """Verify creating a report with valid inputs and retrieving it."""
    payload = {
        "category": "pothole_damaged_road",
        "title": "Massive crater on Bandar Road",
        "description": "Hazardous road depression near bus stand.",
        "observed_severity": "high",
        "is_safety_risk": "true",
        "location_source": "gps",
        "latitude": "16.5062",
        "longitude": "80.6480",
        "location_accuracy_m": "10.0",
        "location_consent": "true",
        "submission_consent": "true",
    }
    response = client.post("/api/v1/reports", data=payload)
    assert response.status_code == 201
    created = response.json()
    assert created["report_id"].startswith("CP-")
    assert created["title"] == payload["title"]
    assert created["is_safety_risk"] is True
    assert created["status"] == "submitted"

    # Fetch report by ID
    fetch_resp = client.get(f"/api/v1/reports/{created['report_id']}")
    assert fetch_resp.status_code == 200
    fetched = fetch_resp.json()
    assert fetched["report_id"] == created["report_id"]
    assert fetched["category"] == "pothole_damaged_road"

def test_report_validation_errors():
    """Verify validation errors on invalid inputs."""
    # Short title
    resp1 = client.post("/api/v1/reports", data={
        "category": "pothole_damaged_road",
        "title": "Hi",
        "submission_consent": "true",
    })
    assert resp1.status_code == 400

    # Invalid category
    resp2 = client.post("/api/v1/reports", data={
        "category": "alien_invasion",
        "title": "Invalid civic category test",
        "submission_consent": "true",
    })
    assert resp2.status_code == 400

    # No consent
    resp3 = client.post("/api/v1/reports", data={
        "category": "garbage_dumping",
        "title": "Garbage dump without citizen consent",
        "submission_consent": "false",
    })
    assert resp3.status_code == 400

def test_priority_calculation():
    """Verify explainable priority engine scoring algorithm."""
    db = TestingSessionLocal()
    rep = Report(
        report_id=generate_report_id(),
        category="sewage_leakage",
        title="Major sewage rupture",
        observed_severity="critical",
        is_safety_risk=True,
        latitude=16.5,
        longitude=80.6,
        location_source="gps",
        location_consent=True,
        submission_consent=True,
    )
    db.add(rep)
    db.commit()

    priority = PriorityService.calculate_priority(rep, db)
    assert priority.total_score >= 60  # Critical + Safety risk gives high score
    assert priority.priority_level in ["high", "critical"]
    db.close()

def test_admin_dashboard_and_status_update():
    """Verify admin endpoints with dev admin auth token."""
    headers = {"Authorization": "Bearer dev-admin-token"}

    # Dashboard stats
    dash_resp = client.get("/api/v1/admin/dashboard", headers=headers)
    assert dash_resp.status_code == 200
    dash_data = dash_resp.json()
    assert "total_reports" in dash_data

    # Create a report to test status update
    create_resp = client.post("/api/v1/reports", data={
        "category": "drainage_overflow",
        "title": "Blocked storm drain near vegetable market",
        "observed_severity": "medium",
        "location_source": "manual",
        "submission_consent": "true",
    })
    rep_id = create_resp.json()["report_id"]

    # Admin updates status
    update_resp = client.post(
        f"/api/v1/admin/reports/{rep_id}/status",
        headers=headers,
        json={
            "status": "in_progress",
            "assigned_authority": "Vijayawada Municipal Corporation",
            "reason": "Inspection team assigned and en route.",
        },
    )
    assert update_resp.status_code == 200

    # Verify report status is now in_progress
    fetch_resp = client.get(f"/api/v1/reports/{rep_id}")
    assert fetch_resp.json()["status"] == "in_progress"
    assert fetch_resp.json()["assigned_authority"] == "Vijayawada Municipal Corporation"
