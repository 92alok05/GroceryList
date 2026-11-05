# Grocery List: SwiftUI → Hosted PWA Migration Plan

Status: **audit complete, local implementation in `web/`. Nothing is deployed.** The iOS app is untouched.

## 1. Audit summary

The app is small: 13 Swift files (~1,150 lines), one SwiftData entity, one remote (a Google Apps Script web app backed by a Google Sheet), no third-party Swift dependencies, no entitlements, no push/background/camera/location/keychain usage.

### 1.1 Screens and navigation

```
ContentView (TabView, 3 tabs)  ── fullScreenCover: TutorialView (first launch / Settings → Replay)
├─ All Items tab   → NavigationStack → ItemListView
│     ├─ sheet: AddEditItemView (add via "+", edit via tapping an item's text)
│     ├─ searchable (name or store), pull-to-refresh = sync
│     ├─ leading swipe (Due Soon only): Extend      trailing swipe: Delete
│     └─ status icon tap: toggle Needed/Due Soon → Bought, Bought → Needed
├─ Store Mode tab  → NavigationStack → StoreModeView (store list)
│     └─ push: StoreChecklistView(store)  (tap row = toggle, leading swipe = Extend,
│                                          onAppear = cadence refresh, pull-to-refresh = sync)
└─ Settings tab    → SettingsView (Web App URL, shared secret, Sync Now, last synced, error, Replay Tutorial)
```

App lifecycle: when the scene becomes `.active`, run `CadenceRefreshService` and then `SheetSyncService.syncAll`.

### 1.2 Models, services, persistence

| Concept | Source | Behaviour that must be preserved |
|---|---|---|
| `GroceryItem` (SwiftData) | `Models/GroceryItem.swift` | Fields: id (UUID), name, recommendedStore, recommendedQuantity (string), cadenceRaw, customCadenceDays, isChecked, lastCheckedDate?, updatedAt, isSyncedToRemote |
| `RepeatCadence` | same | One Time=nil, Daily=1, Weekly=7, Every 2 Weeks=14, Monthly=30, Custom=max(n,1) days |
| `ItemStatus` | same | unchecked → needed; checked with no cadence → bought; `now >= next due` → needed; within last `max(days*0.25, 0.25)` days (as `Int(buffer*24)` hours) before due → dueSoon; else bought |
| `snooze()` | same | `lastCheckedDate += cadence days`; `updatedAt = now`; no-op for One Time / never-checked |
| `CadenceRefreshService` | `ViewModels/` | For checked items past due: `isChecked=false`, `lastCheckedDate=nil`. Intentionally does **not** bump `updatedAt` or push |
| `SheetSyncService` | `ViewModels/` | Pull all → per item: remote newer ⇒ apply, local newer ⇒ push, equal ⇒ nothing; synced-before-but-missing-remotely ⇒ delete locally; never-synced ⇒ push; remote-only ⇒ insert. Then push. Per-mutation fire-and-forget upsert/delete. Errors only recorded in `lastSyncError` |
| `SyncSettings` | `ViewModels/` | URL + secret + lastSyncedAt in UserDefaults; `isConfigured` = both non-blank |
| `TutorialState` | `Views/ContentView.swift` | `hasSeenOnboardingTutorial` flag; `replay()` |
| Store list | `AddEditItemView`, `StoreModeView` | Defaults Safeway, Target, Trader Joe's, Indian Store ∪ stores used by items, plain `sorted()`; "Add New Store…" option; Store Mode lists only stores that have items |
| Self-healing store | `GroceryListApp.swift` | On store load failure, wipe and recreate rather than crash |
| Apps Script backend | `AppsScript/Code.gs` | `GET ?action=list&token=…`, `POST {action:upsert,token,item}` / `{action:delete,token,id}`; JSON `{items}` / `{success}` / `{error}`. **Reused unchanged** |

### 1.3 Dependencies
Swift: SwiftUI, SwiftData, CoreData (only for store reset), Foundation. No SPM packages. Tooling: XcodeGen.

### 1.4 iOS-specific APIs vs. browser support

