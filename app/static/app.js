const message = document.querySelector("#message");

const lists = {
  units: document.querySelector("#units-list"),
  residents: document.querySelector("#residents-list"),
  gates: document.querySelector("#gates-list"),
  guards: document.querySelector("#guards-list"),
  invitations: document.querySelector("#invitations-list"),
  visits: document.querySelector("#visits-list"),
  deliveries: document.querySelector("#deliveries-list"),
  complaints: document.querySelector("#complaints-list"),
};

const counts = {
  units: document.querySelector("#unit-count"),
  residents: document.querySelector("#resident-count"),
  activeVisits: document.querySelector("#active-visit-count"),
  openComplaints: document.querySelector("#open-complaint-count"),
};

function formData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function numberOrNull(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  return Number(value);
}

function emptyToNull(value) {
  return value === undefined || value === "" ? null : value;
}

function showMessage(text, isError = false) {
  message.textContent = text;
  message.classList.add("visible");
  message.classList.toggle("error", isError);
}

async function request(path, options = {}) {
  const response = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = body?.detail;
    const text = Array.isArray(detail)
      ? detail.map((item) => item.msg || JSON.stringify(item)).join("; ")
      : detail || response.statusText;
    throw new Error(text);
  }
  return body;
}

function renderList(container, records, renderer) {
  if (!records.length) {
    container.innerHTML = '<p class="empty">No records yet.</p>';
    return;
  }
  container.innerHTML = records.map(renderer).join("");
}

function record(title, lines) {
  return `
    <div class="record">
      <strong>${title}</strong>
      ${lines.map((line) => `<small>${line}</small>`).join("")}
    </div>
  `;
}

async function loadData() {
  const [units, residents, gates, guards, invitations, visits, deliveries, complaints] = await Promise.all([
    request("/api/units"),
    request("/api/residents"),
    request("/api/gates"),
    request("/api/guards"),
    request("/api/invitations"),
    request("/api/visits"),
    request("/api/deliveries"),
    request("/api/complaints"),
  ]);

  counts.units.textContent = units.length;
  counts.residents.textContent = residents.length;
  counts.activeVisits.textContent = visits.filter((visit) => visit.status === "checked_in").length;
  counts.openComplaints.textContent = complaints.filter((complaint) => complaint.status !== "resolved").length;

  renderList(lists.units, units, (unit) =>
    record(`Unit #${unit.id}`, [`Tower ${unit.tower}, Flat ${unit.flat_number}`, `Floor: ${unit.floor ?? "-"}`]),
  );
  renderList(lists.residents, residents, (resident) =>
    record(`Resident #${resident.id}: ${resident.name}`, [
      `Unit ID: ${resident.unit_id}`,
      `Phone: ${resident.phone}`,
      `Role: ${resident.role}`,
    ]),
  );
  renderList(lists.gates, gates, (gate) =>
    record(`Gate #${gate.id}: ${gate.name}`, [`Active: ${gate.is_active ? "yes" : "no"}`]),
  );
  renderList(lists.guards, guards, (guard) =>
    record(`Guard #${guard.id}: ${guard.name}`, [
      `Gate ID: ${guard.gate_id}`,
      `Phone: ${guard.phone}`,
      `Employee code: ${guard.employee_code}`,
    ]),
  );
  renderList(lists.invitations, invitations, (invitation) =>
    record(`Invitation #${invitation.id}: ${invitation.code}`, [
      `Unit ID: ${invitation.unit_id}`,
      `Visitor: ${invitation.visitor.name}`,
      `Purpose: ${invitation.purpose}`,
      `Status: ${invitation.status}`,
    ]),
  );
  renderList(lists.visits, visits, (visit) =>
    record(`Visit #${visit.id}: ${visit.status}`, [
      `Unit ID: ${visit.unit_id}`,
      `Visitor: ${visit.visitor.name}`,
      `Purpose: ${visit.purpose}`,
      `Checked in: ${visit.checked_in_at || "-"}`,
    ]),
  );
  renderList(lists.deliveries, deliveries, (delivery) =>
    record(`Delivery #${delivery.id}: ${delivery.status}`, [
      `Unit ID: ${delivery.unit_id}`,
      `Courier: ${delivery.courier_name}`,
      `Tracking: ${delivery.tracking_number || "-"}`,
    ]),
  );
  renderList(lists.complaints, complaints, (complaint) =>
    record(`Complaint #${complaint.id}: ${complaint.title}`, [
      `Unit ID: ${complaint.unit_id}`,
      `Category: ${complaint.category}`,
      `Status: ${complaint.status}`,
    ]),
  );
}

