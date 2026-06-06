const MAINTENANCE_AMOUNT = 1200;
const STORAGE_KEYS = {
  user: "mygateUser",
  expenses: "mygateExpenses",
  payments: "mygatePayments",
  activity: "mygateActivity",
};

const state = {
  route: "dashboard",
  units: [],
  residents: [],
  gates: [],
  guards: [],
  invitations: [],
  visits: [],
  deliveries: [],
  complaints: [],
  expenses: JSON.parse(localStorage.getItem(STORAGE_KEYS.expenses) || "null") || [
    {
      id: 1,
      type: "Water Tanker",
      amount: 4000,
      date: "03-06-2026 12:41",
      description: "water tanker for daily usage due to water scarcity",
    },
  ],
  payments: JSON.parse(localStorage.getItem(STORAGE_KEYS.payments) || "{}"),
  activity: JSON.parse(localStorage.getItem(STORAGE_KEYS.activity) || "null") || [
    {
      when: "04-Jun-2026 13:59",
      who: "System Admin",
      action: "LoginCreated",
      flat: "408",
      details: "System demo login created.",
    },
  ],
  user: JSON.parse(localStorage.getItem(STORAGE_KEYS.user) || "null"),
};

const loginScreen = document.querySelector("#login-screen");
const appShell = document.querySelector("#app-shell");
const pageContent = document.querySelector("#page-content");
const drawer = document.querySelector("#form-drawer");
const drawerContent = document.querySelector("#drawer-content");
const loginForm = document.querySelector("#login-form");
const loginMessage = document.querySelector("#login-message");

function saveLocalState() {
  localStorage.setItem(STORAGE_KEYS.expenses, JSON.stringify(state.expenses));
  localStorage.setItem(STORAGE_KEYS.payments, JSON.stringify(state.payments));
  localStorage.setItem(STORAGE_KEYS.activity, JSON.stringify(state.activity));
}

function formData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function emptyToNull(value) {
  return value === undefined || value === "" ? null : value;
}

function numberOrNull(value) {
  return value === undefined || value === "" ? null : Number(value);
}

function money(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(value || 0);
}

function currentMonth() {
  return new Date().toLocaleString("en-IN", { month: "long" });
}

function currentYear() {
  return new Date().getFullYear();
}

function normalizePhone(value) {
  return String(value || "").replace(/\s+/g, "").replace(/^\+91/, "");
}

function flatLabel(unit) {
  if (!unit) return "-";
  return unit.tower ? `${unit.tower}-${unit.flat_number}` : unit.flat_number;
}

function unitForResident(resident) {
  return state.units.find((unit) => unit.id === resident.unit_id);
}

async function request(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
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
}

async function login(identifier, password) {
  if (identifier.toLowerCase() === "admin" && password === "Admin") {
    state.user = { role: "Admin", name: "9637945678", extra: "Secretary" };
    localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(state.user));
    return;
  }

  await loadData();
  const phone = normalizePhone(identifier);
  const resident = state.residents.find((item) => normalizePhone(item.phone) === phone);
  if (resident && password) {
    state.user = { role: "Resident", name: resident.phone, extra: resident.name, unitId: resident.unit_id };
    localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(state.user));
    return;
  }
  const guard = state.guards.find((item) => normalizePhone(item.phone) === phone);
  if (guard && password) {
    state.user = { role: "Guard", name: guard.phone, extra: guard.name, gateId: guard.gate_id };
    localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(state.user));
    return;
  }
  throw new Error("Invalid login. Use Admin/Admin or a registered resident/guard mobile number.");
}

function addActivity(action, flat, details, who = "A.Atchyutarao") {
  state.activity.unshift({
    when: new Date().toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }),
    who,
    action,
    flat: flat || "-",
    details,
  });
  state.activity = state.activity.slice(0, 40);
  saveLocalState();
}

function showLogin() {
  loginScreen.classList.remove("hidden");
  appShell.classList.add("hidden");
}

function showApp() {
  loginScreen.classList.add("hidden");
  appShell.classList.remove("hidden");
  updateProfile();
}

function updateProfile() {
  const user = state.user || { role: "Admin", name: "9637945678", extra: "Secretary" };
  document.querySelector("#profile-name").textContent = user.name;
  document.querySelector("#profile-role").textContent = user.role;
  document.querySelector("#profile-extra").textContent = user.extra || "Secretary";
}

