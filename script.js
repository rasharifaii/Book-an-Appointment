"use strict";

const $ = id => document.getElementById(id);
const form = $("bookingForm"), nameInput = $("name"), phoneInput = $("phone"),
      serviceSelect = $("service"), dateInput = $("date"), slotsBox = $("slots"),
      formError = $("formError"), submitBtn = $("submitBtn"), cancelEditBtn = $("cancelEdit"),
      formTitle = $("formTitle"), list = $("bookingList"), statsBox = $("stats"),
      searchInput = $("search"), toast = $("toast"), darkToggle = $("darkToggle");

const OPEN_HOUR = 9, CLOSE_HOUR = 17;
let editId = null, filter = "upcoming", toastTimer = null;

/* ---------- Storage ---------- */
function load(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const pad = t => t.replace(/^(\d):/, "0$1:");

// Load + migrate old entries (add id, default service, zero-padded time)
let bookings = load("bookings", []).map(b => ({
  id: b.id || newId(),
  name: b.name, phone: b.phone || "", service: b.service || "Consultation",
  date: b.date, time: pad(b.time)
}));
save("bookings", bookings);

/* ---------- Helpers ---------- */
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const when = b => new Date(`${b.date}T${b.time}`);
const fmtDate = s => new Date(s + "T00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
const isTaken = (date, time) => bookings.some(b => b.date === date && b.time === time && b.id !== editId);

function showToast(text, undo) {
  clearTimeout(toastTimer);
  toast.textContent = text;
  if (undo) {
    const btn = document.createElement("button");
    btn.type = "button"; btn.textContent = "Undo";
    btn.onclick = () => { undo(); toast.hidden = true; };
    toast.append(btn);
  }
  toast.hidden = false;
  toastTimer = setTimeout(() => (toast.hidden = true), 5000);
}
function showError(msg) {
  formError.textContent = msg;
  formError.hidden = !msg;
}

/* ---------- Dark mode ---------- */
function setDark(on) {
  document.body.classList.toggle("dark", on);
  darkToggle.textContent = on ? "☀️" : "🌙";
  darkToggle.setAttribute("aria-label", on ? "Switch to light mode" : "Switch to dark mode");
  save("dark", on);
}
setDark(load("dark", matchMedia("(prefers-color-scheme: dark)").matches));
darkToggle.onclick = () => setDark(!document.body.classList.contains("dark"));

/* ---------- Time slots ---------- */
function renderSlots(selected = "") {
  const date = dateInput.value;
  slotsBox.innerHTML = "";
  if (!date) {
    slotsBox.innerHTML = '<p class="hint">Pick a date to see available times.</p>';
    return;
  }
  const now = new Date();
  for (let h = OPEN_HOUR; h <= CLOSE_HOUR; h++) {
    const time = `${String(h).padStart(2, "0")}:00`;
    const disabled = isTaken(date, time) || new Date(`${date}T${time}`) < now;
    const label = document.createElement("label");
    label.className = "slot";
    const input = document.createElement("input");
    input.type = "radio"; input.name = "time"; input.value = time;
    input.disabled = disabled; input.checked = !disabled && time === selected;
    const span = document.createElement("span");
    span.textContent = time;
    label.append(input, span);
    slotsBox.append(label);
  }
}
const selectedTime = () => (slotsBox.querySelector("input:checked") || {}).value || "";

dateInput.min = todayStr();
dateInput.addEventListener("change", () => renderSlots());

/* ---------- Render list ---------- */
function renderStats() {
  const now = new Date(), t = todayStr();
  const upcoming = bookings.filter(b => when(b) >= now).length;
  const today = bookings.filter(b => b.date === t).length;
  const items = [[bookings.length, "Total"], [today, "Today"], [upcoming, "Upcoming"]];
  statsBox.innerHTML = "";
  items.forEach(([n, label]) => {
    const d = document.createElement("div"); d.className = "stat";
    const b = document.createElement("b"); b.textContent = n;
    const s = document.createElement("span"); s.textContent = label;
    d.append(b, s); statsBox.append(d);
  });
}

function renderBookings() {
  renderStats();
  const now = new Date(), t = todayStr(), q = searchInput.value.trim().toLowerCase();

  let items = bookings
    .filter(b => filter === "all" || (filter === "upcoming") === (when(b) >= now))
    .filter(b => !q || `${b.name} ${b.phone} ${b.service}`.toLowerCase().includes(q))
    .sort((a, b) => filter === "past" ? when(b) - when(a) : when(a) - when(b));

  list.innerHTML = "";
  if (!items.length) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = bookings.length ? "No bookings match this view." : "No bookings yet. Book your first appointment using the form.";
    list.append(li);
    return;
  }

  items.forEach(b => {
    const li = document.createElement("li");
    li.className = "booking" + (when(b) < now ? " past" : "") + (b.date === t ? " today" : "") + (b.id === editId ? " editing" : "");
    li.dataset.id = b.id;

    const info = document.createElement("div");
    const name = document.createElement("div"); name.className = "b-name"; name.textContent = b.name;
    const meta = document.createElement("div"); meta.className = "b-meta";
    meta.textContent = [fmtDate(b.date) + " at " + b.time, b.service, b.phone].filter(Boolean).join(" • ");
    info.append(name, meta);

    const actions = document.createElement("div"); actions.className = "b-actions";
    const edit = document.createElement("button");
    edit.className = "edit"; edit.dataset.action = "edit"; edit.type = "button"; edit.textContent = "Edit";
    const del = document.createElement("button");
    del.className = "delete"; del.dataset.action = "delete"; del.type = "button"; del.textContent = "Cancel";
    actions.append(edit, del);

    li.append(info, actions);
    list.append(li);
  });
}

/* ---------- Edit / delete ---------- */
function exitEdit() {
  editId = null;
  formTitle.textContent = "New appointment";
  submitBtn.textContent = "Book appointment";
  cancelEditBtn.hidden = true;
  form.reset();
  renderSlots();
  showError("");
}

list.addEventListener("click", e => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const id = btn.closest("li").dataset.id;
  const b = bookings.find(x => x.id === id);
  if (!b) return;

  if (btn.dataset.action === "edit") {
    editId = id;
    nameInput.value = b.name; phoneInput.value = b.phone;
    serviceSelect.value = b.service; dateInput.value = b.date;
    dateInput.min = b.date < todayStr() ? b.date : todayStr();
    renderSlots(b.time);
    formTitle.textContent = "Edit appointment";
    submitBtn.textContent = "Save changes";
    cancelEditBtn.hidden = false;
    showError("");
    renderBookings();
    nameInput.focus();
  } else {
    if (!confirm(`Cancel the appointment for ${b.name}?`)) return;
    const index = bookings.indexOf(b);
    bookings.splice(index, 1);
    save("bookings", bookings);
    if (editId === id) exitEdit();
    renderBookings(); renderSlots(selectedTime());
    showToast("Appointment cancelled.", () => {
      bookings.splice(index, 0, b);
      save("bookings", bookings);
      renderBookings(); renderSlots(selectedTime());
    });
  }
});
cancelEditBtn.onclick = () => { exitEdit(); renderBookings(); };

