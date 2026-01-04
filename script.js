const form = document.getElementById("bookingForm");
const nameInput = document.getElementById("name");
const dateInput = document.getElementById("date");
const timeSelect = document.getElementById("time");
const bookingList = document.getElementById("bookingList");
const message = document.getElementById("message");
const darkToggle = document.getElementById("darkToggle");

let editIndex = null;

// 🌙 Dark Mode
darkToggle.onclick = () => {
  document.body.classList.toggle("dark");
};

// ⏰ Generate times
function generateTimes() {
  timeSelect.innerHTML = `<option value="">Choose time</option>`;
  for (let h = 9; h <= 17; h++) {
    timeSelect.innerHTML += `<option>${h}:00</option>`;
  }
}
generateTimes();

// 📦 Get bookings
function getBookings() {
  return JSON.parse(localStorage.getItem("bookings")) || [];
}

// 💾 Save bookings
function saveBookings(bookings) {
  localStorage.setItem("bookings", JSON.stringify(bookings));
}

// 📋 Render bookings
function renderBookings() {
  bookingList.innerHTML = "";
  getBookings().forEach((b, index) => {
    const li = document.createElement("li");
    li.innerHTML = `
      ${b.name} | ${b.date} | ${b.time}
      <div>
        <button class="edit" onclick="editBooking(${index})">✏️</button>
        <button class="delete" onclick="deleteBooking(${index})">❌</button>
      </div>
    `;
    bookingList.appendChild(li);
  });
}

// ❌ Delete booking
function deleteBooking(index) {
  if (!confirm("Delete this booking?")) return;
  let bookings = getBookings();
  bookings.splice(index, 1);
  saveBookings(bookings);
  renderBookings();
}

// ✏️ Edit booking
function editBooking(index) {
  const booking = getBookings()[index];
  nameInput.value = booking.name;
  dateInput.value = booking.date;
  timeSelect.value = booking.time;
  editIndex = index;
}

// ➕ Add / Update booking + ❌ prevent duplicate
form.addEventListener("submit", e => {
  e.preventDefault();

  const name = nameInput.value;
  const date = dateInput.value;
  const time = timeSelect.value;

  let bookings = getBookings();

  const exists = bookings.some((b, i) =>
    b.date === date && b.time === time && i !== editIndex
  );

  if (exists) {
    message.textContent = "❌ This time is already booked!";
    message.style.color = "red";
    return;
  }

  if (editIndex !== null) {
    bookings[editIndex] = { name, date, time };
    editIndex = null;
    message.textContent = "✏️ Booking updated!";
  } else {
    bookings.push({ name, date, time });
    message.textContent = "✅ Booking added!";
  }

  message.style.color = "green";
  saveBookings(bookings);
  form.reset();
  renderBookings();
});

renderBookings();
