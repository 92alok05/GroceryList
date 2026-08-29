import Foundation
import SwiftData

/// Periodically scans all grocery items and automatically unchecks any that are
/// due for refresh based on their repeat cadence.
enum CadenceRefreshService {
    @MainActor
    static func refreshDueItems(context: ModelContext) {
        let descriptor = FetchDescriptor<GroceryItem>(predicate: #Predicate { $0.isChecked == true })
        guard let items = try? context.fetch(descriptor) else { return }
        let now = Date()
        for item in items where item.isDueForRefresh(now: now) {
            item.isChecked = false
            item.lastCheckedDate = nil
        }
        try? context.save()
    }
}
