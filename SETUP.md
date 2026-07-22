# Setup

One-time setup to connect the extension to Google Calendar.

## 1. Load the extension

1. Open `chrome://extensions`, turn on **Developer mode** (top right).
2. Click **Load unpacked** and select this folder.
3. The extension ID should be `iobkbdlnjeijdpnokfgolaijmfffkdjo` — it is pinned by
   the `key` field in `manifest.json`, so it stays the same even if you move or
   re-clone this folder. Verify it matches on the extension card.

## 2. Create a Google Cloud OAuth client

1. Go to [Google Cloud Console](https://console.cloud.google.com/) and create a
   project (any name, e.g. "Day Tab").
2. **APIs & Services → Library** → search for **Google Calendar API** → **Enable**.
3. **APIs & Services → OAuth consent screen**:
   - User type: **External**, then fill in the app name and your email.
   - Add the scope `https://www.googleapis.com/auth/calendar.events.readonly`.
   - Under **Test users**, add your own Google account. Leave the app in
     **Testing** status — no verification needed for personal use.
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - Application type: **Chrome Extension**
   - Item ID: `iobkbdlnjeijdpnokfgolaijmfffkdjo`
5. Copy the generated **Client ID** (ends in `.apps.googleusercontent.com`).

## 3. Configure the extension

1. In `manifest.json`, replace the `oauth2.client_id` value with your own
   client ID. (The one shipped in this repo belongs to the published
   Chrome Web Store build and only works with its extension ID.)
2. Back on `chrome://extensions`, click the reload icon on the extension.
3. Open a new tab and click **Connect Google Calendar**. Chrome shows a Google
   consent screen — an "unverified app" warning is expected for apps in Testing
   status; continue through it and grant read-only calendar access.

## Notes

- Events are read from your **primary** calendar only; shared or secondary
  calendars aren't shown.
- To-dos are stored in `chrome.storage.sync`, so they follow your Chrome
  profile across machines.
