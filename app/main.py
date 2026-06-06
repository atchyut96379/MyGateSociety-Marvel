from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
import logging
from pathlib import Path
import secrets

from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db, init_db
from app.models import Complaint, Delivery, Gate, Resident, SecurityGuard, Unit, VisitInvitation, VisitLog, Visitor
from app.schemas import (
    CheckInRequest,
    CheckoutRequest,
    ComplaintCreate,
    ComplaintRead,
    ComplaintStatusUpdate,
    DeliveryCreate,
    DeliveryRead,
    DeliveryReceiveRequest,
    GateCreate,
    GateRead,
    GuardCreate,
    GuardRead,
    InvitationCreate,
    InvitationRead,
    ResidentCreate,
    ResidentRead,
    UnitCreate,
    UnitRead,
    VisitDecisionRequest,
    VisitRead,
    VisitorCreate,
)


logger = logging.getLogger(__name__)
STATIC_DIR = Path(__file__).resolve().parent / "static"


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def commit_or_409(db: Session, detail: str) -> None:
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=detail) from exc


def get_required(db: Session, model: type, object_id: int, name: str):
    obj = db.get(model, object_id)
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"{name} not found.")
    return obj


def get_active_gate_and_guard(db: Session, gate_id: int, guard_id: int) -> tuple[Gate, SecurityGuard]:
    gate = get_required(db, Gate, gate_id, "Gate")
    guard = get_required(db, SecurityGuard, guard_id, "Security guard")
    if not gate.is_active or not guard.is_active:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Gate and guard must be active.")
    if guard.gate_id != gate.id:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Guard is not assigned to this gate.")
    return gate, guard


def assert_resident_belongs_to_unit(resident: Resident, unit_id: int) -> None:
    if resident.unit_id != unit_id:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Resident does not belong to this unit.")


def get_or_create_visitor(db: Session, payload: VisitorCreate) -> Visitor:
    visitor = db.query(Visitor).filter(Visitor.phone == payload.phone).first()
    if visitor:
        visitor.name = payload.name
        visitor.visitor_type = payload.visitor_type
        visitor.company = payload.company
        visitor.vehicle_number = payload.vehicle_number
        return visitor

    visitor = Visitor(**payload.model_dump())
    db.add(visitor)
    db.flush()
    return visitor


def build_invitation_code(db: Session) -> str:
    for _ in range(10):
        code = f"MG{secrets.token_hex(3).upper()}"
        exists = db.query(VisitInvitation.id).filter(VisitInvitation.code == code).first()
        if not exists:
            return code
    raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Could not create invitation code.")


def validate_invitation(invitation: VisitInvitation) -> None:
    current_time = now_utc()
    if invitation.status != "approved":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Invitation is not usable because it is {invitation.status}.",
        )
    if as_utc(invitation.valid_from) > current_time or as_utc(invitation.valid_until) < current_time:
        invitation.status = "expired"
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Invitation has expired or is not yet valid.")


