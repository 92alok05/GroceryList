import SwiftUI
import SwiftData

struct ItemListView: View {
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \GroceryItem.name) private var items: [GroceryItem]

    @State private var showingAddItem = false
    @State private var itemToEdit: GroceryItem?
    @State private var searchText = ""

    private var filteredItems: [GroceryItem] {
        guard !searchText.trimmingCharacters(in: .whitespaces).isEmpty else { return items }
        return items.filter { item in
            item.name.localizedCaseInsensitiveContains(searchText) ||
            item.recommendedStore.localizedCaseInsensitiveContains(searchText)
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
                            Image(systemName: item.isChecked ? "checkmark.circle.fill" : "circle")
                                .foregroundStyle(item.isChecked ? .green : .secondary)
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
                }
                .onDelete(perform: deleteItems)
            }
            .navigationTitle("Grocery List")
            .searchable(text: $searchText, prompt: "Search items or stores")
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

    private func deleteItems(at offsets: IndexSet) {
        for index in offsets {
            modelContext.delete(filteredItems[index])
        }
    }

    private func toggle(_ item: GroceryItem) {
        item.isChecked.toggle()
        item.lastCheckedDate = item.isChecked ? Date() : nil
        try? modelContext.save()
    }
}

#Preview {
    ItemListView()
        .modelContainer(for: GroceryItem.self, inMemory: true)
}
