// Day view: date header, prev/next navigation, week strip, agenda rendering.
// Events are fetched one week at a time and cached; day navigation within
// the cached week renders instantly without refetching.

import { ApiError, clientIdConfigured, getToken } from "./api.js";
import { fetchMergedEvents } from "./calendars.js";
import {
  addDays,
  dateKey,
  eventCountsByDay,
  eventsOnDay,
  isToday,
  startOfDay,
  weekStartOf,
} from "./dates.js";

const els = {
  weekday: document.getElementById("weekday"),
  dayNumber: document.getElementById("day-number"),
  monthYear: document.getElementById("month-year"),
  tzLabel: document.getElementById("tz-label"),
  prevDay: document.getElementById("prev-day"),
  nextDay: document.getElementById("next-day"),
  todayBtn: document.getElementById("today-btn"),
  weekStrip: document.getElementById("week-strip"),
  setupNotice: document.getElementById("setup-notice"),
  connectPanel: document.getElementById("connect-panel"),
  agendaStatus: document.getElementById("agenda-status"),
  eventList: document.getElementById("event-list"),
  fetchStamp: document.getElementById("fetch-stamp"),
  connectBtn: document.getElementById("connect-btn"),
};

let viewDate = startOfDay(new Date());
let weekSeq = 0; // guards against stale responses on rapid navigation
let weekCache = { startMs: null, events: [], counts: new Map(), fetchedAt: null };

