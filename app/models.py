from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship

from app.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class TimestampMixin:
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)


class Unit(TimestampMixin, Base):
    __tablename__ = "units"
    __table_args__ = (UniqueConstraint("tower", "flat_number", name="uq_units_tower_flat"),)

    id = Column(Integer, primary_key=True, index=True)
    tower = Column(String(50), nullable=False)
    flat_number = Column(String(30), nullable=False)
    floor = Column(Integer, nullable=True)

    residents = relationship("Resident", back_populates="unit")
    invitations = relationship("VisitInvitation", back_populates="unit")
    visits = relationship("VisitLog", back_populates="unit")
    deliveries = relationship("Delivery", back_populates="unit")
    complaints = relationship("Complaint", back_populates="unit")


class Resident(TimestampMixin, Base):
    __tablename__ = "residents"

    id = Column(Integer, primary_key=True, index=True)
    unit_id = Column(Integer, ForeignKey("units.id"), nullable=False)
    name = Column(String(120), nullable=False)
    phone = Column(String(30), nullable=False, unique=True, index=True)
    email = Column(String(255), nullable=True)
    role = Column(String(30), nullable=False, default="member")
    is_active = Column(Boolean, nullable=False, default=True)

    unit = relationship("Unit", back_populates="residents")
    invitations = relationship("VisitInvitation", back_populates="resident")
    deliveries = relationship("Delivery", back_populates="resident")
    complaints = relationship("Complaint", back_populates="resident")


class Gate(TimestampMixin, Base):
    __tablename__ = "gates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(80), nullable=False, unique=True)
    is_active = Column(Boolean, nullable=False, default=True)

    guards = relationship("SecurityGuard", back_populates="gate")
    visits = relationship("VisitLog", back_populates="gate")


class SecurityGuard(TimestampMixin, Base):
    __tablename__ = "security_guards"

    id = Column(Integer, primary_key=True, index=True)
    gate_id = Column(Integer, ForeignKey("gates.id"), nullable=False)
    name = Column(String(120), nullable=False)
    phone = Column(String(30), nullable=False, unique=True)
    employee_code = Column(String(50), nullable=False, unique=True)
    is_active = Column(Boolean, nullable=False, default=True)

    gate = relationship("Gate", back_populates="guards")
    visits = relationship("VisitLog", back_populates="guard")


class Visitor(TimestampMixin, Base):
    __tablename__ = "visitors"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False)
    phone = Column(String(30), nullable=False, unique=True, index=True)
    visitor_type = Column(String(40), nullable=False, default="guest")
    company = Column(String(120), nullable=True)
    vehicle_number = Column(String(30), nullable=True)

    invitations = relationship("VisitInvitation", back_populates="visitor")
    visits = relationship("VisitLog", back_populates="visitor")


class VisitInvitation(TimestampMixin, Base):
    __tablename__ = "visit_invitations"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(20), nullable=False, unique=True, index=True)
    unit_id = Column(Integer, ForeignKey("units.id"), nullable=False)
    resident_id = Column(Integer, ForeignKey("residents.id"), nullable=False)
    visitor_id = Column(Integer, ForeignKey("visitors.id"), nullable=False)
    purpose = Column(String(255), nullable=False)
    valid_from = Column(DateTime(timezone=True), nullable=False)
    valid_until = Column(DateTime(timezone=True), nullable=False)
    status = Column(String(30), nullable=False, default="approved")
    notes = Column(Text, nullable=True)

    unit = relationship("Unit", back_populates="invitations")
    resident = relationship("Resident", back_populates="invitations")
    visitor = relationship("Visitor", back_populates="invitations")
    visits = relationship("VisitLog", back_populates="invitation")


class VisitLog(TimestampMixin, Base):
    __tablename__ = "visit_logs"

    id = Column(Integer, primary_key=True, index=True)
    invitation_id = Column(Integer, ForeignKey("visit_invitations.id"), nullable=True)
    visitor_id = Column(Integer, ForeignKey("visitors.id"), nullable=False)
    unit_id = Column(Integer, ForeignKey("units.id"), nullable=False)
    gate_id = Column(Integer, ForeignKey("gates.id"), nullable=False)
    guard_id = Column(Integer, ForeignKey("security_guards.id"), nullable=False)
    purpose = Column(String(255), nullable=False)
    status = Column(String(30), nullable=False, default="pending")
    resident_decision_by = Column(Integer, ForeignKey("residents.id"), nullable=True)
    resident_decision_at = Column(DateTime(timezone=True), nullable=True)
    checked_in_at = Column(DateTime(timezone=True), nullable=True)
    checked_out_at = Column(DateTime(timezone=True), nullable=True)
    denial_reason = Column(Text, nullable=True)

    invitation = relationship("VisitInvitation", back_populates="visits")
    visitor = relationship("Visitor", back_populates="visits")
    unit = relationship("Unit", back_populates="visits")
    gate = relationship("Gate", back_populates="visits")
    guard = relationship("SecurityGuard", back_populates="visits")


class Delivery(TimestampMixin, Base):
    __tablename__ = "deliveries"

    id = Column(Integer, primary_key=True, index=True)
    unit_id = Column(Integer, ForeignKey("units.id"), nullable=False)
    resident_id = Column(Integer, ForeignKey("residents.id"), nullable=True)
    courier_name = Column(String(120), nullable=False)
    tracking_number = Column(String(120), nullable=True)
    otp_code = Column(String(20), nullable=True)
    status = Column(String(30), nullable=False, default="waiting_at_gate")
    received_at = Column(DateTime(timezone=True), nullable=True)
    notes = Column(Text, nullable=True)

    unit = relationship("Unit", back_populates="deliveries")
    resident = relationship("Resident", back_populates="deliveries")


class Complaint(TimestampMixin, Base):
    __tablename__ = "complaints"

    id = Column(Integer, primary_key=True, index=True)
    unit_id = Column(Integer, ForeignKey("units.id"), nullable=False)
    resident_id = Column(Integer, ForeignKey("residents.id"), nullable=False)
    title = Column(String(160), nullable=False)
    description = Column(Text, nullable=False)
    category = Column(String(60), nullable=False, default="general")
    status = Column(String(30), nullable=False, default="open")
    assigned_to = Column(String(120), nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)

    unit = relationship("Unit", back_populates="complaints")
    resident = relationship("Resident", back_populates="complaints")
