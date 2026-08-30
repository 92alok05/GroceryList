import SwiftUI

/// Tracks whether the one-time onboarding tutorial has been shown, and lets any
/// screen (e.g. Settings) re-trigger it on demand ("Replay Tutorial").
final class TutorialState: ObservableObject {
    static let shared = TutorialState()
    private static let hasSeenTutorialKey = "hasSeenOnboardingTutorial"

    @Published var isShowingTutorial: Bool

    private init() {
        isShowingTutorial = !UserDefaults.standard.bool(forKey: Self.hasSeenTutorialKey)
    }

    func markSeen() {
        UserDefaults.standard.set(true, forKey: Self.hasSeenTutorialKey)
        isShowingTutorial = false
    }

    func replay() {
        isShowingTutorial = true
    }
}

struct ContentView: View {
    @ObservedObject private var tutorialState = TutorialState.shared

    var body: some View {
        TabView {
            ItemListView()
                .tabItem {
                    Label("All Items", systemImage: "list.bullet")
                }
            StoreModeView()
                .tabItem {
                    Label("Store Mode", systemImage: "cart")
                }
            SettingsView()
                .tabItem {
                    Label("Settings", systemImage: "gearshape")
                }
        }
        .fullScreenCover(isPresented: $tutorialState.isShowingTutorial) {
            TutorialView {
                tutorialState.markSeen()
            }
        }
    }
}

#Preview {
    ContentView()
}
