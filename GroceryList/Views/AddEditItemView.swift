import SwiftUI
import SwiftData

/// Add or edit a grocery item: name, recommended store, and repeat cadence.
struct AddEditItemView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss

    /// Stores every list should start with, even before the user has added any items.
    private static let defaultStores = ["Safeway", "Target", "Trader Joe's", "Indian Store"]
    private static let newStoreTag = "__new_store__"

    @Query(sort: \GroceryItem.recommendedStore) private var allItems: [GroceryItem]

    var item: GroceryItem?

    @State private var name: String = ""
    @State private var recommendedStore: String = ""
    @State private var newStoreName: String = ""
    @State private var recommendedQuantity: String = "1"
    @State private var cadence: RepeatCadence = .oneTime
    @State private var customCadenceDays: Int = 7

    private var isEditing: Bool { item != nil }

    /// All known stores: the prepopulated defaults plus any store names already used on items.
    private var availableStores: [String] {
        let usedStores = Set(allItems.map(\.recommendedStore))
        let combined = Set(Self.defaultStores).union(usedStores)
        return combined.sorted()
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Item") {
                    TextField("Item name", text: $name)
                    Picker("Recommended store", selection: $recommendedStore) {
                        ForEach(availableStores, id: \.self) { store in
                            Text(store).tag(store)
                        }
                        Text("Add New Store…").tag(Self.newStoreTag)
                    }
                    if recommendedStore == Self.newStoreTag {
                        TextField("New store name", text: $newStoreName)
                    }
                    TextField("Recommended quantity", text: $recommendedQuantity)
                }
                Section("Repeat Cadence") {
                    Picker("Cadence", selection: $cadence) {
                        ForEach(RepeatCadence.allCases) { option in
                            Text(option.rawValue).tag(option)
                        }
                    }
                    if cadence == .custom {
                        Stepper("Every \(customCadenceDays) day(s)", value: $customCadenceDays, in: 1...365)
                    }
                }
            }
            .navigationTitle(isEditing ? "Edit Item" : "Add Item")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { save() }
                        .disabled(!isValid)
                }
            }
            .onAppear(perform: populateFieldsIfEditing)
        }
    }

    private var isValid: Bool {
        guard !name.trimmingCharacters(in: .whitespaces).isEmpty else { return false }
        if recommendedStore == Self.newStoreTag {
            return !newStoreName.trimmingCharacters(in: .whitespaces).isEmpty
        }
        return !recommendedStore.trimmingCharacters(in: .whitespaces).isEmpty
    }

    /// Resolves the store the user picked, falling back to the typed-in new store name.
    private var resolvedStore: String {
        if recommendedStore == Self.newStoreTag {
            return newStoreName.trimmingCharacters(in: .whitespaces)
        }
        return recommendedStore
    }

    private func populateFieldsIfEditing() {
        guard let item else {
            recommendedStore = Self.defaultStores.first ?? Self.newStoreTag
            return
        }
        name = item.name
        recommendedQuantity = item.recommendedQuantity
        cadence = item.cadence
        customCadenceDays = item.customCadenceDays
        if availableStores.contains(item.recommendedStore) {
            recommendedStore = item.recommendedStore
        } else {
            recommendedStore = Self.newStoreTag
            newStoreName = item.recommendedStore
        }
    }

    private func save() {
        let quantity = recommendedQuantity.trimmingCharacters(in: .whitespaces)
        let store = resolvedStore
        let savedItem: GroceryItem
        if let item {
            item.name = name
            item.recommendedStore = store
            item.recommendedQuantity = quantity.isEmpty ? "1" : quantity
            item.cadence = cadence
            item.customCadenceDays = customCadenceDays
            item.updatedAt = Date()
            savedItem = item
        } else {
            let newItem = GroceryItem(
                name: name,
                recommendedStore: store,
                recommendedQuantity: quantity.isEmpty ? "1" : quantity,
                cadence: cadence,
                customCadenceDays: customCadenceDays
            )
            modelContext.insert(newItem)
            savedItem = newItem
        }
        try? modelContext.save()
        SheetSyncService.pushItemInBackground(savedItem)
        dismiss()
    }
}

#Preview {
    AddEditItemView(item: nil)
        .modelContainer(for: GroceryItem.self, inMemory: true)
}