function setActiveNav() {
  document.querySelectorAll(".nav-list a").forEach((link) => {
    link.classList.toggle("active", link.dataset.route === state.route);
  });
}

function pageTitle(title, helper = "") {
  return `
    <header class="page-title">
      <h1>${title}</h1>
      ${helper ? `<p>${helper}</p>` : ""}
    </header>
  `;
}

function metricCard(color, value, label, icon = "") {
  return `
    <article class="metric ${color}">
      <strong>${value}</strong>
      <span>${label}</span>
      ${icon ? `<i>${icon}</i>` : ""}
    </article>
  `;
}

function committeeRows(limit = 8) {
  const designations = ["Secretary", "Vice President", "Treasurer", "Member"];
  const rows = state.residents.slice(0, limit).map((resident, index) => {
    const unit = unitForResident(resident);
    return `
      <tr>
        <td><span class="designation">${designations[index] || "Member"}</span></td>
        <td>${resident.name}</td>
        <td>${unit ? unit.flat_number : resident.unit_id}</td>
        <td>${resident.phone}</td>
      </tr>
    `;
  });
  return rows.join("") || '<tr><td colspan="4">No residents yet.</td></tr>';
}

function ownerCount() {
  return state.residents.filter((resident) => resident.role === "owner").length;
}

function tenantCount() {
  return state.residents.filter((resident) => resident.role === "tenant").length;
}

function maintenanceRecords() {
  return state.units.map((unit) => {
    const resident = state.residents.find((item) => item.unit_id === unit.id);
    const paymentKey = `${unit.id}-${currentMonth()}-${currentYear()}`;
    const payment = state.payments[paymentKey];
    return {
      key: paymentKey,
      unit,
      resident,
      amount: MAINTENANCE_AMOUNT,
      month: currentMonth(),
      year: currentYear(),
      status: payment ? "Paid" : "Pending",
      paidBy: payment?.paidBy || "-",
      txn: payment?.txn || "-",
      gateway: payment?.gateway || "-",
      receipt: payment?.receipt || "-",
    };
  });
}

function financeSummary() {
  const records = maintenanceRecords();
  const paid = records.filter((record) => record.status === "Paid");
  const collected = paid.reduce((sum, record) => sum + record.amount, 0);
  const expected = records.reduce((sum, record) => sum + record.amount, 0);
  const expenseTotal = state.expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  return {
    collected,
    expected,
    expenseTotal,
    balance: collected - expenseTotal,
    pending: records.length - paid.length,
    paidCount: paid.length,
    totalCount: records.length,
  };
}

function renderDashboard() {
  const finance = financeSummary();
  return `
    <section class="notice-card">
      <h2>My Maintenance Payments ${state.user?.role === "Resident" ? "(Resident)" : ""}</h2>
      <div class="success-banner">All paid (${finance.paidCount} record(s)).</div>
    </section>
    <section class="toolbar">
      <button class="small-button" data-route-button="reports">Download dashboard report (Excel)</button>
    </section>
    <section class="metric-grid">
      ${metricCard("teal", state.residents.length, "Total Residents", "👥")}
      ${metricCard("green", state.units.length, "Total Flats", "🏢")}
      ${metricCard("amber", ownerCount(), "In-house Owners", "🧑‍💼")}
      ${metricCard("teal", tenantCount(), "In-house Tenants", "👥")}
      ${metricCard("red", money(finance.collected), "This month collected", "💵")}
      ${metricCard("gray", money(finance.collected), "Total collected (paid)", "🪙")}
      ${metricCard("red", money(finance.expenseTotal), "Total Expenses", "💳")}
      ${metricCard("blue", money(finance.balance), "Balance Amount", "💳")}
      ${metricCard("amber compact", finance.pending, "Pending Payments", "🕘")}
    </section>
    <section class="panel full-width">
      <header><h3>Association committee</h3></header>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Designation</th><th>Name</th><th>Flat</th><th>Phone</th></tr></thead>
          <tbody>${committeeRows()}</tbody>
        </table>
      </div>
    </section>
  `;
}

