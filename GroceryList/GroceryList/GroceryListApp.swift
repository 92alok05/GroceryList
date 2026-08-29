import SwiftUI
import SwiftData
import CoreData

@main
struct GroceryListApp: App {
    var sharedModelContainer: ModelContainer = Self.makeModelContainer()

    /// Builds the SwiftData container. If the on-disk store can't be migrated
    /// (e.g. after a schema change during development), it falls back to
    /// wiping the incompatible store and creating a fresh one rather than crashing.
    private static func makeModelContainer() -> ModelContainer {
        let schema = Schema([GroceryItem.self])
        let config = ModelConfiguration(schema: schema, isStoredInMemoryOnly: false)
        do {
            return try ModelContainer(for: schema, configurations: [config])
        } catch {
            print("⚠️ Could not load persistent store, resetting it: \(error)")
            if let storeURL = config.url as URL?, FileManager.default.fileExists(atPath: storeURL.path) {
                let coordinator = NSPersistentStoreCoordinator(managedObjectModel: NSManagedObjectModel())
                try? coordinator.destroyPersistentStore(at: storeURL, ofType: NSSQLiteStoreType, options: nil)
                let walURL = storeURL.deletingLastPathComponent()
                    .appendingPathComponent(storeURL.lastPathComponent + "-wal")
                let shmURL = storeURL.deletingLastPathComponent()
                    .appendingPathComponent(storeURL.lastPathComponent + "-shm")
                try? FileManager.default.removeItem(at: storeURL)
                try? FileManager.default.removeItem(at: walURL)
                try? FileManager.default.removeItem(at: shmURL)
            }
            do {
                return try ModelContainer(for: schema, configurations: [config])
            } catch {
                fatalError("Could not create ModelContainer even after reset: \(error)")
            }
        }
    }

    @Environment(\.scenePhase) private var scenePhase

    init() {
        SeedData.seedIfNeeded(context: sharedModelContainer.mainContext)
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
        .modelContainer(sharedModelContainer)
        .onChange(of: scenePhase) { _, newPhase in
            if newPhase == .active {
                CadenceRefreshService.refreshDueItems(context: sharedModelContainer.mainContext)
            }
        }
    }
}
