let events = JSON.parse(localStorage.getItem("calendarEvents")) || {};

function saveEvents() {
  localStorage.setItem("calendarEvents", JSON.stringify(events));
}

function addEvent() {
  const person = document.getElementById("person").value.trim();
  const title = document.getElementById("title").value.trim();
  const notes = document.getElementById("notes").value.trim();
  const date = document.getElementById("dateSelect").value;

  if (!person || !title || !date) {
    alert("Please fill in Person, Title, and Date!");
    return;
  }

  const eventData = {
    person,
    title,
    notes
  };

  if (!events[date]) {
    events[date] = [];
  }

  events[date].push(eventData);

  saveEvents();
  renderEvents();

  document.getElementById("person").value = "";
  document.getElementById("title").value = "";
  document.getElementById("notes").value = "";
}

function renderEvents() {
  document.querySelectorAll(".day").forEach(day => {
    const existing = day.querySelectorAll(".event");
    existing.forEach(e => e.remove());
  });

  for (let date in events) {
    const dayElement = document.querySelector(`.day[data-day="${date}"]`);

    if (dayElement) {
      events[date].forEach(ev => {
        const div = document.createElement("div");
        div.classList.add("event");

        div.innerHTML = `
          <strong>${ev.person}</strong><br>
          ${ev.title}
        `;

        if (ev.notes) {
          div.title = ev.notes;
        }

        dayElement.appendChild(div);
      });
    }
  }
}

window.onload = renderEvents;