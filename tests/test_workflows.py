import os
from io import BytesIO

os.environ["DATABASE_URL"] = "sqlite+pysqlite://"
os.environ["AUTO_CREATE_TABLES"] = "false"

from fastapi.testclient import TestClient
from openpyxl import Workbook
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import create_app


@pytest.fixture()
def client():
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    app = create_app(init_database=False)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as test_client:
        yield test_client

    Base.metadata.drop_all(bind=engine)


def bootstrap_society(client: TestClient) -> dict[str, int]:
    unit = client.post("/api/units", json={"tower": "A", "flat_number": "101", "floor": 1}).json()
    resident = client.post(
        "/api/residents",
        json={
            "unit_id": unit["id"],
            "name": "Asha Rao",
            "phone": "+919999000001",
            "email": "asha@example.com",
            "role": "owner",
        },
    ).json()
    gate = client.post("/api/gates", json={"name": "Main Gate"}).json()
    guard = client.post(
        "/api/guards",
        json={
            "gate_id": gate["id"],
            "name": "Ramesh",
            "phone": "+919999000002",
            "employee_code": "SEC-001",
        },
    ).json()
    return {"unit_id": unit["id"], "resident_id": resident["id"], "gate_id": gate["id"], "guard_id": guard["id"]}


def test_preapproved_visitor_can_check_in_and_out(client: TestClient):
    ids = bootstrap_society(client)

    invitation_response = client.post(
        "/api/invitations",
        json={
            "unit_id": ids["unit_id"],
            "resident_id": ids["resident_id"],
            "purpose": "Dinner",
            "valid_minutes": 60,
            "visitor": {
                "name": "Vikram Shah",
                "phone": "+919999000003",
                "visitor_type": "guest",
                "vehicle_number": "MH12AB1234",
            },
        },
    )

    assert invitation_response.status_code == 201
    invitation = invitation_response.json()
    assert invitation["status"] == "approved"
    assert invitation["code"].startswith("MG")

    check_in_response = client.post(
        "/api/security/check-in",
        json={
            "gate_id": ids["gate_id"],
            "guard_id": ids["guard_id"],
            "invitation_code": invitation["code"],
        },
    )

    assert check_in_response.status_code == 201
    visit = check_in_response.json()
    assert visit["status"] == "checked_in"
    assert visit["checked_in_at"] is not None

    checkout_response = client.post(
        f"/api/visits/{visit['id']}/checkout",
        json={"guard_id": ids["guard_id"]},
    )

    assert checkout_response.status_code == 200
    assert checkout_response.json()["status"] == "checked_out"


def test_ui_is_served(client: TestClient):
    root_response = client.get("/")
    assert root_response.status_code == 200
    assert root_response.json()["ui"] == "/ui"

    ui_response = client.get("/ui/")
    assert ui_response.status_code == 200
    assert "Apartment Management" in ui_response.text


def test_residents_can_be_imported_from_excel(client: TestClient):
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Residents"
    sheet.append(["FlatNumber", "ResidentName", "Phone", "NotificationEmail", "ResidentType", "PropertyOwnerName"])
    sheet.append(["201", "Imported Owner", "+919999100001", "owner@example.com", "Owner", ""])
    sheet.append(["202", "Imported Tenant", "+919999100002", "", "Tenant", "Imported Owner"])
    output = BytesIO()
    workbook.save(output)

    template_response = client.get("/api/residents/import/template")
    assert template_response.status_code == 200
    assert template_response.headers["content-type"].startswith(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )

    import_response = client.post(
        "/api/residents/import?default_tower=B",
        files={
            "file": (
                "residents.xlsx",
                output.getvalue(),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        },
    )

    assert import_response.status_code == 200
    summary = import_response.json()
    assert summary["imported"] == 2
    assert summary["created_units"] == 2
    assert summary["skipped"] == 0

    units = client.get("/api/units").json()
    residents = client.get("/api/residents").json()
    assert {unit["flat_number"] for unit in units} == {"201", "202"}
    assert {resident["name"] for resident in residents} == {"Imported Owner", "Imported Tenant"}


def test_manual_visitor_requires_resident_decision(client: TestClient):
    ids = bootstrap_society(client)

    check_in_response = client.post(
        "/api/security/check-in",
        json={
            "gate_id": ids["gate_id"],
            "guard_id": ids["guard_id"],
            "unit_id": ids["unit_id"],
            "purpose": "Plumbing repair",
            "visitor": {
                "name": "Service Person",
                "phone": "+919999000004",
                "visitor_type": "service",
                "company": "QuickFix",
            },
        },
    )

    assert check_in_response.status_code == 201
    pending_visit = check_in_response.json()
    assert pending_visit["status"] == "pending"
    assert pending_visit["checked_in_at"] is None

    decision_response = client.post(
        f"/api/visits/{pending_visit['id']}/decision",
        json={"resident_id": ids["resident_id"], "decision": "approved"},
    )

    assert decision_response.status_code == 200
    approved_visit = decision_response.json()
    assert approved_visit["status"] == "checked_in"
    assert approved_visit["resident_decision_by"] == ids["resident_id"]


def test_delivery_and_complaint_workflows(client: TestClient):
    ids = bootstrap_society(client)

    delivery_response = client.post(
        "/api/deliveries",
        json={
            "unit_id": ids["unit_id"],
            "courier_name": "ShipFast",
            "tracking_number": "TRK123",
            "otp_code": "4567",
        },
    )

    assert delivery_response.status_code == 201
    delivery = delivery_response.json()
    assert delivery["status"] == "waiting_at_gate"

    wrong_otp_response = client.post(
        f"/api/deliveries/{delivery['id']}/receive",
        json={"resident_id": ids["resident_id"], "otp_code": "0000"},
    )
    assert wrong_otp_response.status_code == 403

    receive_response = client.post(
        f"/api/deliveries/{delivery['id']}/receive",
        json={"resident_id": ids["resident_id"], "otp_code": "4567"},
    )
    assert receive_response.status_code == 200
    assert receive_response.json()["status"] == "received_by_resident"

    complaint_response = client.post(
        "/api/complaints",
        json={
            "unit_id": ids["unit_id"],
            "resident_id": ids["resident_id"],
            "title": "Lift not working",
            "description": "The A tower lift is stuck on the ground floor.",
            "category": "maintenance",
        },
    )
    assert complaint_response.status_code == 201
    complaint = complaint_response.json()
    assert complaint["status"] == "open"

    update_response = client.patch(
        f"/api/complaints/{complaint['id']}",
        json={"status": "resolved", "assigned_to": "Maintenance Team"},
    )
    assert update_response.status_code == 200
    assert update_response.json()["resolved_at"] is not None