function formatTime(date) {
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function renderHeader() {
  els.weekday.textContent = viewDate.toLocaleDateString([], { weekday: "long" });
  els.dayNumber.textContent = viewDate.getDate();
  els.monthYear.textContent = viewDate.toLocaleDateString([], {
    month: "long",
    year: "numeric",
  });
  els.monthYear.href =
    "https://calendar.google.com/calendar/u/0/r/day/" +
    `${viewDate.getFullYear()}/${viewDate.getMonth() + 1}/${viewDate.getDate()}`;
  els.todayBtn.classList.toggle("hidden", isToday(viewDate));

  // System timezone; the offset is per viewed date so DST reads correctly.
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const offset = new Intl.DateTimeFormat([], { timeZoneName: "shortOffset" })
    .formatToParts(viewDate)
    .find((part) => part.type === "timeZoneName")?.value;
  els.tzLabel.textContent = offset ? `${zone} · ${offset}` : zone;
}

export function goToDate(date) {
  viewDate = startOfDay(date);
  renderHeader();
  renderWeekStrip();
  loadDay();
  // Lets other modules (e.g. weather) follow day navigation without the
  // calendar needing to know about them; listeners read getViewDate().
  document.dispatchEvent(new Event("viewdatechange"));
}

export function getViewDate() {
  return viewDate;
}

function hasCachedWeek(weekStart) {
  return weekCache.startMs === weekStart.getTime();
}

function renderWeekStrip() {
  const weekStart = weekStartOf(viewDate);
  const cached = hasCachedWeek(weekStart);
  els.weekStrip.textContent = "";

  for (let i = 0; i < 7; i++) {
    const day = addDays(weekStart, i);
    const cell = document.createElement("button");
    cell.className = "ws-cell";
    cell.classList.toggle("selected", day.getTime() === viewDate.getTime());
    cell.classList.toggle("today", isToday(day));

    const dow = document.createElement("p");
    dow.className = "ws-dow";
    dow.textContent = day.toLocaleDateString([], { weekday: "short" });
    cell.appendChild(dow);

    const num = document.createElement("p");
    num.className = "ws-num";
    num.textContent = day.getDate();
    cell.appendChild(num);

    const dots = document.createElement("span");
    dots.className = "ws-dots";
    const count = cached ? weekCache.counts.get(dateKey(day)) || 0 : 0;
    for (let d = 0; d < Math.min(count, 3); d++) {
      dots.appendChild(document.createElement("i"));
    }
    cell.appendChild(dots);

    cell.addEventListener("click", () => goToDate(day));
    els.weekStrip.appendChild(cell);
  }
}

function setAgendaStatus(message) {
  els.agendaStatus.textContent = message || "";
  els.agendaStatus.classList.toggle("hidden", !message);
}

function renderEvents(events) {
  els.eventList.textContent = "";
  if (events.length === 0) {
    setAgendaStatus("Nothing scheduled.");
    return;
  }
  setAgendaStatus("");

  const allDay = events.filter((e) => e.start?.date);
  const timed = events.filter((e) => e.start?.dateTime);
  const now = new Date();

  for (const event of [...allDay, ...timed]) {
    const li = document.createElement("li");
    li.className = "event";

    const dot = document.createElement("span");
    dot.className = "event-dot";
    if (event.calendarColor) {
      dot.style.backgroundColor = event.calendarColor;
    }
    li.appendChild(dot);

    const addLine = (cls, text) => {
      const p = document.createElement("p");
      p.className = cls;
      p.textContent = text;
      li.appendChild(p);
    };

    if (event.start.dateTime) {
      const start = new Date(event.start.dateTime);
      const end = event.end?.dateTime ? new Date(event.end.dateTime) : start;
      addLine("event-time", `${formatTime(start)} – ${formatTime(end)}`);

      const minutesAway = Math.ceil((start - now) / 60000);
      if (minutesAway > 0 && minutesAway <= 60) {
        li.classList.add("has-soon");
        const soon = document.createElement("span");
        soon.className = "event-soon";
        soon.textContent = `in ${minutesAway} min`;
        li.appendChild(soon);
      }
    } else {
      addLine("event-time", "All day");
    }
    addLine("event-title", event.summary || "(No title)");
    if (event.location) {
      addLine("event-location", event.location);
    }

    els.eventList.appendChild(li);
  }
}

function showAgendaFromCache() {
  renderEvents(eventsOnDay(weekCache.events, viewDate));
  els.fetchStamp.textContent = `updated ${formatTime(weekCache.fetchedAt)}`;
  els.fetchStamp.classList.remove("hidden");
  els.connectPanel.classList.add("hidden");
}

async function loadDay() {
  const weekStart = weekStartOf(viewDate);
  if (hasCachedWeek(weekStart)) {
    showAgendaFromCache(); // instant — no request, no loading flicker
    return;
  }

  const seq = ++weekSeq;
  els.eventList.textContent = "";
  els.fetchStamp.classList.add("hidden");
  setAgendaStatus("Loading…");
  try {
    const events = await fetchMergedEvents(weekStart, addDays(weekStart, 7));
    if (seq !== weekSeq) return; // a newer request superseded this one
    // The user may have navigated to a different week and back while this
    // fetch was in flight — only keep the result if it's still on screen.
    if (weekStart.getTime() !== weekStartOf(viewDate).getTime()) return;
    weekCache = {
      startMs: weekStart.getTime(),
      events,
      counts: eventCountsByDay(events),
      fetchedAt: new Date(),
    };
    renderWeekStrip();
    showAgendaFromCache();
  } catch (err) {
    if (seq !== weekSeq) return;
    if (err instanceof ApiError) {
      setAgendaStatus(`Couldn't load events. ${err.message}`);
    } else {
      // Not signed in (or consent revoked) — offer interactive connect.
      setAgendaStatus("");
      els.connectPanel.classList.remove("hidden");
    }
  }
}

els.prevDay.addEventListener("click", () => goToDate(addDays(viewDate, -1)));
els.nextDay.addEventListener("click", () => goToDate(addDays(viewDate, 1)));
els.todayBtn.addEventListener("click", () => goToDate(new Date()));

els.connectBtn.addEventListener("click", async () => {
  try {
    await getToken(true);
    els.connectPanel.classList.add("hidden");
    loadDay();
  } catch (err) {
    setAgendaStatus("Sign-in was cancelled or failed. Try again.");
  }
});

// Picker toggles (this tab or another) change what should be shown.
document.addEventListener("calendarschange", () => {
  weekCache = { startMs: null, events: [], counts: new Map(), fetchedAt: null };
  renderWeekStrip();
  loadDay();
});

// Keep the "in N min" badges honest if a tab stays open.
setInterval(() => {
  if (hasCachedWeek(weekStartOf(viewDate))) {
    showAgendaFromCache();
  }
}, 60000);

renderHeader();
renderWeekStrip();
if (clientIdConfigured()) {
  loadDay();
} else {
  els.setupNotice.classList.remove("hidden");
}
