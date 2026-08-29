import Foundation

/// User-configurable settings for syncing with the Google Sheet "server".
/// Stored in UserDefaults so they persist across launches and can be entered
/// once per device via SettingsView.
final class SyncSettings: ObservableObject {
    static let shared = SyncSettings()

    @Published var webAppURL: String {
        didSet { UserDefaults.standard.set(webAppURL, forKey: "syncWebAppURL") }
    }
    @Published var sharedSecret: String {
        didSet { UserDefaults.standard.set(sharedSecret, forKey: "syncSharedSecret") }
    }
    @Published var lastSyncedAt: Date? {
        didSet { UserDefaults.standard.set(lastSyncedAt, forKey: "syncLastSyncedAt") }
    }
    @Published var lastSyncError: String?

    private init() {
        self.webAppURL = UserDefaults.standard.string(forKey: "syncWebAppURL") ?? ""
        self.sharedSecret = UserDefaults.standard.string(forKey: "syncSharedSecret") ?? ""
        self.lastSyncedAt = UserDefaults.standard.object(forKey: "syncLastSyncedAt") as? Date
    }

    /// Whether the user has entered enough info to attempt syncing.
    var isConfigured: Bool {
        !webAppURL.trimmingCharacters(in: .whitespaces).isEmpty &&
        !sharedSecret.trimmingCharacters(in: .whitespaces).isEmpty
    }
}
