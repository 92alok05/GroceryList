import Foundation
import SwiftData

/// Syncs the local SwiftData store with a Google Sheet acting as a lightweight
/// remote "server" via a Google Apps Script Web App (see /AppsScript/Code.gs).
///
/// Conflict resolution: whichever copy (local or remote) has the more recent
/// `updatedAt` wins. Deletions are detected by diffing: if an item was
/// previously synced (`isSyncedToRemote == true`) but is no longer present in
/// the latest full pull, it was deleted on another device and is removed locally.
enum SheetSyncService {
    struct RemoteItem: Codable {
        let id: String
        let name: String
        let recommendedStore: String
        let recommendedQuantity: String
        let cadence: String
        let customCadenceDays: Int
        let isChecked: Bool
        let lastCheckedDate: String?
        let updatedAt: String
    }

    private struct ListResponse: Codable {
        let items: [RemoteItem]
        let error: String?
    }

    private struct ActionResponse: Codable {
        let success: Bool?
        let error: String?
    }

    enum SyncError: LocalizedError {
        case notConfigured
        case invalidURL
        case server(String)
        case transport(Error)

        var errorDescription: String? {
            switch self {
            case .notConfigured: return "Sync isn't configured yet. Enter your Web App URL and secret in Settings."
            case .invalidURL: return "The Web App URL is not valid."
            case .server(let message): return "Server error: \(message)"
            case .transport(let error): return error.localizedDescription
            }
        }
    }

    private static let isoFormatter: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    // MARK: - Public entry point