| iOS API / feature | Browser equivalent | Verdict |
|---|---|---|
| SwiftData persistence | IndexedDB/localStorage | ✅ Reproducible (see §1.5) |
| `UserDefaults` | localStorage | ✅ |
| `URLSession` | `fetch` | ✅ with CORS caveat below |
| `scenePhase == .active` | `document.visibilitychange` (+ `focus`) | ✅ |
| `TabView` / `NavigationStack` / sheets / fullScreenCover | Hand-built components (hash router, modal) | ✅ Re-implemented, not pixel-identical |
| `List` swipeActions (Extend / Delete) | Pointer-event swipe gesture | ⚠️ Reproducible with custom code; less discoverable on desktop |
| `.refreshable` pull-to-refresh | Custom touch gesture (Safari standalone PWAs have no native pull-to-refresh) | ⚠️ Custom code |
| `.searchable` | Inline search field | ✅ (no collapsing nav-bar search) |
| `ContentUnavailableView` | Custom empty state | ✅ |
| `.tabViewStyle(.page)` tutorial pager | CSS scroll-snap carousel + dots | ✅ |
| **SF Symbols** (`cart`, `circle`, `checkmark.circle.fill`, `clock.badge.exclamationmark.fill`, …) | **Not usable on the web** (Apple licence restricts SF Symbols to Apple platforms) | ❌ **Cannot be reproduced exactly.** Replaced by original inline SVGs of similar shape; please review visually |
| SF Pro system font / Dynamic Type | `-apple-system` font stack | ✅ Renders SF on iOS; Dynamic Type approximated by `rem` units only |
| `ISO8601DateFormatter` | `Date#toISOString` / `Date.parse` | ✅ Same wire format |
| `Calendar.current.date(byAdding: .day…)` | `Date#setDate` (local calendar, DST-aware) | ✅ |
| `localizedCaseInsensitive*` | `Intl.Collator` / `toLocaleLowerCase` | ✅ |
| `SecureField` | `<input type=password>` | ✅ |
| Local code signing / 7-day expiry | N/A | ✅ Eliminated |
| App icon | `manifest.webmanifest` icons + `apple-touch-icon` generated from `AppIcon-1024.png` | ✅ |
| Launch screen | iOS PWA splash is derived from icon/background colour | ⚠️ Close, not identical |
| Haptics, push, widgets, Siri | not used by the app | n/a |

Nothing the original app does is impossible in a browser other than the SF Symbols note above.

### 1.4a Behaviours / discrepancies noticed (not changed, flagged for your decision)

1. **README says "Swipe left → Extend"**, but the code uses `swipeActions(edge: .leading)`, i.e. swipe **right**. The PWA follows the code (swipe right = Extend, swipe left = Delete in All Items).
2. **Offline deletions are not retried.** `pushDeletionInBackground` is fire-and-forget; if offline, the item is deleted locally, and the next `syncAll` re-downloads it from the sheet (remote-only items are inserted). The PWA reproduces this faithfully.
3. **Cadence refresh is local-only** (does not bump `updatedAt`); reproduced as is.
4. **Secret travels in the URL query string for `list`** (Apps Script contract). Proxies/Google may log it. Fixing it requires a backend change, so it is out of scope; see §4 hardening options.
5. **Timestamp round-tripping through Google Sheets is unverified.** `Code.gs` returns `String(cell)`. If Sheets auto-converts ISO strings into real dates, `String()` yields a non-ISO string. The iOS parser would then fall back to `distantPast`. The PWA parser accepts ISO and any `Date.parse`-able string and otherwise falls back to epoch, matching iOS. **Verify against your real sheet during review.**
6. Monthly = 30 days. Due Soon for Daily = last 6 hours.

### 1.5 Local storage and data migration

* iOS SwiftData store lives in the app sandbox and **cannot be read by a website**. The Google Sheet is the migration path.
* **Before switching:** in the iOS app tap *Settings → Sync Now* so every item has been pushed (items never synced have `isSyncedToRemote=false` and exist only on that phone).
* In the PWA: enter the same Web App URL and secret → first sync pulls the full list (the PWA, like new iOS installs, starts empty and does not seed).
* Web persistence: versioned JSON in `localStorage` (list is tiny) with a reset-on-corruption fallback mirroring the "self-healing store". `navigator.storage.persist()` is requested. Installed Home Screen PWAs are exempt from Safari's 7-day script-storage eviction, but a browser-tab visit is not, which is another reason to install it.
* Per-device state kept: items, sync settings, `lastSyncedAt`, `hasSeenOnboardingTutorial`.

### 1.6 Authentication, server APIs, shared data

* No user accounts. "Auth" = shared secret known to the family, checked by Apps Script (`token`).
* All shared data lives in the Google Sheet via the Apps Script Web App (access: Anyone, execute as owner).
* **CORS:** Apps Script web apps answer cross-origin `GET`s and "simple" `POST`s, but cannot answer a `OPTIONS` preflight. The PWA therefore sends POST bodies as `Content-Type: text/plain;charset=utf-8` (Apps Script still reads `postData.contents` as JSON). No backend change needed. **Must be confirmed against your real deployment** (a limitation I cannot test from here).
* Secure session handling: the secret is stored only in this device's `localStorage`, never in the bundle, never in the build, never logged, and sent over HTTPS only (the client refuses non-`https://` URLs). Strict CSP (`connect-src 'self' https://script.google.com https://script.googleusercontent.com`), no third-party scripts/fonts, `Referrer-Policy: no-referrer` meta. Host with HTTPS (HSTS from the host).
* Privacy: no analytics, no tracking, no cookies.

