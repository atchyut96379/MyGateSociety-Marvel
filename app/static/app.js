const state = {
  units: [],
  residents: [],
  gates: [],
  guards: [],
  invitations: [],
  visits: [],
  deliveries: [],
  complaints: [],
  user: JSON.parse(localStorage.getItem("mygateUser") || "null"),
};

const loginScreen = document.querySelector("#login-screen");
const appShell = document.querySelector("#app-shell");
const loginForm = document.querySelector("#login-form");
const loginMessage = document.querySelector("#login-message");
const statusBanner = document.querySelector("#status-banner");
const drawer = document.querySelector("#form-drawer");

function formData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function emptyToNull(value) {
  return value === undefined || value === "" ? null : value;
}

function numberOrNull(value) {
  return value === undefined || value === "" ? null : Number(value);
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

function money(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(value);
}

function setStatus(text, isError = false) {
  statusBanner.textContent = text;
  statusBanner.classList.toggle("error", isError);
}

function showLogin() {
  loginScreen.classList.remove("hidden");
  appShell.classList.add("hidden");
}

function showApp() {
  loginScreen.classList.add("hidden");
  appShell.classList.remove("hidden");
}

function normalizePhone(value) {
  return value.replace(/\s+/g, "").replace(/^\+91/, "");
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

  Object.assign(state, { units, residents, gates, guards, invitations, visits, deliveries, complaints });
  renderDashboard();
}

async function login(identifier, password) {
  if (identifier.toLowerCase() === "admin" && password === "Admin") {
    state.user = { role: "Admin", name: "Admin", extra: "Secretary" };
    localStorage.setItem("mygateUser", JSON.stringify(state.user));
    return state.user;
  }

  await loadData();
  const phone = normalizePhone(identifier);
  const resident = state.residents.find((item) => normalizePhone(item.phone) === phone);
  if (resident && password) {
    state.user = { role: "Resident", name: resident.phone, extra: resident.name, unitId: resident.unit_id };
    localStorage.setItem("mygateUser", JSON.stringify(state.user));
    return state.user;
  }

  const guard = state.guards.find((item) => normalizePhone(item.phone) === phone);
  if (guard && password) {
    state.user = { role: "Guard", name: guard.phone, extra: guard.name, gateId: guard.gate_id };
    localStorage.setItem("mygateUser", JSON.stringify(state.user));
    return state.user;
  }

  throw new Error("Invalid login. Use Admin/Admin or a registered resident/guard mobile number.");
}

function updateProfile() {
  const user = state.user || { role: "Admin", name: "Admin", extra: "System" };
  document.querySelector("#profile-name").textContent = user.name;
  document.querySelector("#profile-role").textContent = user.role;
  document.querySelector("#profile-extra").textContent = user.extra || "System";
  document.querySelector("#dashboard-title").textContent = `${user.role} Dashboard`;
}

function renderDashboard() {
  updateProfile();
  const owners = state.residents.filter((resident) => resident.role === "owner");
  const tenants = state.residents.filter((resident) => resident.role === "tenant");
  const pendingVisits = state.visits.filter((visit) => visit.status === "pending");
  const openComplaints = state.complaints.filter((complaint) => !["resolved", "closed"].includes(complaint.status));
  const paidDeliveries = state.deliveries.filter((delivery) => delivery.status === "received_by_resident");

  document.querySelector("#total-residents").textContent = state.residents.length;
  document.querySelector("#total-flats").textContent = state.units.length;
  document.querySelector("#owners-count").textContent = owners.length;
  document.querySelector("#tenants-count").textContent = tenants.length;
  document.querySelector("#pending-payments").textContent = pendingVisits.length + openComplaints.length;

  const paidAmount = paidDeliveries.length * 100;
  const monthlyAmount = state.residents.length * 100;
  const expenseAmount = state.complaints.length * 500;
  document.querySelector("#month-collected").textContent = money(monthlyAmount);
  document.querySelector("#total-paid").textContent = money(paidAmount);
  document.querySelector("#total-expenses").textContent = money(expenseAmount);
  document.querySelector("#balance-amount").textContent = money(monthlyAmount - expenseAmount);

  setStatus(`All paid (${paidDeliveries.length} record(s)). Dashboard refreshed.`);
  renderCommittee();
  renderSetupList();
  renderVisits();
  renderServices();
}

function renderCommittee() {
  const roles = ["Secretary", "Vice President", "Treasurer", "Member"];
  const rows = state.residents.slice(0, 8).map((resident, index) => {
    const unit = state.units.find((item) => item.id === resident.unit_id);
    return `
      <tr>
        <td><span class="designation">${roles[index] || "Member"}</span></td>
        <td>${resident.name}</td>
        <td>${unit ? unit.flat_number : resident.unit_id}</td>
        <td>${resident.phone}</td>
      </tr>
    `;
  });

  document.querySelector("#committee-table").innerHTML =
    rows.join("") || '<tr><td colspan="4">No residents found. Add residents from the drawer.</td></tr>';
}

function item(title, lines) {
  return `
    <div class="list-item">
      <strong>${title}</strong>
      ${lines.map((line) => `<span>${line}</span>`).join("")}
    </div>
  `;
}

function renderSetupList() {
  const unitItems = state.units.map((unit) => item(`Flat ${unit.tower}-${unit.flat_number}`, [`Unit ID: ${unit.id}`]));
  const gateItems = state.gates.map((gate) => item(`Gate ${gate.name}`, [`Gate ID: ${gate.id}`]));
  const guardItems = state.guards.map((guard) => item(`Guard ${guard.name}`, [`Guard ID: ${guard.id}`, guard.phone]));
  document.querySelector("#setup-list").innerHTML =
    [...unitItems, ...gateItems, ...guardItems].join("") || '<p class="list-item">No setup records yet.</p>';
}

function renderVisits() {
  const invitationItems = state.invitations.slice(0, 4).map((invitation) =>
    item(`Invite ${invitation.code}`, [
      `Visitor: ${invitation.visitor.name}`,
      `Unit ID: ${invitation.unit_id}`,
      `Status: ${invitation.status}`,
    ]),
  );
  const visitItems = state.visits.slice(0, 4).map((visit) =>
    item(`Visit #${visit.id} - ${visit.status}`, [`Visitor: ${visit.visitor.name}`, `Purpose: ${visit.purpose}`]),
  );
  document.querySelector("#visits-list").innerHTML =
    [...invitationItems, ...visitItems].join("") || '<p class="list-item">No visitor activity yet.</p>';
}

function renderServices() {
  const deliveryItems = state.deliveries.slice(0, 4).map((delivery) =>
    item(`Delivery #${delivery.id} - ${delivery.status}`, [
      `Courier: ${delivery.courier_name}`,
      `Unit ID: ${delivery.unit_id}`,
    ]),
  );
  const complaintItems = state.complaints.slice(0, 4).map((complaint) =>
    item(`Complaint #${complaint.id} - ${complaint.status}`, [
      complaint.title,
      `Category: ${complaint.category}`,
    ]),
  );
  document.querySelector("#service-list").innerHTML =
    [...deliveryItems, ...complaintItems].join("") || '<p class="list-item">No service records yet.</p>';
}

function openDrawer(panelId) {
  drawer.classList.remove("hidden");
  document.querySelectorAll(".drawer-panel").forEach((panel) => panel.classList.add("hidden"));
  document.querySelector(`#${panelId}`).classList.remove("hidden");
}

function bindForm(selector, buildRequest, successMessage) {
  document.querySelector(selector).addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const { path, payload, method = "POST" } = buildRequest(formData(event.currentTarget));
      const result = await request(path, { method, body: JSON.stringify(payload) });
      await loadData();
      setStatus(`${successMessage} ID: ${result.id || "done"}.`);
    } catch (error) {
      setStatus(error.message, true);
    }
  });
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = formData(loginForm);
  loginMessage.textContent = "";
  try {
    await login(data.identifier, data.password);
    showApp();
    await loadData();
  } catch (error) {
    loginMessage.textContent = error.message;
  }
});