    /// Performs a full two-way sync: pulls remote changes, merges them into the
    /// local store, then pushes any local changes that are newer or not yet synced.
    @MainActor
    static func syncAll(context: ModelContext) async {
        let settings = SyncSettings.shared
        guard settings.isConfigured else {
            settings.lastSyncError = SyncError.notConfigured.errorDescription
            return
        }
        do {
            let remoteItems = try await fetchAll()
            let remoteById = Dictionary(uniqueKeysWithValues: remoteItems.map { ($0.id, $0) })

            let localItems = try context.fetch(FetchDescriptor<GroceryItem>())
            var itemsToPush: [GroceryItem] = []

            for local in localItems {
                let localIdString = local.id.uuidString
                if let remote = remoteById[localIdString] {
                    let remoteUpdatedAt = isoFormatter.date(from: remote.updatedAt) ?? .distantPast
                    if remoteUpdatedAt > local.updatedAt {
                        apply(remote, to: local)
                    } else if local.updatedAt > remoteUpdatedAt {
                        itemsToPush.append(local)
                    }
                    local.isSyncedToRemote = true
                } else if local.isSyncedToRemote {
                    // Was synced before, now missing remotely -> deleted elsewhere.
                    context.delete(local)
                } else {
                    // Never synced yet -> needs to be pushed up.
                    itemsToPush.append(local)
                }
            }

            let localIds = Set(localItems.map { $0.id.uuidString })
            for remote in remoteItems where !localIds.contains(remote.id) {
                let newItem = makeLocalItem(from: remote)
                context.insert(newItem)
            }

            try? context.save()

            for item in itemsToPush {
                try await upsert(item)
                item.isSyncedToRemote = true
            }
            try? context.save()

            settings.lastSyncedAt = Date()
            settings.lastSyncError = nil
        } catch {
            settings.lastSyncError = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
    }

    /// Pushes a single item's current state to the remote sheet immediately
    /// (fire-and-forget from call sites; failures are recorded but don't block the UI).
    @MainActor
    static func pushItemInBackground(_ item: GroceryItem) {
        guard SyncSettings.shared.isConfigured else { return }
        let itemId = item.id
        Task {
            do {
                try await upsert(item)
                await MainActor.run { item.isSyncedToRemote = true }
            } catch {
                await MainActor.run {
                    SyncSettings.shared.lastSyncError = "Failed to sync item \(itemId): \(error.localizedDescription)"
                }
            }
        }
    }

    /// Pushes a deletion to the remote sheet immediately (fire-and-forget).
    static func pushDeletionInBackground(id: UUID) {
        guard SyncSettings.shared.isConfigured else { return }
        Task {
            do {
                try await delete(id: id.uuidString)
            } catch {
                await MainActor.run {
                    SyncSettings.shared.lastSyncError = "Failed to sync deletion: \(error.localizedDescription)"
                }
            }
        }
    }

    // MARK: - Merge helpers

    @MainActor
    private static func apply(_ remote: RemoteItem, to local: GroceryItem) {
        local.name = remote.name
        local.recommendedStore = remote.recommendedStore
        local.recommendedQuantity = remote.recommendedQuantity
        local.cadence = RepeatCadence(rawValue: remote.cadence) ?? .oneTime
        local.customCadenceDays = remote.customCadenceDays
        local.isChecked = remote.isChecked
        local.lastCheckedDate = remote.lastCheckedDate.flatMap { isoFormatter.date(from: $0) }
        local.updatedAt = isoFormatter.date(from: remote.updatedAt) ?? Date()
    }

    private static func makeLocalItem(from remote: RemoteItem) -> GroceryItem {
        GroceryItem(
            id: UUID(uuidString: remote.id) ?? UUID(),
            name: remote.name,
            recommendedStore: remote.recommendedStore,
            recommendedQuantity: remote.recommendedQuantity,
            cadence: RepeatCadence(rawValue: remote.cadence) ?? .oneTime,
            customCadenceDays: remote.customCadenceDays,
            isChecked: remote.isChecked,
            lastCheckedDate: remote.lastCheckedDate.flatMap { isoFormatter.date(from: $0) },
            updatedAt: isoFormatter.date(from: remote.updatedAt) ?? Date(),
            isSyncedToRemote: true
        )
    }

    // MARK: - Networking

    private static func baseURLComponents() throws -> URLComponents {
        let settings = SyncSettings.shared
        guard settings.isConfigured else { throw SyncError.notConfigured }
        guard var components = URLComponents(string: settings.webAppURL) else { throw SyncError.invalidURL }
        components.queryItems = (components.queryItems ?? [])
        return components
    }

    private static func fetchAll() async throws -> [RemoteItem] {
        var components = try baseURLComponents()
        components.queryItems = (components.queryItems ?? []) + [
            URLQueryItem(name: "action", value: "list"),
            URLQueryItem(name: "token", value: SyncSettings.shared.sharedSecret),
        ]
        guard let url = components.url else { throw SyncError.invalidURL }

        do {
            let (data, _) = try await URLSession.shared.data(from: url)
            let decoded = try JSONDecoder().decode(ListResponse.self, from: data)
            if let error = decoded.error {
                throw SyncError.server(error)
            }
            return decoded.items
        } catch let error as SyncError {
            throw error
        } catch {
            throw SyncError.transport(error)
        }
    }

    @MainActor
    private static func upsert(_ item: GroceryItem) async throws {
        let remote = RemoteItem(
            id: item.id.uuidString,
            name: item.name,
            recommendedStore: item.recommendedStore,
            recommendedQuantity: item.recommendedQuantity,
            cadence: item.cadence.rawValue,
            customCadenceDays: item.customCadenceDays,
            isChecked: item.isChecked,
            lastCheckedDate: item.lastCheckedDate.map { isoFormatter.string(from: $0) },
            updatedAt: isoFormatter.string(from: item.updatedAt)
        )
        try await postAction(["action": "upsert", "token": SyncSettings.shared.sharedSecret, "item": remote])
    }

    private static func delete(id: String) async throws {
        try await postAction(["action": "delete", "token": SyncSettings.shared.sharedSecret, "id": id])
    }

    private static func postAction(_ payload: [String: Any]) async throws {
        guard SyncSettings.shared.isConfigured else { throw SyncError.notConfigured }
        guard let url = URL(string: SyncSettings.shared.webAppURL) else { throw SyncError.invalidURL }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        // RemoteItem needs its own encoding path since it's Codable, not a plain dictionary value.
        if let item = payload["item"] as? RemoteItem {
            var jsonDict: [String: Any] = [
                "action": payload["action"] as Any,
                "token": payload["token"] as Any,
            ]
            let itemData = try JSONEncoder().encode(item)
            let itemDict = try JSONSerialization.jsonObject(with: itemData) as? [String: Any]
            jsonDict["item"] = itemDict
            request.httpBody = try JSONSerialization.data(withJSONObject: jsonDict)
        } else {
            request.httpBody = try JSONSerialization.data(withJSONObject: payload)
        }

        do {
            let (data, _) = try await URLSession.shared.data(for: request)
            let decoded = try JSONDecoder().decode(ActionResponse.self, from: data)
            if let error = decoded.error {
                throw SyncError.server(error)
            }
        } catch let error as SyncError {
            throw error
        } catch {
            throw SyncError.transport(error)
        }
    }
}
