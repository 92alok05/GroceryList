# Grocery List

A native SwiftUI + SwiftData iOS app for managing a recurring household grocery list, organized by store.

**Version:** v1.1 ("Local App" — Google Sheets family sync, Due Soon status, app icon)

## Features

### Core item management
- Add/edit/delete grocery items, each with: name, recommended store, recommended quantity, and repeat cadence
- Repeat cadence options: One Time (default), Daily, Weekly, Every 2 Weeks, Monthly, or Custom (user-specified number of days)

### Store handling
- Recommended store is a dropdown, prepopulated with **Safeway, Target, Trader Joe's, Indian Store**
- Any new store name typed in becomes available in the dropdown for future items automatically

### All Items view (global list)
- Shows every item with a status icon: empty circle (Needed), orange hourglass (Due Soon), or green checkmark (Bought)
- Checking/unchecking here is reflected everywhere (shared state)
- Built-in search bar — filter by item name or store name, with check/uncheck available directly on search results
- Items are grouped/sorted: Needed first, then Due Soon, then Bought — alphabetical within each group

### Store Mode (per-store checklist)
- Pick a store, see only that store's items as a checklist for in-aisle shopping
- Tap to check off items while shopping
- Same Needed → Due Soon → Bought sort order as the All Items view

### Item status & Due Soon
- Each item has one of three statuses, shown as its icon:
  - **Needed** (empty circle) — not bought, or its cadence has fully elapsed
  - **Due Soon** (orange hourglass) — bought, but within the last 25% of its cadence length before it's due again (e.g. ~2 days before due for a Weekly item, ~7 days for Monthly)
  - **Bought** (green checkmark) — bought and comfortably not due again yet
- Tapping the icon on a Needed or Due Soon item marks it Bought and resets its cadence clock to now
- Tapping the checkmark on a Bought item undoes it back to Needed
- **Swipe left → Extend** on a Due Soon item pushes its due date forward by one more full cadence length (e.g. +7 days for Weekly), without marking it freshly bought — useful when you need more time before restocking

### Automatic cadence refresh
- Checked items automatically become unchecked again (flip to Needed) once their cadence period fully elapses (e.g., a weekly item reappears as "needed" 7 days after being checked)
- One Time items never auto-reset
- Refresh runs on app foreground and whenever a store checklist is opened

### Pre-installed default items
These 35 items were originally seeded on first launch of the very first install. Since Google Sheets sync now exists, **new installs no longer auto-seed** — instead they start empty and pull the shared list down from the Sheet on first sync, avoiding duplicate entries across devices. The original starter set (for reference / re-adding manually if needed) was:

**Safeway** (weekly): Chicken ×2, Eggs ×18, Greek yogurt, Fruits, Milk

**Indian Store** (weekly): Methi ×4, Cucumber ×4, Beet ×3, Carrot ×6, Tomato ×7, Paneer, Palak ×4, Beans, Green peas, Sweet potato ×4, Normal potato ×5, Coconut, Walnuts, Almonds, Raisins, Coriander ×3, Cabbage, Moringa ×2, Brinjal ×2

**Indian Store — One Time**: Moong dal, Jowar, Atta, Eno, Besan, Peanuts, Ragda chana, Matki, Moong, Chole, Rice

### Persistence & resilience
- Local on-device storage via SwiftData; survives app restarts
- Self-healing store: if a schema/migration mismatch is ever detected, the app resets the local store instead of crashing

### Family sharing via Google Sheets
- The list can be shared across family members' iPhones using a Google Sheet as a lightweight remote "server" (see [Sharing setup](#sharing-setup-google-sheets-sync) below)
- Local storage remains the offline cache — the app fully works without internet and syncs automatically when back online
- Conflict resolution: whichever copy (local device or the sheet) was updated most recently wins
- Deletions sync too — removing an item on one phone removes it everywhere after the next sync
- Sync triggers: automatically when the app is foregrounded, via pull-to-refresh on the All Items / Store checklist screens, or manually via the **Sync Now** button in Settings

## App identity
- Display name: **Grocery List**
- Bundle ID: `com.aljoshi.grocerylist.GroceryList`
- Minimum deployment target: iOS 17.0

## Project structure