function renderResidents() {
  const rows = state.residents
    .map((resident) => {
      const unit = unitForResident(resident);
      return `
        <tr>
          <td>${unit ? unit.flat_number : resident.unit_id}</td>
          <td>${resident.name}</td>
          <td>${resident.phone || "-"}</td>
          <td>${resident.email || "-"}</td>
          <td>${resident.role === "owner" ? "Owner" : resident.role === "tenant" ? "Tenant" : resident.role}</td>
          <td>-</td>
          <td><span class="badge gray">No account</span></td>
          <td class="actions">
            <a href="#residents">Details</a> |
            <a href="#residents-create" data-resident-edit="${resident.id}">Edit</a> |
            <a href="#residents">Delete</a> |
            <a href="#residents">Create login</a> |
            <a href="#residents">Change role</a>
          </td>
        </tr>
      `;
    })
    .join("");
  return `
    ${pageTitle("Residents List", "Change role per row (one committee role each).")}
    <section class="toolbar">
      <button class="small-button blue" data-route-button="residents-create">Add Resident</button>
      <button class="small-button green" data-route-button="residents-import">Import from Excel</button>
      <button class="small-button light">Download template</button>
      <button class="small-button amber">Create all logins (${state.residents.length})</button>
    </section>
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>Flat Number</th><th>Resident Name</th><th>Login mobile</th><th>Notification email</th>
            <th>Type</th><th>Property Owner</th><th>Login</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="8">No residents yet. Add one to begin.</td></tr>'}</tbody>
      </table>
    </div>
  `;
}

function renderAddResident() {
  return `
    ${pageTitle("Add Resident", "Resident")}
    <form id="resident-page-form" class="full-form">
      <label>Flat Number <input name="unit_id" type="number" placeholder="Unit ID from flats list" required /></label>
      <label>Resident Name <input name="name" required /></label>
      <label>Login mobile <input name="phone" required /></label>
      <p>10-digit mobile — used as login username when you create an account.</p>
      <label>Notification email (optional) <input name="email" type="email" /></label>
      <p>Optional — for payment reminder emails only, not for login.</p>
      <fieldset>
        <legend>Member type</legend>
        <label class="inline"><input type="radio" name="role" value="owner" checked /> Owner</label>
        <label class="inline"><input type="radio" name="role" value="tenant" /> Tenant</label>
      </fieldset>
      <div class="login-option"><label class="inline"><input type="checkbox" name="create_login" /> Create login account</label>
      <p>Default password: Marv[flat — max 3 digits, first part if 109-110] (e.g. Marv507, Marv109).</p></div>
      <button class="primary-action" type="submit">Create</button>
      <p><a href="#residents">Back to List</a></p>
    </form>
  `;
}

function renderImportResidents() {
  return `
    ${pageTitle("Import Residents from Excel", "Upload a .xlsx file from Residents > Import from Excel. The importer auto-detects the format from the first row.")}
    <section class="info-card">
      <p>Supported formats</p>
      <p>1. Standard template (sheet "Residents")</p>
      <p>Columns: FlatNumber, ResidentName, Phone (login mobile), Notification email (optional), ResidentType (Owner/Tenant), PropertyOwnerName.</p>
      <p>2. Society export — SNO + Flat in columns A & B (your layout).</p>
      <p><strong>Important:</strong> keep residents on one sheet. Duplicate checks use flat + name + type.</p>
    </section>
    <section class="toolbar">
      <button class="small-button light">Download template (both sheets)</button>
      <a href="#residents">Back to list</a>
    </section>
    <form id="import-form" class="full-form compact-form">
      <label>Excel file (.xlsx) <input name="file" type="file" accept=".xlsx,.xls" /></label>
      <button class="primary-action" type="submit">Import</button>
    </form>
  `;
}

function renderMaintenance() {
  const rows = maintenanceRecords()
    .slice()
    .reverse()
    .map((record) => `
      <tr>
        <td>${record.unit.flat_number}</td>
        <td>${money(record.amount)}</td>
        <td>${record.month}</td>
        <td>${record.year}</td>
        <td><span class="badge ${record.status === "Paid" ? "green" : "red"}">${record.status}</span></td>
        <td>${record.status === "Paid" ? new Date().toLocaleDateString("en-IN") : "-"}</td>
        <td>Monthly maintenance</td>
        <td><a href="#collections">Details</a></td>
      </tr>
    `)
    .join("");
  return `
    ${pageTitle("Maintenance List", `Auto ${money(MAINTENANCE_AMOUNT)}/month per flat — view only here.`)}
    <div class="table-wrap">
      <table class="data-table"><thead><tr>
        <th>Flat Number</th><th>Amount</th><th>Month</th><th>Year</th><th>Status</th><th>Payment Date</th><th>Remarks</th><th>Actions</th>
      </tr></thead><tbody>${rows || '<tr><td colspan="8">No flats available.</td></tr>'}</tbody></table>
    </div>
  `;
}

