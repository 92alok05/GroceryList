import SwiftUI
import SwiftData

struct ItemListView: View {
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \GroceryItem.name) private var items: [GroceryItem]

    @State private var showingAddItem = false
    @State private var itemToEdit: GroceryItem?
    @State private var searchText = ""

    private var filteredItems: [GroceryItem] {
        let base: [GroceryItem]
        if searchText.trimmingCharacters(in: .whitespaces).isEmpty {
            base = items
        } else {
            base = items.filter { item in
                item.name.localizedCaseInsensitiveContains(searchText) ||
                item.recommendedStore.localizedCaseInsensitiveContains(searchText)
            }
        }
        // Group by status (Needed, then Due Soon, then Bought), alphabetical within each group.
        return base.sorted { lhs, rhs in
            let lhsRank = statusSortRank(lhs.status)
            let rhsRank = statusSortRank(rhs.status)
            if lhsRank != rhsRank { return lhsRank < rhsRank }
            return lhs.name.localizedCaseInsensitiveCompare(rhs.name) == .orderedAscending
        }
    }

    private func statusSortRank(_ status: ItemStatus) -> Int {
        switch status {
        case .needed: return 0
        case .dueSoon: return 1
        case .bought: return 2
        }
    }

    var body: some View {
        NavigationStack {
            List {
                ForEach(filteredItems) { item in
                    HStack {
                        Button {
                            toggle(item)
                        } label: {
                            statusIcon(for: item.status)
                                .imageScale(.large)
                        }
                        .buttonStyle(.plain)

                        Button {
                            itemToEdit = item
                        } label: {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(item.name)
                                    .font(.headline)
                                    .strikethrough(item.isChecked)
                                    .foregroundStyle(.primary)
                                Text("\(item.recommendedStore) • Qty: \(item.recommendedQuantity) • \(cadenceDescription(item))")
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                            }
                        }
                        .buttonStyle(.plain)
                    }
                    .swipeActions(edge: .leading, allowsFullSwipe: false) {
                        if item.status == .dueSoon {
                            Button {
                                snooze(item)
                            } label: {
                                Label("Extend", systemImage: "clock.arrow.circlepath")
                            }
                            .tint(.orange)
                        }
                    }
                }
                .onDelete(perform: deleteItems)
            }
            .navigationTitle("Grocery List")
            .searchable(text: $searchText, prompt: "Search items or stores")
            .refreshable {
                await SheetSyncService.syncAll(context: modelContext)
            }
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        showingAddItem = true
                    } label: {
                        Label("Add Item", systemImage: "plus")
                    }
                }
            }
            .overlay {
                if items.isEmpty {
                    ContentUnavailableView(
                        "No Items Yet",
                        systemImage: "cart.badge.plus",
                        description: Text("Tap + to add your first grocery item.")
                    )
                } else if filteredItems.isEmpty {
                    ContentUnavailableView.search(text: searchText)
                }
            }
            .sheet(isPresented: $showingAddItem) {
                AddEditItemView(item: nil)
            }
            .sheet(item: $itemToEdit) { item in
                AddEditItemView(item: item)
            }
        }
    }

    private func cadenceDescription(_ item: GroceryItem) -> String {
        switch item.cadence {
        case .custom:
            return "Every \(item.customCadenceDays) day(s)"
        default:
            return item.cadence.rawValue
        }
    }

    @ViewBuilder
    private func statusIcon(for status: ItemStatus) -> some View {
        switch status {
        case .needed:
            Image(systemName: "circle").foregroundStyle(.secondary)
        case .dueSoon:
            Image(systemName: "clock.badge.exclamationmark.fill").foregroundStyle(.orange)
        case .bought:
            Image(systemName: "checkmark.circle.fill").foregroundStyle(.green)
        }
    }

    private func deleteItems(at offsets: IndexSet) {
        for index in offsets {
            let item = filteredItems[index]
            SheetSyncService.pushDeletionInBackground(id: item.id)
            modelContext.delete(item)
        }
    }

    private func toggle(_ item: GroceryItem) {
        switch item.status {
        case .needed, .dueSoon:
            item.isChecked = true
            item.lastCheckedDate = Date()
        case .bought:
            item.isChecked = false
            item.lastCheckedDate = nil
        }
        item.updatedAt = Date()
        try? modelContext.save()
        SheetSyncService.pushItemInBackground(item)
    }

    private func snooze(_ item: GroceryItem) {
        item.snooze()
        try? modelContext.save()
        SheetSyncService.pushItemInBackground(item)
    }
}

#Preview {
    ItemListView()
        .modelContainer(for: GroceryItem.self, inMemory: true)
}
