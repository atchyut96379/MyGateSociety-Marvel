from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class UnitCreate(BaseModel):
    tower: str = Field(min_length=1, max_length=50)
    flat_number: str = Field(min_length=1, max_length=30)
    floor: int | None = None


class UnitRead(UnitCreate):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ResidentCreate(BaseModel):
    unit_id: int
    name: str = Field(min_length=1, max_length=120)
    phone: str = Field(min_length=5, max_length=30)
    email: str | None = Field(default=None, max_length=255)
    role: Literal["owner", "tenant", "family", "member"] = "member"


class ResidentRead(ResidentCreate):
    id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ResidentImportError(BaseModel):
    row: int | None = None
    message: str


class ResidentImportSummary(BaseModel):
    imported: int
    skipped: int
    created_units: int
    errors: list[ResidentImportError]


class GateCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)


class GateRead(GateCreate):
    id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class GuardCreate(BaseModel):
    gate_id: int
    name: str = Field(min_length=1, max_length=120)
    phone: str = Field(min_length=5, max_length=30)
    employee_code: str = Field(min_length=1, max_length=50)


class GuardRead(GuardCreate):
    id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class VisitorCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    phone: str = Field(min_length=5, max_length=30)
    visitor_type: Literal["guest", "cab", "delivery", "service", "staff"] = "guest"
    company: str | None = Field(default=None, max_length=120)
    vehicle_number: str | None = Field(default=None, max_length=30)


class VisitorRead(VisitorCreate):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class InvitationCreate(BaseModel):
    unit_id: int
    resident_id: int
    visitor: VisitorCreate
    purpose: str = Field(min_length=1, max_length=255)
    valid_minutes: int = Field(default=1440, ge=1, le=10080)
    notes: str | None = None


class InvitationRead(BaseModel):
    id: int
    code: str
    unit_id: int
    resident_id: int
    visitor_id: int
    purpose: str
    valid_from: datetime
    valid_until: datetime
    status: str
    notes: str | None
    visitor: VisitorRead
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CheckInRequest(BaseModel):
    gate_id: int
    guard_id: int
    invitation_code: str | None = Field(default=None, max_length=20)
    unit_id: int | None = None
    visitor: VisitorCreate | None = None
    purpose: str | None = Field(default=None, max_length=255)

    @model_validator(mode="after")
    def require_invitation_or_manual_details(self) -> "CheckInRequest":
        if self.invitation_code:
            return self
        if not self.unit_id or not self.visitor or not self.purpose:
            raise ValueError("Manual check-in requires unit_id, visitor, and purpose.")
        return self


class VisitRead(BaseModel):
    id: int
    invitation_id: int | None
    visitor_id: int
    unit_id: int
    gate_id: int
    guard_id: int
    purpose: str
    status: str
    resident_decision_by: int | None
    resident_decision_at: datetime | None
    checked_in_at: datetime | None
    checked_out_at: datetime | None
    denial_reason: str | None
    visitor: VisitorRead
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class VisitDecisionRequest(BaseModel):
    resident_id: int
    decision: Literal["approved", "denied"]
    reason: str | None = None


class CheckoutRequest(BaseModel):
    guard_id: int


class DeliveryCreate(BaseModel):
    unit_id: int
    resident_id: int | None = None
    courier_name: str = Field(min_length=1, max_length=120)
    tracking_number: str | None = Field(default=None, max_length=120)
    otp_code: str | None = Field(default=None, max_length=20)
    notes: str | None = None


class DeliveryRead(DeliveryCreate):
    id: int
    status: str
    received_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DeliveryReceiveRequest(BaseModel):
    resident_id: int
    otp_code: str | None = Field(default=None, max_length=20)


class ComplaintCreate(BaseModel):
    unit_id: int
    resident_id: int
    title: str = Field(min_length=1, max_length=160)
    description: str = Field(min_length=1)
    category: str = Field(default="general", max_length=60)


class ComplaintRead(ComplaintCreate):
    id: int
    status: str
    assigned_to: str | None
    resolved_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ComplaintStatusUpdate(BaseModel):
    status: Literal["open", "in_progress", "resolved", "closed"]
    assigned_to: str | None = Field(default=None, max_length=120)
