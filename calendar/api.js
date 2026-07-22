// Google Calendar auth + API access. No DOM code here.

export function clientIdConfigured() {
  const { oauth2 } = chrome.runtime.getManifest();
  return oauth2 && !oauth2.client_id.startsWith("YOUR_CLIENT_ID");
}

export function getToken(interactive) {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive }, (token) => {
      if (chrome.runtime.lastError || !token) {
        reject(new Error(chrome.runtime.lastError?.message || "No token"));
      } else {
        resolve(token);
      }
    });
  });
}

function removeCachedToken(token) {
  return new Promise((resolve) => {
    chrome.identity.removeCachedAuthToken({ token }, resolve);
  });
}

// RFC3339 timestamp with the real local UTC offset (Date.toISOString always
// emits Z, which shifts day boundaries for non-UTC users).
function rfc3339(date) {
  const pad = (n) => String(n).padStart(2, "0");
  const offsetMin = -date.getTimezoneOffset();
  const sign = offsetMin >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMin);
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
}

export class ApiError extends Error {
  constructor(status) {
    super(`Calendar API error (${status})`);
    this.status = status;
  }
}

// Events between two local-time Dates (start inclusive, end exclusive).
export async function fetchEventsForRange(start, end) {
  const params = new URLSearchParams({
    timeMin: rfc3339(start),
    timeMax: rfc3339(end),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "250",
  });
  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`;

  let token = await getToken(false);
  let res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 401) {
    await removeCachedToken(token);
    token = await getToken(false);
    res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  }
  if (!res.ok) {
    throw new ApiError(res.status);
  }
  const data = await res.json();
  return data.items || [];
}