document.querySelector("#logout-button").addEventListener("click", () => {
  localStorage.removeItem("mygateUser");
  state.user = null;
  showLogin();
});

document.querySelector("#refresh-data").addEventListener("click", () => {
  loadData().catch((error) => setStatus(error.message, true));
});

document.querySelectorAll("[data-open-form]").forEach((button) => {
  button.addEventListener("click", () => openDrawer(button.dataset.openForm));
});

document.querySelector("#close-drawer").addEventListener("click", () => drawer.classList.add("hidden"));

bindForm(
  "#unit-form",
  (data) => ({
    path: "/api/units",
    payload: { tower: data.tower, flat_number: data.flat_number, floor: numberOrNull(data.floor) },
  }),
  "Flat created",
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
  "Resident added",
);

bindForm("#gate-form", (data) => ({ path: "/api/gates", payload: { name: data.name } }), "Gate created");

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
  "Guard added",
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
        visitor_type: "guest",
        company: null,
        vehicle_number: null,
      },
      purpose: data.purpose,
      valid_minutes: 1440,
      notes: null,
    },
  }),
  "Invitation created",
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
  "Visitor checked in",
);

bindForm(
  "#checkout-form",
  (data) => ({
    path: `/api/visits/${data.visit_id}/checkout`,
    payload: { guard_id: Number(data.guard_id) },
  }),
  "Visitor checked out",
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
  "Delivery created",
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
  "Complaint created",
);

if (state.user) {
  showApp();
  loadData().catch((error) => setStatus(error.message, true));
} else {
  showLogin();
}
