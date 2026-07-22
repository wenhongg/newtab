# Day Tab — Privacy Policy

_Last updated: July 22, 2026_

Day Tab is a Chrome new-tab extension that shows your Google Calendar day,
a to-do list, a scratchpad, and a weather summary. It is built so that your
data stays between your browser and the services you explicitly connect —
**Day Tab has no servers, no analytics, and no tracking of any kind.**

## What the extension accesses and where it goes

**Google Calendar (optional, read-only).** If you connect Google Calendar,
the extension requests the `calendar.events.readonly` scope and fetches
events directly from Google's Calendar API to display them on your new-tab
page. Event data is held in memory only, is never written to disk or
extension storage, and is never sent anywhere other than back to your
screen. Sign-in is handled by Chrome's built-in identity system; the
extension never sees your password and does not store OAuth tokens itself.

**To-dos and scratchpad.** Stored in Chrome's `storage.sync`, which syncs
them across your own Chrome profile via your Google account. They are never
transmitted to the developer or any third party.

**Weather (optional).** If you set a weather city, the city name you type
is sent once to Open-Meteo's geocoding service, and the resulting
coordinates are sent to Open-Meteo's forecast API (open-meteo.com, a
keyless, account-free weather service) to fetch forecasts. No other data —
nothing from your calendar, to-dos, or notes — is ever included in these
requests. The chosen city is stored in Chrome's `storage.sync`.

## What the extension does NOT do

- No data is sent to the developer — there is no backend.
- No analytics, telemetry, crash reporting, or advertising identifiers.
- No sale or sharing of user data with anyone.
- No reading of browsing history, tabs, or any site content.

## Data retention and deletion

All stored data (to-dos, scratchpad, weather city) lives in your Chrome
profile's sync storage. Removing the extension deletes it. Calendar access
can be revoked at any time at
[myaccount.google.com/permissions](https://myaccount.google.com/permissions).

## Contact

Questions about this policy: open an issue on the project's GitHub
repository, or email lamwh55@gmail.com.
