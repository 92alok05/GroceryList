# Grocery List: Web (PWA)

React + TypeScript + Vite + `vite-plugin-pwa` port of the SwiftUI app. Reuses the existing Google Apps Script backend unchanged. See `../MIGRATION_PLAN.md`.

Requires Node 18+ (developed on Node 24).

```bash
npm install
npm run dev        # local dev server
npm test           # unit + UI workflow tests (Vitest)
npm run build      # typecheck + production build into dist/
npm run preview    # serve the production build (service worker active)
```

Hosting under a sub-path (e.g. GitHub Pages): `VITE_BASE=/GroceryList/ npm run build`.

First run: Settings → paste the same Web App URL and shared secret used by the iOS app → Sync Now. The secret is kept only in this device's localStorage.

Install on iPhone: open the hosted HTTPS URL in Safari → Share → Add to Home Screen.

Not deployed yet; pending review.
