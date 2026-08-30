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
                        statusIcon(for: item.status)
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
        }
        .navigationTitle(store)
        .onAppear {
            CadenceRefreshService.refreshDueItems(context: modelContext)
        }
        .refreshable {
            await SheetSyncService.syncAll(context: modelContext)
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
    StoreChecklistView(store: "Costco")
        .modelContainer(for: GroceryItem.self, inMemory: true)
}