## 2. Migration matrix

Complexity: S/M/L.

| Swift file | Purpose | Web equivalent (`web/src/…`) | Reuse strategy | Cx |
|---|---|---|---|---|
| `Models/GroceryItem.swift` | Entity, cadence, status, snooze | `domain/item.ts`, `domain/cadence.ts`, `domain/status.ts` | Port logic 1:1, pure functions + unit tests | M |
| `ViewModels/CadenceRefreshService.swift` | Auto-uncheck | `domain/refresh.ts` | Port 1:1 | S |
| `ViewModels/SheetSyncService.swift` | Two-way sync | `sync/merge.ts` (pure planner), `sync/sheetClient.ts` (fetch), `sync/syncService.ts` | Same algorithm and wire format; backend reused unchanged | L |
| `ViewModels/SyncSettings.swift` | URL/secret storage | `storage/settings.ts` | localStorage | S |
| `GroceryListApp.swift` | Container, lifecycle sync | `storage/itemStore.ts`, `App.tsx` visibility handler | Versioned store + reset-on-corruption | M |
| `Views/ContentView.swift` (+`TutorialState`) | Tab bar, tutorial gate | `App.tsx`, `components/TabBar.tsx`, `storage/tutorial.ts` | Re-implement | M |
| `Views/ItemListView.swift` | All Items | `screens/ItemListScreen.tsx`, `components/ItemRow.tsx`, `SwipeRow.tsx`, `PullToRefresh.tsx`, `StatusIcon.tsx` | Re-implement; logic from `domain/` | L |
| `Views/AddEditItemView.swift` | Add/Edit form | `screens/AddEditItemSheet.tsx`, `domain/stores.ts` | Re-implement; store list logic ported | M |
| `Views/StoreModeView.swift` | Store list | `screens/StoreModeScreen.tsx` | Re-implement | S |
| `Views/StoreChecklistView.swift` | Per-store checklist | `screens/StoreChecklistScreen.tsx` | Re-implement | M |
| `Views/SettingsView.swift` | Sync config | `screens/SettingsScreen.tsx` | Re-implement | S |
| `Views/TutorialView.swift` | 7-page onboarding | `screens/TutorialScreen.tsx` | Copy text verbatim; scroll-snap pager | M |
| `Assets.xcassets/AppIcon` | Icon | `web/public/icons/*` (generated with `sips`) | Reuse artwork | S |
| `Info.plist`, `project.yml` | iOS config | `vite.config.ts` manifest | Display name "Grocery List", portrait | S |
| `AppsScript/Code.gs` | Backend | — | **Unchanged, reused** | — |

## 3. Incremental execution plan (testable milestones)

| # | Milestone (one workflow at a time) | Validation |
|---|---|---|
| M0 | Scaffold Vite + React + TS + vite-plugin-pwa + Vitest | `npm run build`, `npm test` green |
| M1 | Domain logic: cadence, status, snooze, refresh, sort, stores | Unit tests incl. Due Soon boundaries, DST-safe day math |
| M2 | Persistence + **Browse/Check workflow**: All Items list, status icons, toggle, search, sorting, empty states | Tests + manual |
| M3 | **Add/Edit/Delete workflow** (sheet form, stores, custom cadence, swipe delete) | Tests + manual |
| M4 | **Extend (snooze) workflow** + swipe gestures | Tests + manual |
| M5 | **Store Mode workflow** (list → checklist, refresh on open) | Manual |
| M6 | **Sync workflow**: merge planner, sheet client, Settings, pull-to-refresh, visibility sync | Unit tests with mocked fetch; **manual test against real Apps Script (user)** |
| M7 | **Onboarding workflow** (tutorial, skip, replay) | Manual |
| M8 | PWA: manifest, icons, service worker precache, standalone meta, offline shell | Lighthouse/`vite preview`, airplane-mode check |
| M9 | Review gate (you) → choose host → deploy | **Not started, awaiting your approval** |

## 4. Deployment options (for later, not executed)

Static host with HTTPS: Cloudflare Pages, Netlify, or GitHub Pages (note: this repo is public; the bundle contains no secrets, so that is acceptable, but the hosted URL is guessable). Set `VITE_BASE` for sub-path hosting (e.g. `/GroceryList/`). Family installs via Safari → Share → Add to Home Screen.

Optional hardening needing a backend change (not done): move `list` to `POST`, per-person tokens, rate limiting.

## 5. Risks / open questions for you

1. Confirm CORS behaviour and timestamp format against your live Apps Script (§1.4a-5, §1.6).
2. Approve SVG icon substitutes for SF Symbols.
3. Accept faithful reproduction of the quirks in §1.4a (offline delete, README/code swipe direction).
4. Hosting provider choice.
