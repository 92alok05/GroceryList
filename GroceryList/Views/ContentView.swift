import SwiftUI

struct ContentView: View {
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
    }
}

#Preview {
    ContentView()
}