function renderExpenses() {
  const rows = state.expenses.map((expense) => `
    <tr>
      <td>${expense.type}</td>
      <td>${money(expense.amount)}</td>
      <td>${expense.date}</td>
      <td>${expense.description}</td>
      <td><a href="#expenses">Details</a> | <a href="#expenses">Edit</a> | <a href="#expenses">Delete</a></td>
    </tr>
  `).join("");
  return `
    ${pageTitle("Expenses List")}
    <section class="toolbar"><button class="small-button blue" data-drawer="expense">Add Expense</button></section>
    <div class="table-wrap">
      <table class="data-table"><thead><tr><th>Expense Type</th><th>Amount</th><th>Date</th><th>Description</th><th>Actions</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="5">No expenses yet.</td></tr>'}</tbody></table>
    </div>
  `;
}

function renderReports() {
  const finance = financeSummary();
  return `
    ${pageTitle("Financial Reports")}
    <section class="toolbar"><button class="small-button green">Download full report (Excel)</button></section>
    <section class="metric-grid report-grid">
      ${metricCard("green", money(finance.collected), "This month collected", "💵")}
      ${metricCard("gray", money(finance.collected), "Total collected (paid)", "🪙")}
      ${metricCard("red", money(finance.expenseTotal), "Total Expenses", "💳")}
      ${metricCard("amber", finance.pending, "Pending Payments", "🕘")}
      ${metricCard("blue", money(finance.balance), "Balance", "💳")}
    </section>
    <section class="summary-card">
      <h3>Summary</h3>
      <p><strong>Total Residents:</strong> ${state.residents.length}</p>
      <p><strong>Total Flats:</strong> ${state.units.length}</p>
      <p><strong>In-house Owners:</strong> ${ownerCount()}</p>
      <p><strong>In-house Tenants:</strong> ${tenantCount()}</p>
      <p><strong>Maintenance Records:</strong> ${maintenanceRecords().length}</p>
      <p><strong>Pending Dues:</strong> ${finance.pending}</p>
    </section>
    <section class="panel full-width"><header><h3>Association committee</h3></header>
      <div class="table-wrap"><table><thead><tr><th>Designation</th><th>Name</th><th>Flat</th><th>Phone</th></tr></thead><tbody>${committeeRows()}</tbody></table></div>
    </section>
  `;
}

function renderCollections() {
  const finance = financeSummary();
  const records = maintenanceRecords();
  const rows = records.map((record) => `
    <tr class="collection-row">
      <td>${record.unit.flat_number}</td>
      <td>${record.resident?.name || "-"}</td>
      <td>${record.resident?.role === "owner" ? "Owner" : "Tenant"}</td>
      <td>${money(record.amount)}</td>
      <td><span class="badge ${record.status === "Paid" ? "green" : "red"}">${record.status}</span></td>
      <td>${record.paidBy}</td>
      <td>${record.txn}</td>
      <td>${record.gateway}</td>
      <td>${record.receipt}</td>
      <td>${record.resident?.phone || "No mobile"} ${record.status === "Pending" ? `| <a href="#" data-mark-cash="${record.key}">Mark cash</a>` : ""}</td>
    </tr>
  `).join("");
  return `
    ${pageTitle("Collection dashboard")}
    <label class="billing-period">Billing period <select><option>${currentMonth()} ${currentYear()}</option></select></label>
    <section class="collection-stats">
      <article><span>Collected</span><strong>${money(finance.collected)}</strong></article>
      <article><span>Still pending</span><strong>${money(finance.expected - finance.collected)}</strong></article>
      <article><span>Flats paid</span><strong>${finance.paidCount} / ${finance.totalCount} (${finance.totalCount ? Math.round((finance.paidCount / finance.totalCount) * 100) : 0}%)</strong></article>
    </section>
    <p class="hint">Use the WhatsApp link on each pending flat, or mark cash when payment is received offline.</p>
    <section class="toolbar"><button class="small-button light">Configure Razorpay / messaging</button><button class="small-button light" data-route-button="activity">Activity log</button></section>
    <div class="table-wrap">
      <table class="data-table collection-table"><thead><tr>
        <th>Flat</th><th>Name</th><th>Type</th><th>Total</th><th>Status</th><th>Paid by</th><th>Txn</th><th>Gateway</th><th>Receipt</th><th>Actions</th>
      </tr></thead><tbody>${rows || '<tr><td colspan="10">No maintenance records.</td></tr>'}</tbody></table>
    </div>
  `;
}