```
GroceryList/
├── project.yml                       # XcodeGen project spec (source of truth)
├── GroceryList/
│   ├── GroceryListApp.swift          # App entry point, ModelContainer setup
│   ├── Info.plist
│   ├── Assets.xcassets/
│   │   └── AppIcon.appiconset/        # App icon (shopping cart + checkmark badge)
│   ├── Models/
│   │   └── GroceryItem.swift         # SwiftData model + RepeatCadence enum + ItemStatus (Needed/Due Soon/Bought)
│   ├── ViewModels/
│   │   ├── CadenceRefreshService.swift  # Auto-uncheck logic based on cadence
│   │   ├── SyncSettings.swift            # Stores the Web App URL + shared secret
│   │   └── SheetSyncService.swift        # Push/pull/merge sync with Google Sheet
│   └── Views/
│       ├── ContentView.swift          # Root TabView
│       ├── ItemListView.swift         # All Items tab (search, status icons, sorted by status)
│       ├── AddEditItemView.swift      # Add/edit item form
│       ├── StoreModeView.swift        # Store picker tab
│       ├── StoreChecklistView.swift   # Per-store checklist, sorted by status
│       └── SettingsView.swift         # Sync configuration + manual sync button
└── AppsScript/
    └── Code.gs                        # Google Apps Script "server" (deploy this to your Sheet)
```

## Building & running

This project uses [XcodeGen](https://github.com/yonaskolb/XcodeGen) to generate the `.xcodeproj` from `project.yml`, so the Xcode project itself is not committed to source control.

### Prerequisites
- Xcode (with iOS 17+ SDK)
- [XcodeGen](https://github.com/yonaskolb/XcodeGen): `brew install xcodegen`

### Steps
```bash
git clone https://github.com/92alok05/GroceryList.git
cd GroceryList
xcodegen generate
open GroceryList.xcodeproj
```

Then in Xcode:
1. Select the **GroceryList** target → **Signing & Capabilities** tab.
2. Choose your **Team** under Automatically manage signing (sign in via Xcode → Settings → Accounts if needed).
3. Select a simulator or your connected iPhone as the run destination.
4. Press **⌘R** to build and run.

### Command-line build (simulator)
```bash
xcodebuild -project GroceryList.xcodeproj -scheme GroceryList \
  -destination 'generic/platform=iOS Simulator' build
```

## Sharing setup (Google Sheets sync)

To share the list across family members' iPhones, one person sets up a Google Sheet + Apps Script "server" once, then everyone enters the same connection details in the app's Settings tab.

### 1. Create the Google Sheet
1. Create a new Google Sheet.
2. Rename the first tab to exactly `GroceryItems`.
3. In row 1, add these exact column headers (columns A–I):
   ```
   id | name | recommendedStore | recommendedQuantity | cadence | customCadenceDays | isChecked | lastCheckedDate | updatedAt
   ```

### 2. Deploy the Apps Script
1. In the Sheet, open **Extensions → Apps Script**.
2. Delete the starter code and paste in the contents of [`AppsScript/Code.gs`](AppsScript/Code.gs) from this repo.
3. Change the `SECRET` constant at the top to a private value only your family will use (treat it like a password). **Only edit this in your own copy of the script pasted into Apps Script — never commit your real secret back into `AppsScript/Code.gs` in this repo**, since this repository is public; keep `SECRET` as the placeholder `CHANGE_ME_TO_A_PRIVATE_SECRET` in git.
4. Click **Deploy → New deployment**.
   - Type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone** (safe — requests without the correct secret are rejected)
5. Click **Deploy** and authorize the script when prompted.
6. Copy the **Web app URL** (ends in `/exec`).

### 3. Connect the app
On each family member's iPhone:
1. Open the app → **Settings** tab.
2. Paste the same **Web App URL** and the same **shared secret** you chose above.
3. Tap **Sync Now**, or just use the app normally — it syncs automatically when foregrounded, and via pull-to-refresh.

**Notes:**
- If you edit `Code.gs` later, create a **new deployment version** (Deploy → Manage deployments → Edit → New version) — editing the script alone doesn't update the live Web App URL.
- The app works fully offline; changes made without internet sync automatically the next time it's online.
- Conflict resolution is "most recently updated wins" — if two people edit the same item while both offline, the later edit (by timestamp) takes effect after both sync.

## Notes
- Re-running `xcodegen generate` regenerates `GroceryList.xcodeproj` from `project.yml`, which will reset any signing team selected manually in Xcode — just re-select your Team afterward.
- Data is stored locally on-device only (SwiftData/CoreData); there is no backend/sync in this version.
