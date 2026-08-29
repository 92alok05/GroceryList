import Foundation
import SwiftData

/// Provides the pre-installed grocery items shipped with the app so users don't have
/// to manually create common items on first launch.
enum SeedData {
    private static let hasSeededKey = "hasSeededDefaultGroceryItems"

    private struct SeedItem {
        let name: String
        let store: String
        let quantity: String
        let cadence: RepeatCadence
    }

    /// Safeway items — recurring weekly since these are regular grocery runs.
    private static let safewayItems: [SeedItem] = [
        SeedItem(name: "Chicken", store: "Safeway", quantity: "2", cadence: .weekly),
        SeedItem(name: "Eggs", store: "Safeway", quantity: "18", cadence: .weekly),
        SeedItem(name: "Greek yogurt", store: "Safeway", quantity: "1", cadence: .weekly),
        SeedItem(name: "Fruits", store: "Safeway", quantity: "1", cadence: .weekly),
        SeedItem(name: "Milk", store: "Safeway", quantity: "1", cadence: .weekly),
    ]

    /// Regular Indian Store items — recurring weekly.
    private static let indianStoreItems: [SeedItem] = [
        SeedItem(name: "Methi", store: "Indian Store", quantity: "4", cadence: .weekly),
        SeedItem(name: "Cucumber", store: "Indian Store", quantity: "4", cadence: .weekly),
        SeedItem(name: "Beet", store: "Indian Store", quantity: "3", cadence: .weekly),
        SeedItem(name: "Carrot", store: "Indian Store", quantity: "6", cadence: .weekly),
        SeedItem(name: "Tomato", store: "Indian Store", quantity: "7", cadence: .weekly),
        SeedItem(name: "Paneer", store: "Indian Store", quantity: "1", cadence: .weekly),
        SeedItem(name: "Palak", store: "Indian Store", quantity: "4", cadence: .weekly),
        SeedItem(name: "Beans", store: "Indian Store", quantity: "1", cadence: .weekly),
        SeedItem(name: "Green peas", store: "Indian Store", quantity: "1", cadence: .weekly),
        SeedItem(name: "Sweet potato", store: "Indian Store", quantity: "4", cadence: .weekly),
        SeedItem(name: "Normal potato", store: "Indian Store", quantity: "5", cadence: .weekly),
        SeedItem(name: "Coconut", store: "Indian Store", quantity: "1", cadence: .weekly),
        SeedItem(name: "Walnuts", store: "Indian Store", quantity: "1", cadence: .weekly),
        SeedItem(name: "Almonds", store: "Indian Store", quantity: "1", cadence: .weekly),
        SeedItem(name: "Raisins", store: "Indian Store", quantity: "1", cadence: .weekly),
        SeedItem(name: "Coriander", store: "Indian Store", quantity: "3", cadence: .weekly),
        SeedItem(name: "Cabbage", store: "Indian Store", quantity: "1", cadence: .weekly),
        SeedItem(name: "Moringa", store: "Indian Store", quantity: "2", cadence: .weekly),
        SeedItem(name: "Brinjal", store: "Indian Store", quantity: "2", cadence: .weekly),
    ]

    /// One-time Indian Store items — bought once, no automatic recurrence.
    private static let indianStoreOneTimeItems: [SeedItem] = [
        SeedItem(name: "Moong dal", store: "Indian Store", quantity: "1", cadence: .oneTime),
        SeedItem(name: "Jowar", store: "Indian Store", quantity: "1", cadence: .oneTime),
        SeedItem(name: "Atta", store: "Indian Store", quantity: "1", cadence: .oneTime),
        SeedItem(name: "Eno", store: "Indian Store", quantity: "1", cadence: .oneTime),
        SeedItem(name: "Besan", store: "Indian Store", quantity: "1", cadence: .oneTime),
        SeedItem(name: "Peanuts", store: "Indian Store", quantity: "1", cadence: .oneTime),
        SeedItem(name: "Ragda chana", store: "Indian Store", quantity: "1", cadence: .oneTime),
        SeedItem(name: "Matki", store: "Indian Store", quantity: "1", cadence: .oneTime),
        SeedItem(name: "Moong", store: "Indian Store", quantity: "1", cadence: .oneTime),
        SeedItem(name: "Chole", store: "Indian Store", quantity: "1", cadence: .oneTime),
        SeedItem(name: "Rice", store: "Indian Store", quantity: "1", cadence: .oneTime),
    ]

    /// Inserts the pre-installed items exactly once. Safe to call on every launch;
    /// it no-ops after the first successful seed (tracked via UserDefaults), so
    /// items the user deletes won't keep coming back.
    @MainActor
    static func seedIfNeeded(context: ModelContext, defaults: UserDefaults = .standard) {
        guard !defaults.bool(forKey: hasSeededKey) else { return }

        let allSeedItems = safewayItems + indianStoreItems + indianStoreOneTimeItems
        for seed in allSeedItems {
            let item = GroceryItem(
                name: seed.name,
                recommendedStore: seed.store,
                recommendedQuantity: seed.quantity,
                cadence: seed.cadence
            )
            context.insert(item)
        }
        try? context.save()

        defaults.set(true, forKey: hasSeededKey)
    }
}
