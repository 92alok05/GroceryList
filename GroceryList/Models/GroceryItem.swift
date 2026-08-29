import Foundation
import SwiftData

/// How often a grocery item should reappear on the checklist after being checked off.
enum RepeatCadence: String, Codable, CaseIterable, Identifiable {
    case oneTime = "One Time"
    case daily = "Daily"
    case weekly = "Weekly"
    case biweekly = "Every 2 Weeks"
    case monthly = "Monthly"
    case custom = "Custom"

    var id: String { rawValue }

    /// Number of days until the item should automatically be unchecked again.
    /// `oneTime` has no automatic refresh (nil).
    func days(customDays: Int) -> Int? {
        switch self {
        case .oneTime: return nil
        case .daily: return 1
        case .weekly: return 7
        case .biweekly: return 14
        case .monthly: return 30
        case .custom: return max(customDays, 1)
        }
    }
}

@Model
final class GroceryItem {
    var id: UUID
    var name: String
    /// Store recommended by the user to buy this item from.
    var recommendedStore: String
    /// Recommended quantity to buy (e.g. "2", "1 gallon", "12 pack").
    var recommendedQuantity: String
    var cadenceRaw: String
    /// Only used when cadenceRaw == .custom, number of days between repeats.
    var customCadenceDays: Int
    var isChecked: Bool
    /// The last time the item was checked off (used to compute when to auto-uncheck).
    var lastCheckedDate: Date?
    /// When this item was last modified locally. Used to resolve sync conflicts
    /// (the most recently updated copy — local or remote — wins).
    var updatedAt: Date
    /// Whether this item has been successfully pushed to / pulled from the remote
    /// Google Sheet at least once. Used during sync to distinguish "not yet synced"
    /// items from items that were deleted on another device.
    var isSyncedToRemote: Bool

    init(
        id: UUID = UUID(),
        name: String,
        recommendedStore: String,
        recommendedQuantity: String = "1",
        cadence: RepeatCadence = .oneTime,
        customCadenceDays: Int = 7,
        isChecked: Bool = false,
        lastCheckedDate: Date? = nil,
        updatedAt: Date = Date(),
        isSyncedToRemote: Bool = false
    ) {
        self.id = id
        self.name = name
        self.recommendedStore = recommendedStore
        self.recommendedQuantity = recommendedQuantity
        self.cadenceRaw = cadence.rawValue
        self.customCadenceDays = customCadenceDays
        self.isChecked = isChecked
        self.lastCheckedDate = lastCheckedDate
        self.updatedAt = updatedAt
        self.isSyncedToRemote = isSyncedToRemote
    }

    var cadence: RepeatCadence {
        get { RepeatCadence(rawValue: cadenceRaw) ?? .oneTime }
        set { cadenceRaw = newValue.rawValue }
    }

    /// Whether this item is due to be automatically unchecked based on its cadence.
    func isDueForRefresh(now: Date = Date()) -> Bool {
        guard isChecked, let lastChecked = lastCheckedDate else { return false }
        guard let days = cadence.days(customDays: customCadenceDays) else { return false }
        guard let nextDue = Calendar.current.date(byAdding: .day, value: days, to: lastChecked) else {
            return false
        }
        return now >= nextDue
    }
}