function renderActivity() {
  const rows = state.activity.map((entry) => `
    <tr>
      <td>${entry.when}</td>
      <td>${entry.who}</td>
      <td><span class="badge gray">${entry.action}</span></td>
      <td>${entry.flat}</td>
      <td>${entry.details}</td>
    </tr>
  `).join("");
  return `
    ${pageTitle("Activity log")}
    <div class="table-wrap">
      <table class="data-table"><thead><tr><th>When (UTC)</th><th>Who</th><th>Action</th><th>Flat</th><th>Details</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="5">No activity yet.</td></tr>'}</tbody></table>
    </div>
    <p class="back-link"><a href="#residents">Back to Residents</a></p>
  `;
}

function renderPayments() {
  const userUnitId = state.user?.unitId || state.units[0]?.id;
  const records = maintenanceRecords().filter((record) => !userUnitId || record.unit.id === userUnitId);
  const rows = records.map((record) => `
    <tr>
      <td>${record.unit.flat_number}</td>
      <td>${record.month}</td>
      <td>${record.year}</td>
      <td>${money(record.amount)}</td>
      <td><span class="badge ${record.status === "Paid" ? "green" : "red"}">${record.status}</span></td>
      <td>${record.txn}</td>
      <td><a href="#">View</a> | <a href="#">PDF</a></td>
    </tr>
  `).join("");
  return `
    <section class="notice-card">
      <h2>My Maintenance Payments ${records[0] ? `(Flat ${records[0].unit.flat_number})` : ""}</h2>
      <div class="success-banner">${records.every((record) => record.status === "Paid") ? "All paid" : "Payment pending"} (${records.length} record(s)).</div>
    </section>
    <div class="table-wrap">
      <table class="data-table"><thead><tr><th>Flat</th><th>Month</th><th>Year</th><th>Amount</th><th>Status</th><th>Transaction ID</th><th>Receipt</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="7">No payment records.</td></tr>'}</tbody></table>
    </div>
  `;
}

function renderIntegrations() {
  return `
    ${pageTitle("Integrations (Razorpay / SMS)", "Connect payment gateway and messaging providers.")}
    <section class="info-card">
      <p><strong>Razorpay:</strong> pending API key setup.</p>
      <p><strong>WhatsApp/SMS:</strong> pending provider credentials.</p>
      <p>This page matches the navigation workflow and is ready for the backend integration step.</p>
    </section>
  `;
}

function renderPage() {
  setActiveNav();
  const pages = {
    dashboard: renderDashboard,
    residents: renderResidents,
    "residents-create": renderAddResident,
    "residents-import": renderImportResidents,
    maintenance: renderMaintenance,
    expenses: renderExpenses,
    reports: renderReports,
    collections: renderCollections,
    activity: renderActivity,
    integrations: renderIntegrations,
    payments: renderPayments,
  };
  pageContent.innerHTML = (pages[state.route] || renderDashboard)();
  attachPageHandlers();
}

function setRoute(route) {
  state.route = route || "dashboard";
  window.location.hash = state.route;
  renderPage();
}

function drawerTemplate(type) {
  if (type === "expense") {
    return `
      <h2>Add Expense</h2>
      <form id="expense-form" class="drawer-form">
        <label>Expense Type <input name="type" value="Water Tanker" required /></label>
        <label>Amount <input name="amount" type="number" value="4000" required /></label>
        <label>Description <textarea name="description" required>water tanker for daily usage due to water scarcity</textarea></label>
        <button type="submit">Add Expense</button>
      </form>
    `;
  }
  return `
    <h2>Quick Actions</h2>
    <form id="unit-form" class="drawer-form">
      <h3>Create flat</h3>
      <label>Tower <input name="tower" value="A" required /></label>
      <label>Flat number <input name="flat_number" value="101" required /></label>
      <label>Floor <input name="floor" type="number" value="1" /></label>
      <button type="submit">Create flat</button>
    </form>
  `;
}

