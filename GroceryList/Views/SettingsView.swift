import SwiftUI
import SwiftData

/// Lets the user configure the Google Sheet sync endpoint and trigger a manual sync.
struct SettingsView: View {
    @Environment(\.modelContext) private var modelContext
    @ObservedObject private var settings = SyncSettings.shared
    @ObservedObject private var tutorialState = TutorialState.shared
    @State private var isSyncing = false

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Web App URL", text: $settings.webAppURL)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .keyboardType(.URL)
                    SecureField("Shared secret", text: $settings.sharedSecret)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                } header: {
                    Text("Google Sheet Sync")
                } footer: {
                    Text("Paste the Web App URL and shared secret from your deployed Google Apps Script. Every family member should enter the same values on their phone. See README for setup steps.")
                }

                Section {
                    Button {
                        Task { await syncNow() }
                    } label: {
                        if isSyncing {
                            ProgressView()
                        } else {
                            Label("Sync Now", systemImage: "arrow.triangle.2.circlepath")
                        }
                    }
                    .disabled(!settings.isConfigured || isSyncing)

                    if let lastSyncedAt = settings.lastSyncedAt {
                        LabeledContent("Last synced", value: lastSyncedAt.formatted(date: .abbreviated, time: .shortened))
                    }
                    if let error = settings.lastSyncError {
                        Text(error)
                            .font(.footnote)
                            .foregroundStyle(.red)
                    }
                }

                Section {
                    Button {
                        tutorialState.replay()
                    } label: {
                        Label("Replay Tutorial", systemImage: "questionmark.circle")
                    }
                }
            }
            .navigationTitle("Settings")
        }
    }

    private func syncNow() async {
        isSyncing = true
        await SheetSyncService.syncAll(context: modelContext)
        isSyncing = false
    }
}

#Preview {
    SettingsView()
        .modelContainer(for: GroceryItem.self, inMemory: true)
}