def create_app(init_database: bool | None = None) -> FastAPI:
    settings = get_settings()
    should_init_database = settings.auto_create_tables if init_database is None else init_database

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        if should_init_database:
            init_db()
        yield

    api = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        description="MyGate-style society visitor, delivery, and complaint management API.",
        lifespan=lifespan,
    )

    @api.get("/", tags=["health"])
    def root() -> dict[str, str]:
        return {"message": settings.app_name, "docs": "/docs", "health": "/health", "ui": "/ui"}

    @api.get("/health", tags=["health"])
    def health(db: Session = Depends(get_db)) -> dict[str, str]:
        try:
            db.execute(text("SELECT 1"))
        except Exception as exc:
            logger.exception("Database health check failed.")
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Database unavailable.") from exc
        return {"status": "ok", "database": "ok"}

    @api.post("/api/units", response_model=UnitRead, status_code=status.HTTP_201_CREATED, tags=["admin"])
    def create_unit(payload: UnitCreate, db: Session = Depends(get_db)) -> Unit:
        unit = Unit(**payload.model_dump())
        db.add(unit)
        commit_or_409(db, "A unit with this tower and flat number already exists.")
        db.refresh(unit)
        return unit

    @api.get("/api/units", response_model=list[UnitRead], tags=["admin"])
    def list_units(db: Session = Depends(get_db)) -> list[Unit]:
        return db.query(Unit).order_by(Unit.tower, Unit.flat_number).all()

    @api.post("/api/residents", response_model=ResidentRead, status_code=status.HTTP_201_CREATED, tags=["residents"])
    def create_resident(payload: ResidentCreate, db: Session = Depends(get_db)) -> Resident:
        get_required(db, Unit, payload.unit_id, "Unit")
        resident = Resident(**payload.model_dump())
        db.add(resident)
        commit_or_409(db, "A resident with this phone number already exists.")
        db.refresh(resident)
        return resident

    @api.get("/api/residents", response_model=list[ResidentRead], tags=["residents"])
    def list_residents(unit_id: int | None = None, db: Session = Depends(get_db)) -> list[Resident]:
        query = db.query(Resident)
        if unit_id is not None:
            query = query.filter(Resident.unit_id == unit_id)
        return query.order_by(Resident.name).all()

    @api.post("/api/gates", response_model=GateRead, status_code=status.HTTP_201_CREATED, tags=["security"])
    def create_gate(payload: GateCreate, db: Session = Depends(get_db)) -> Gate:
        gate = Gate(**payload.model_dump())
        db.add(gate)
        commit_or_409(db, "A gate with this name already exists.")
        db.refresh(gate)
        return gate

    @api.get("/api/gates", response_model=list[GateRead], tags=["security"])
    def list_gates(db: Session = Depends(get_db)) -> list[Gate]:
        return db.query(Gate).order_by(Gate.name).all()

    @api.post("/api/guards", response_model=GuardRead, status_code=status.HTTP_201_CREATED, tags=["security"])
    def create_guard(payload: GuardCreate, db: Session = Depends(get_db)) -> SecurityGuard:
        get_required(db, Gate, payload.gate_id, "Gate")
        guard = SecurityGuard(**payload.model_dump())
        db.add(guard)
        commit_or_409(db, "A guard with this phone or employee code already exists.")
        db.refresh(guard)
        return guard

    @api.get("/api/guards", response_model=list[GuardRead], tags=["security"])
    def list_guards(gate_id: int | None = None, db: Session = Depends(get_db)) -> list[SecurityGuard]:
        query = db.query(SecurityGuard)
        if gate_id is not None:
            query = query.filter(SecurityGuard.gate_id == gate_id)
        return query.order_by(SecurityGuard.name).all()

    @api.post(
        "/api/invitations",
        response_model=InvitationRead,
        status_code=status.HTTP_201_CREATED,
        tags=["visitors"],
    )
    def create_invitation(payload: InvitationCreate, db: Session = Depends(get_db)) -> VisitInvitation:
        get_required(db, Unit, payload.unit_id, "Unit")
        resident = get_required(db, Resident, payload.resident_id, "Resident")
        assert_resident_belongs_to_unit(resident, payload.unit_id)
        visitor = get_or_create_visitor(db, payload.visitor)
        valid_from = now_utc()
        invitation = VisitInvitation(
            code=build_invitation_code(db),
            unit_id=payload.unit_id,
            resident_id=payload.resident_id,
            visitor_id=visitor.id,
            purpose=payload.purpose,
            valid_from=valid_from,
            valid_until=valid_from + timedelta(minutes=payload.valid_minutes),
            status="approved",
            notes=payload.notes,
        )
        db.add(invitation)
        commit_or_409(db, "Could not create invitation.")
        db.refresh(invitation)
        return invitation

    @api.get("/api/invitations", response_model=list[InvitationRead], tags=["visitors"])
    def list_invitations(
        unit_id: int | None = None,
        status_filter: str | None = Query(default=None, alias="status"),
        db: Session = Depends(get_db),
    ) -> list[VisitInvitation]:
        query = db.query(VisitInvitation)
        if unit_id is not None:
            query = query.filter(VisitInvitation.unit_id == unit_id)
        if status_filter:
            query = query.filter(VisitInvitation.status == status_filter)
        return query.order_by(VisitInvitation.created_at.desc()).all()

    @api.post("/api/security/check-in", response_model=VisitRead, status_code=status.HTTP_201_CREATED, tags=["security"])
    def check_in(payload: CheckInRequest, db: Session = Depends(get_db)) -> VisitLog:
        get_active_gate_and_guard(db, payload.gate_id, payload.guard_id)
        current_time = now_utc()

        if payload.invitation_code:
            invitation = db.query(VisitInvitation).filter(VisitInvitation.code == payload.invitation_code).first()
            if invitation is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invitation not found.")
            validate_invitation(invitation)
            visit = VisitLog(
                invitation_id=invitation.id,
                visitor_id=invitation.visitor_id,
                unit_id=invitation.unit_id,
                gate_id=payload.gate_id,
                guard_id=payload.guard_id,
                purpose=invitation.purpose,
                status="checked_in",
                resident_decision_by=invitation.resident_id,
                resident_decision_at=current_time,
                checked_in_at=current_time,
            )
        else:
            get_required(db, Unit, payload.unit_id, "Unit")
            visitor = get_or_create_visitor(db, payload.visitor)
            visit = VisitLog(
                visitor_id=visitor.id,
                unit_id=payload.unit_id,
                gate_id=payload.gate_id,
                guard_id=payload.guard_id,
                purpose=payload.purpose,
                status="pending",
            )

        db.add(visit)
        commit_or_409(db, "Could not create visit log.")
        db.refresh(visit)
        return visit

    @api.post("/api/visits/{visit_id}/decision", response_model=VisitRead, tags=["visitors"])
    def decide_visit(visit_id: int, payload: VisitDecisionRequest, db: Session = Depends(get_db)) -> VisitLog:
        visit = get_required(db, VisitLog, visit_id, "Visit")
        resident = get_required(db, Resident, payload.resident_id, "Resident")
        assert_resident_belongs_to_unit(resident, visit.unit_id)

        if visit.status != "pending":
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Only pending visits can be decided.")

        current_time = now_utc()
        visit.resident_decision_by = resident.id
        visit.resident_decision_at = current_time
        if payload.decision == "approved":
            visit.status = "checked_in"
            visit.checked_in_at = current_time
        else:
            visit.status = "denied"
            visit.denial_reason = payload.reason

        db.commit()
        db.refresh(visit)
        return visit

    @api.post("/api/visits/{visit_id}/checkout", response_model=VisitRead, tags=["security"])
    def check_out(visit_id: int, payload: CheckoutRequest, db: Session = Depends(get_db)) -> VisitLog:
        visit = get_required(db, VisitLog, visit_id, "Visit")
        get_required(db, SecurityGuard, payload.guard_id, "Security guard")

        if visit.status != "checked_in":
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Only checked-in visits can be checked out.")

        visit.status = "checked_out"
        visit.checked_out_at = now_utc()
        db.commit()
        db.refresh(visit)
        return visit

    @api.get("/api/visits", response_model=list[VisitRead], tags=["visitors"])
    def list_visits(
        unit_id: int | None = None,
        status_filter: str | None = Query(default=None, alias="status"),
        db: Session = Depends(get_db),
    ) -> list[VisitLog]:
        query = db.query(VisitLog)
        if unit_id is not None:
            query = query.filter(VisitLog.unit_id == unit_id)
        if status_filter:
            query = query.filter(VisitLog.status == status_filter)
        return query.order_by(VisitLog.created_at.desc()).all()

    @api.post(
        "/api/deliveries",
        response_model=DeliveryRead,
        status_code=status.HTTP_201_CREATED,
        tags=["deliveries"],
    )
    def create_delivery(payload: DeliveryCreate, db: Session = Depends(get_db)) -> Delivery:
        get_required(db, Unit, payload.unit_id, "Unit")
        if payload.resident_id is not None:
            resident = get_required(db, Resident, payload.resident_id, "Resident")
            assert_resident_belongs_to_unit(resident, payload.unit_id)
        delivery = Delivery(**payload.model_dump(), status="waiting_at_gate")
        db.add(delivery)
        commit_or_409(db, "Could not create delivery.")
        db.refresh(delivery)
        return delivery

    @api.get("/api/deliveries", response_model=list[DeliveryRead], tags=["deliveries"])
    def list_deliveries(
        unit_id: int | None = None,
        status_filter: str | None = Query(default=None, alias="status"),
        db: Session = Depends(get_db),
    ) -> list[Delivery]:
        query = db.query(Delivery)
        if unit_id is not None:
            query = query.filter(Delivery.unit_id == unit_id)
        if status_filter:
            query = query.filter(Delivery.status == status_filter)
        return query.order_by(Delivery.created_at.desc()).all()

    @api.post("/api/deliveries/{delivery_id}/receive", response_model=DeliveryRead, tags=["deliveries"])
    def receive_delivery(
        delivery_id: int,
        payload: DeliveryReceiveRequest,
        db: Session = Depends(get_db),
    ) -> Delivery:
        delivery = get_required(db, Delivery, delivery_id, "Delivery")
        resident = get_required(db, Resident, payload.resident_id, "Resident")
        assert_resident_belongs_to_unit(resident, delivery.unit_id)

        if delivery.status == "received_by_resident":
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Delivery has already been received.")
        if delivery.otp_code and delivery.otp_code != payload.otp_code:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Delivery OTP is invalid.")

        delivery.status = "received_by_resident"
        delivery.resident_id = resident.id
        delivery.received_at = now_utc()
        db.commit()
        db.refresh(delivery)
        return delivery

    @api.post(
        "/api/complaints",
        response_model=ComplaintRead,
        status_code=status.HTTP_201_CREATED,
        tags=["complaints"],
    )
    def create_complaint(payload: ComplaintCreate, db: Session = Depends(get_db)) -> Complaint:
        get_required(db, Unit, payload.unit_id, "Unit")
        resident = get_required(db, Resident, payload.resident_id, "Resident")
        assert_resident_belongs_to_unit(resident, payload.unit_id)
        complaint = Complaint(**payload.model_dump(), status="open")
        db.add(complaint)
        commit_or_409(db, "Could not create complaint.")
        db.refresh(complaint)
        return complaint

    @api.get("/api/complaints", response_model=list[ComplaintRead], tags=["complaints"])
    def list_complaints(
        unit_id: int | None = None,
        status_filter: str | None = Query(default=None, alias="status"),
        db: Session = Depends(get_db),
    ) -> list[Complaint]:
        query = db.query(Complaint)
        if unit_id is not None:
            query = query.filter(Complaint.unit_id == unit_id)
        if status_filter:
            query = query.filter(Complaint.status == status_filter)
        return query.order_by(Complaint.created_at.desc()).all()

    @api.patch("/api/complaints/{complaint_id}", response_model=ComplaintRead, tags=["complaints"])
    def update_complaint(
        complaint_id: int,
        payload: ComplaintStatusUpdate,
        db: Session = Depends(get_db),
    ) -> Complaint:
        complaint = get_required(db, Complaint, complaint_id, "Complaint")
        complaint.status = payload.status
        complaint.assigned_to = payload.assigned_to
        complaint.resolved_at = now_utc() if payload.status in {"resolved", "closed"} else None
        db.commit()
        db.refresh(complaint)
        return complaint

    api.mount("/ui", StaticFiles(directory=STATIC_DIR, html=True), name="ui")
    return api


app = create_app()
