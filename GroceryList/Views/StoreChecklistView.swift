import SwiftUI
import SwiftData

/// The checklist for a single store: user taps items to check them off while shopping.
/// Checked items automatically become unchecked again once their repeat cadence elapses.
struct StoreChecklistView: View {
    @Environment(\.modelContext) private var modelContext
    let store: String

    @Query private var allItems: [GroceryItem]

    init(store: String) {
        self.store = store
        let predicate = #Predicate<GroceryItem> { $0.recommendedStore == store }
        _allItems = Query(filter: predicate, sort: \GroceryItem.name)
    }

    var body: some View {
        List {
            ForEach(allItems) { item in
                Button {
                    toggle(item)
                } label: {
                    HStack {
                        Image(systemName: item.isChecked ? "checkmark.circle.fill" : "circle")
                            .foregroundStyle(item.isChecked ? .green : .secondary)
                        VStack(alignment: .leading) {
                            Text(item.name)
                                .strikethrough(item.isChecked)
                            Text("Qty: \(item.recommendedQuantity)")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            if item.isChecked, let lastChecked = item.lastCheckedDate {
                                Text("Checked \(lastChecked.formatted(date: .abbreviated, time: .shortened))")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                }
                .buttonStyle(.plain)
            }
        }
        .navigationTitle(store)
        .onAppear {
            CadenceRefreshService.refreshDueItems(context: modelContext)
        }
    }

    private func toggle(_ item: GroceryItem) {
        item.isChecked.toggle()
        item.lastCheckedDate = item.isChecked ? Date() : nil
        try? modelContext.save()
    }
}

#Preview {
    StoreChecklistView(store: "Costco")
        .modelContainer(for: GroceryItem.self, inMemory: true)
}
