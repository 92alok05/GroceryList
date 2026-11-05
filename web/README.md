# Grocery List: Web (PWA)

React + TypeScript + Vite + `vite-plugin-pwa` port of the SwiftUI app. Backed by the Google Apps Script in `../AppsScript/Code.gs` (households, passcodes and per-device tokens stored in a Google Sheet). See `../MIGRATION_PLAN.md`.

Requires Node 18+ (developed on Node 24).

```bash
npm install
npm run dev        # local dev server
npm test           # unit + UI workflow tests (Vitest)
npm run build      # typecheck + production build into dist/
npm run preview    # serve the production build (service worker active)
```

Build-time config (see `.env.example`):
- `VITE_API_URL`: the Apps Script Web App URL. Not a secret; on GitHub Pages it comes from the repo variable `API_URL`.
- `VITE_BASE`: sub-path hosting, e.g. `VITE_BASE=/GroceryList/ npm run build`.

First run: create a household (name + passcode with 8+ characters, a letter, a number and a special character), or join an existing one with its name and passcode. The server returns a random device token, kept only in this device's localStorage; the passcode is never stored on the device. Settings → Leave household revokes the token.

Install on iPhone: open the hosted HTTPS URL in Safari → Share → Add to Home Screen.

Deployed via `.github/workflows/deploy-web.yml`.
