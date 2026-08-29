# Grocery List

A native SwiftUI + SwiftData iOS app for managing a recurring household grocery list, organized by store.

**Version:** v1.0 ("Local App" — first releasable version)

## Features

### Core item management
- Add/edit/delete grocery items, each with: name, recommended store, recommended quantity, and repeat cadence
- Repeat cadence options: One Time (default), Daily, Weekly, Every 2 Weeks, Monthly, or Custom (user-specified number of days)

### Store handling
- Recommended store is a dropdown, prepopulated with **Safeway, Target, Trader Joe's, Indian Store**
- Any new store name typed in becomes available in the dropdown for future items automatically

### All Items view (global list)
- Shows every item with a checkbox indicating bought/not-bought
- Checking/unchecking here is reflected everywhere (shared state)
- Built-in search bar — filter by item name or store name, with check/uncheck available directly on search results

### Store Mode (per-store checklist)
- Pick a store, see only that store's items as a checklist for in-aisle shopping
- Tap to check off items while shopping

### Automatic cadence refresh
- Checked items automatically become unchecked again once their cadence period elapses (e.g., a weekly item reappears as "needed" 7 days after being checked)
- One Time items never auto-reset
- Refresh runs on app foreground and whenever a store checklist is opened

### Pre-installed default items
Seeded once on first launch (won't reappear if deleted):

**Safeway** (weekly): Chicken ×2, Eggs ×18, Greek yogurt, Fruits, Milk

**Indian Store** (weekly): Methi ×4, Cucumber ×4, Beet ×3, Carrot ×6, Tomato ×7, Paneer, Palak ×4, Beans, Green peas, Sweet potato ×4, Normal potato ×5, Coconut, Walnuts, Almonds, Raisins, Coriander ×3, Cabbage, Moringa ×2, Brinjal ×2

**Indian Store — One Time**: Moong dal, Jowar, Atta, Eno, Besan, Peanuts, Ragda chana, Matki, Moong, Chole, Rice

### Persistence & resilience
- Local on-device storage via SwiftData; survives app restarts
- Self-healing store: if a schema/migration mismatch is ever detected, the app resets the local store instead of crashing

## App identity
- Display name: **Grocery List**
- Bundle ID: `com.aljoshi.grocerylist.GroceryList`
- Minimum deployment target: iOS 17.0

## Project structure

```
GroceryList/
├── project.yml                       # XcodeGen project spec (source of truth)
└── GroceryList/
    ├── GroceryListApp.swift          # App entry point, ModelContainer setup
    ├── Info.plist
    ├── Models/
    │   └── GroceryItem.swift         # SwiftData model + RepeatCadence enum
    ├── ViewModels/
    │   ├── CadenceRefreshService.swift  # Auto-uncheck logic based on cadence
    │   └── SeedData.swift               # One-time pre-installed item seeding
    └── Views/
        ├── ContentView.swift          # Root TabView
        ├── ItemListView.swift         # All Items tab (search, checkboxes)
        ├── AddEditItemView.swift      # Add/edit item form
        ├── StoreModeView.swift        # Store picker tab
        └── StoreChecklistView.swift   # Per-store checklist
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

## Notes
- Re-running `xcodegen generate` regenerates `GroceryList.xcodeproj` from `project.yml`, which will reset any signing team selected manually in Xcode — just re-select your Team afterward.
- Data is stored locally on-device only (SwiftData/CoreData); there is no backend/sync in this version.
