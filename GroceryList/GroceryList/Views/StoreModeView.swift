import SwiftUI
import SwiftData

/// Lets the user pick a store, then shows the checklist of items recommended for that store.
struct StoreModeView: View {
    @Query(sort: \GroceryItem.recommendedStore) private var items: [GroceryItem]

    private var stores: [String] {
        Array(Set(items.map { $0.recommendedStore })).sorted()
    }

    var body: some View {
        NavigationStack {
            List {
                if stores.isEmpty {
                    ContentUnavailableView(
                        "No Stores Yet",
                        systemImage: "storefront",
                        description: Text("Add grocery items with a recommended store first.")
                    )
                } else {
                    ForEach(stores, id: \.self) { store in
                        NavigationLink(store) {
                            StoreChecklistView(store: store)
                        }
                    }
                }
            }
            .navigationTitle("Store Mode")
        }
    }
}

#Preview {
    StoreModeView()
        .modelContainer(for: GroceryItem.self, inMemory: true)
}
