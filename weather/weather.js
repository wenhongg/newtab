// Weather summary line: morning / afternoon / evening for the viewed day.
// Click the line to set or change the city.

import { getViewDate } from "../calendar/calendar.js";
import { dateKey } from "../calendar/dates.js";
import { fetchForecast, geocodeCity } from "./api.js";
import { getCity, setCity } from "./store.js";

const els = {
  line: document.getElementById("weather-line"),
};

const PERIODS = [
  ["morning", 6, 12],
  ["afternoon", 12, 18],
  ["evening", 18, 24],
];
const RAIN_THRESHOLD = 50; // percent
const FORECAST_TTL_MS = 60 * 60 * 1000;

let city = null;
let forecast = null; // { fetchedAt, time[], temperature[], precipProb[] }
let forecastPromise = null; // dedupes concurrent fetches
let fetchSeq = 0;

function clearLine() {
  els.line.textContent = "";
  els.line.classList.add("hidden");
}

// WMO weather code -> monochrome glyph (︎ forces text presentation).
// Checked worst-first since periods report their highest code.
function conditionGlyph(code) {
  if (code >= 95) return "⛈︎";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "❄︎";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "☂︎";
  if (code === 45 || code === 48 || code === 3) return "☁︎";
  if (code === 2) return "⛅︎";
  return "☀︎";
}

// One period's numbers for the given day, or null when the forecast
// doesn't cover it (past days, >16 days out).
function summarizeDay(day) {
  const key = dateKey(day);
  const summary = [];
  for (const [label, fromHour, toHour] of PERIODS) {
    const temps = [];
    const probs = [];
    const codes = [];
    for (let i = 0; i < forecast.time.length; i++) {
      if (!forecast.time[i].startsWith(key)) continue;
      const hour = Number(forecast.time[i].slice(11, 13));
      if (hour < fromHour || hour >= toHour) continue;
      temps.push(forecast.temperature[i]);
      probs.push(forecast.precipProb[i]);
      codes.push(forecast.weatherCode[i]);
    }
    if (temps.length === 0) return null;
    summary.push({
      label,
      temp: Math.round(Math.max(...temps)),
      rain: Math.max(...probs),
      // WMO codes grow roughly with severity; show the period's worst hour.
      code: Math.max(...codes),
    });
  }
  return summary;
}

function renderSummary(summary) {
  els.line.textContent = "";
  const cityName = document.createElement("span");
  cityName.className = "wx-city";
  cityName.textContent = city.name;
  els.line.appendChild(cityName);
  summary.forEach((period) => {
    const sep = document.createElement("span");
    sep.className = "sep";
    sep.textContent = "·";
    els.line.appendChild(sep);
    const seg = document.createElement("span");
    const rainy = period.rain >= RAIN_THRESHOLD;
    seg.className = rainy ? "seg-rain" : "";
    const base = `${period.label} ${conditionGlyph(period.code)} ${period.temp}°`;
    seg.textContent = rainy ? `${base} ${Math.round(period.rain)}%` : base;
    els.line.appendChild(seg);
  });
  els.line.title = `Weather in ${city.name} — click to change city`;
  els.line.classList.remove("hidden");
}

function renderSetCity() {
  els.line.textContent = "";
  const btn = document.createElement("button");
  btn.className = "text-btn weather-set-btn";
  btn.textContent = "set weather city";
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    renderCityInput();
  });
  els.line.appendChild(btn);
  els.line.classList.remove("hidden");
}

function renderCityInput() {
  els.line.textContent = "";
  const input = document.createElement("input");
  input.className = "weather-input";
  input.placeholder = "City for weather…";
  input.value = city?.name || "";
  input.addEventListener("keydown", async (e) => {
    if (e.key === "Escape") {
      city ? update() : renderSetCity();
      return;
    }
    if (e.key !== "Enter") return;
    const name = input.value.trim();
    if (!name) return;
    input.disabled = true;
    try {
      const hit = await geocodeCity(name);
      if (!hit) {
        input.disabled = false;
        input.value = "";
        input.placeholder = "City not found — try again";
        input.focus();
        return;
      }
      await setCity(hit);
      city = hit;
      // New coordinates: drop the old forecast and anything in flight.
      forecast = null;
      forecastPromise = null;
      fetchSeq++;
      update();
    } catch {
      input.disabled = false;
      input.placeholder = "Couldn't look that up — try again";
      input.focus();
    }
  });
  els.line.appendChild(input);
  els.line.classList.remove("hidden");
  input.focus();
}

function ensureForecast() {
  if (forecast && Date.now() - forecast.fetchedAt < FORECAST_TTL_MS) {
    return Promise.resolve();
  }
  // One 16-day fetch covers every day the user can page to — rapid
  // navigation while it's in flight must not start duplicates.
  if (!forecastPromise) {
    const seq = ++fetchSeq;
    const p = fetchForecast(city.latitude, city.longitude)
      .then((data) => {
        if (seq === fetchSeq) {
          forecast = { fetchedAt: Date.now(), ...data };
        }
      })
      .finally(() => {
        if (forecastPromise === p) forecastPromise = null;
      });
    forecastPromise = p;
  }
  return forecastPromise;
}

async function update() {
  if (!city) {
    city = await getCity();
  }
  if (!city) {
    renderSetCity();
    return;
  }
  try {
    await ensureForecast();
    const summary = summarizeDay(getViewDate());
    // Quietly absent for days the forecast can't cover.
    summary ? renderSummary(summary) : clearLine();
  } catch {
    clearLine(); // weather is a nicety — never surface errors on the page
  }
}

// Clicking the rendered line re-opens the city input (ignore clicks on the
// set-city button, which handles itself).
els.line.addEventListener("click", (e) => {
  if (city && e.target.tagName !== "INPUT") {
    renderCityInput();
  }
});

document.addEventListener("viewdatechange", update);
update();