/* ---------- Submit ---------- */
form.addEventListener("submit", e => {
  e.preventDefault();
  [nameInput, dateInput].forEach(i => i.classList.remove("invalid"));

  const name = nameInput.value.trim().replace(/\s+/g, " ");
  const phone = phoneInput.value.trim();
  const date = dateInput.value, time = selectedTime();

  if (name.length < 2) { nameInput.classList.add("invalid"); nameInput.focus(); return showError("Enter the client's full name."); }
  if (phone && !/^[+\d][\d\s\-()]{5,}$/.test(phone)) { phoneInput.classList.add("invalid"); phoneInput.focus(); return showError("Enter a valid phone number, or leave it blank."); }
  if (!date) { dateInput.classList.add("invalid"); dateInput.focus(); return showError("Choose a date."); }
  if (!time) return showError("Choose an available time.");
  if (isTaken(date, time)) { renderSlots(); return showError("That time was just booked. Choose another."); }

  const record = { id: editId || newId(), name, phone, service: serviceSelect.value, date, time };
  if (editId) {
    bookings[bookings.findIndex(b => b.id === editId)] = record;
    showToast("Changes saved.");
  } else {
    bookings.push(record);
    showToast("Appointment booked.");
  }
  save("bookings", bookings);
  dateInput.min = todayStr();
  exitEdit();
  renderBookings();
});

/* ---------- Filters, search, export ---------- */
document.querySelectorAll(".tab").forEach(tab => tab.addEventListener("click", () => {
  filter = tab.dataset.filter;
  document.querySelectorAll(".tab").forEach(t => {
    const on = t === tab;
    t.classList.toggle("active", on);
    t.setAttribute("aria-selected", on);
  });
  renderBookings();
}));
searchInput.addEventListener("input", renderBookings);

$("exportBtn").onclick = () => {
  if (!bookings.length) return showToast("Nothing to export yet.");
  const esc = v => `"${String(v).replace(/"/g, '""')}"`;
  const rows = [["Name", "Phone", "Service", "Date", "Time"], ...bookings
    .slice().sort((a, b) => when(a) - when(b))
    .map(b => [b.name, b.phone, b.service, b.date, b.time])];
  const blob = new Blob([rows.map(r => r.map(esc).join(",")).join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = "bookings.csv"; a.click();
  URL.revokeObjectURL(a.href);
};

/* ---------- Init ---------- */
renderSlots();
renderBookings();