function openDrawer(type = "setup") {
  drawerContent.innerHTML = drawerTemplate(type);
  drawer.classList.remove("hidden");
  attachDrawerHandlers();
}

function attachPageHandlers() {
  pageContent.querySelectorAll("[data-route-button]").forEach((button) => {
    button.addEventListener("click", () => setRoute(button.dataset.routeButton));
  });
  pageContent.querySelectorAll("[data-drawer]").forEach((button) => {
    button.addEventListener("click", () => openDrawer(button.dataset.drawer));
  });
  pageContent.querySelectorAll("[data-mark-cash]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      const key = link.dataset.markCash;
      const record = maintenanceRecords().find((item) => item.key === key);
      state.payments[key] = {
        paidBy: "Cash",
        txn: `cash-${Date.now()}`,
        gateway: "Offline",
        receipt: "Manual",
      };
      addActivity("OfflinePaymentMarked", record?.unit.flat_number, `Offline/cash payment recorded. Total ${money(record?.amount)}.`);
      saveLocalState();
      renderPage();
    });
  });
  const residentPageForm = pageContent.querySelector("#resident-page-form");
  if (residentPageForm) {
    residentPageForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const data = formData(residentPageForm);
      try {
        await request("/api/residents", {
          method: "POST",
          body: JSON.stringify({
            unit_id: Number(data.unit_id),
            name: data.name,
            phone: data.phone,
            email: emptyToNull(data.email),
            role: data.role,
          }),
        });
        addActivity("ResidentCreated", data.unit_id, `Resident ${data.name} created.`);
        await loadData();
        setRoute("residents");
      } catch (error) {
        alert(error.message);
      }
    });
  }
  const importForm = pageContent.querySelector("#import-form");
  if (importForm) {
    importForm.addEventListener("submit", (event) => {
      event.preventDefault();
      addActivity("ResidentsImportQueued", "-", "Import screen submitted. Backend Excel import will be connected next.");
      alert("Import UI captured. Backend Excel upload will be implemented in the next workflow step.");
    });
  }
}

function attachDrawerHandlers() {
  const expenseForm = drawerContent.querySelector("#expense-form");
  if (expenseForm) {
    expenseForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = formData(expenseForm);
      const expense = {
        id: Date.now(),
        type: data.type,
        amount: Number(data.amount),
        date: new Date().toLocaleString("en-GB"),
        description: data.description,
      };
      state.expenses.unshift(expense);
      addActivity("ExpenseCreated", "-", `${expense.type} expense recorded for ${money(expense.amount)}.`);
      saveLocalState();
      drawer.classList.add("hidden");
      renderPage();
    });
  }
  const unitForm = drawerContent.querySelector("#unit-form");
  if (unitForm) {
    unitForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const data = formData(unitForm);
      try {
        await request("/api/units", {
          method: "POST",
          body: JSON.stringify({ tower: data.tower, flat_number: data.flat_number, floor: numberOrNull(data.floor) }),
        });
        addActivity("FlatCreated", data.flat_number, `Flat ${data.flat_number} created.`);
        await loadData();
        drawer.classList.add("hidden");
        renderPage();
      } catch (error) {
        alert(error.message);
      }
    });
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginMessage.textContent = "";
  const data = formData(loginForm);
  try {
    await login(data.identifier, data.password);
    await loadData();
    showApp();
    setRoute(location.hash.replace("#", "") || "dashboard");
  } catch (error) {
    loginMessage.textContent = error.message;
  }
});

document.querySelector("#logout-button").addEventListener("click", () => {
  localStorage.removeItem(STORAGE_KEYS.user);
  state.user = null;
  showLogin();
});

document.querySelector("#close-drawer").addEventListener("click", () => drawer.classList.add("hidden"));

document.querySelectorAll(".nav-list a").forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    setRoute(link.dataset.route);
  });
});

window.addEventListener("hashchange", () => {
  state.route = location.hash.replace("#", "") || "dashboard";
  if (state.user) renderPage();
});

async function boot() {
  if (!state.user) {
    showLogin();
    return;
  }
  showApp();
  await loadData();
  setRoute(location.hash.replace("#", "") || "dashboard");
}

boot().catch((error) => {
  showApp();
  pageContent.innerHTML = `<section class="info-card error-card">${error.message}</section>`;
});
