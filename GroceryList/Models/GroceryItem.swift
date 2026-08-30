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

    /// The date this item will next need to be repurchased, based on when it was
    /// last checked off and its repeat cadence. `nil` for One Time items or items
    /// that haven't been checked yet.
    func nextDueDate(now: Date = Date()) -> Date? {
        guard let lastChecked = lastCheckedDate else { return nil }
        guard let days = cadence.days(customDays: customCadenceDays) else { return nil }
        return Calendar.current.date(byAdding: .day, value: days, to: lastChecked)
    }

    /// Current at-a-glance status of this item, used to decide which icon to show
    /// and how it should behave when tapped.
    var status: ItemStatus {
        guard isChecked else { return .needed }
        guard let days = cadence.days(customDays: customCadenceDays), let nextDue = nextDueDate() else {
            // One Time items (or items with no cadence) stay simply "bought".
            return .bought
        }
        let now = Date()
        if now >= nextDue { return .needed }
        // "Due Soon" window = the last 25% of the cadence length before it's due.
        let bufferDays = max(Double(days) * 0.25, 0.25)
        if let dueSoonStart = Calendar.current.date(byAdding: .hour, value: -Int(bufferDays * 24), to: nextDue),
           now >= dueSoonStart {
            return .dueSoon
        }
        return .bought
    }

    /// Pushes the item's next-due date forward by one more full cadence length,
    /// without marking it "freshly bought" today. Used when the user needs more
    /// time before an item that's "Due Soon" actually needs to be repurchased.
    /// Moving `lastCheckedDate` forward by the cadence length has the effect of
    /// moving `nextDueDate` forward by the same amount, since nextDueDate is
    /// always computed as lastCheckedDate + cadence days.
    func snooze() {
        guard let days = cadence.days(customDays: customCadenceDays),
              let currentLastChecked = lastCheckedDate else { return }
        lastCheckedDate = Calendar.current.date(byAdding: .day, value: days, to: currentLastChecked)
        updatedAt = Date()
    }
}

/// At-a-glance status for a grocery item, driving both its icon and tap behavior.
enum ItemStatus {
    /// Not bought, or cadence has fully elapsed — needs to be purchased.
    case needed
    /// Bought, but within the "due soon" window before it needs to be bought again.
    case dueSoon
    /// Bought and comfortably not due again yet.
    case bought
}