function bindForm(selector, buildRequest, successMessage) {
  document.querySelector(selector).addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      const { path, payload, method = "POST" } = buildRequest(formData(form));
      const result = await request(path, {
        method,
        body: JSON.stringify(payload),
      });
      showMessage(`${successMessage} ID: ${result.id ?? "done"}`);
      await loadData();
      return result;
    } catch (error) {
      showMessage(error.message, true);
      return null;
    }
  });
}

bindForm(
  "#unit-form",
  (data) => ({
    path: "/api/units",
    payload: {
      tower: data.tower,
      flat_number: data.flat_number,
      floor: numberOrNull(data.floor),
    },
  }),
  "Unit created.",
);

bindForm(
  "#resident-form",
  (data) => ({
    path: "/api/residents",
    payload: {
      unit_id: Number(data.unit_id),
      name: data.name,
      phone: data.phone,
      email: emptyToNull(data.email),
      role: data.role,
    },
  }),
  "Resident added.",
);

bindForm(
  "#gate-form",
  (data) => ({
    path: "/api/gates",
    payload: { name: data.name },
  }),
  "Gate created.",
);

bindForm(
  "#guard-form",
  (data) => ({
    path: "/api/guards",
    payload: {
      gate_id: Number(data.gate_id),
      name: data.name,
      phone: data.phone,
      employee_code: data.employee_code,
    },
  }),
  "Guard added.",
);

bindForm(
  "#invitation-form",
  (data) => ({
    path: "/api/invitations",
    payload: {
      unit_id: Number(data.unit_id),
      resident_id: Number(data.resident_id),
      visitor: {
        name: data.visitor_name,
        phone: data.visitor_phone,
        visitor_type: data.visitor_type,
        company: null,
        vehicle_number: emptyToNull(data.vehicle_number),
      },
      purpose: data.purpose,
      valid_minutes: Number(data.valid_minutes),
      notes: emptyToNull(data.notes),
    },
  }),
  "Invitation created.",
);

bindForm(
  "#checkin-form",
  (data) => ({
    path: "/api/security/check-in",
    payload: {
      gate_id: Number(data.gate_id),
      guard_id: Number(data.guard_id),
      invitation_code: data.invitation_code,
      unit_id: null,
      visitor: null,
      purpose: null,
    },
  }),
  "Visitor checked in.",
);

bindForm(
  "#checkout-form",
  (data) => ({
    path: `/api/visits/${data.visit_id}/checkout`,
    payload: { guard_id: Number(data.guard_id) },
  }),
  "Visitor checked out.",
);

bindForm(
  "#delivery-form",
  (data) => ({
    path: "/api/deliveries",
    payload: {
      unit_id: Number(data.unit_id),
      resident_id: numberOrNull(data.resident_id),
      courier_name: data.courier_name,
      tracking_number: emptyToNull(data.tracking_number),
      otp_code: emptyToNull(data.otp_code),
      notes: null,
    },
  }),
  "Delivery created.",
);

bindForm(
  "#receive-delivery-form",
  (data) => ({
    path: `/api/deliveries/${data.delivery_id}/receive`,
    payload: {
      resident_id: Number(data.resident_id),
      otp_code: emptyToNull(data.otp_code),
    },
  }),
  "Delivery received.",
);

bindForm(
  "#complaint-form",
  (data) => ({
    path: "/api/complaints",
    payload: {
      unit_id: Number(data.unit_id),
      resident_id: Number(data.resident_id),
      title: data.title,
      description: data.description,
      category: data.category,
    },
  }),
  "Complaint created.",
);

document.querySelector("#refresh-all").addEventListener("click", async () => {
  try {
    await loadData();
    showMessage("Data refreshed.");
  } catch (error) {
    showMessage(error.message, true);
  }
});

loadData().catch((error) => showMessage(error.message, true));
