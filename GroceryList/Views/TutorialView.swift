import SwiftUI

/// One-time, skippable onboarding tutorial explaining the app's core features.
/// Shown the first time the app is launched; never shown again afterward
/// (tracked via `SyncSettings`-style UserDefaults flag, see `hasSeenTutorialKey`).
struct TutorialView: View {
    let onFinish: () -> Void

    @State private var currentPage = 0

    private let pages: [TutorialPage] = [
        TutorialPage(
            systemImage: "cart.fill",
            iconColor: .green,
            title: "Welcome to Grocery List",
            description: "Keep track of everything your household needs to buy, organized by store, with automatic reminders for recurring items."
        ),
        TutorialPage(
            systemImage: "plus.circle.fill",
            iconColor: .blue,
            title: "Add Items Your Way",
            description: "For every item, set the store you recommend buying it from, how much to get, and how often it needs to be repurchased — from One Time to Daily, Weekly, Monthly, or a Custom cadence."
        ),
        TutorialPage(
            systemImage: "clock.badge.exclamationmark.fill",
            iconColor: .orange,
            title: "Needed, Due Soon, Bought",
            description: "Every item shows one of three statuses: an empty circle (Needed), an orange hourglass (Due Soon — almost time to restock), or a green checkmark (Bought). Tap the icon to check an item off. Swipe left on a Due Soon item to Extend it if you need more time."
        ),
        TutorialPage(
            systemImage: "storefront.fill",
            iconColor: .purple,
            title: "Shop by Store",
            description: "Switch to Store Mode to see a focused checklist for just one store at a time — perfect for checking things off as you walk the aisles."
        ),
        TutorialPage(
            systemImage: "magnifyingglass",
            iconColor: .indigo,
            title: "Search & Stay Organized",
            description: "Use the search bar to quickly find any item or store. Your list is automatically sorted with what you still need at the top, Due Soon items next, and Bought items at the bottom."
        ),
        TutorialPage(
            systemImage: "person.2.fill",
            iconColor: .pink,
            title: "Share With Family",
            description: "Connect a Google Sheet from the Settings tab so everyone in your family can see and update the same grocery list from their own iPhone."
        ),
        TutorialPage(
            systemImage: "checkmark.seal.fill",
            iconColor: .green,
            title: "You're All Set!",
            description: "That's everything you need to know. Tap Get Started to start building your grocery list."
        ),
    ]

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Spacer()
                if currentPage < pages.count - 1 {
                    Button("Skip") {
                        onFinish()
                    }
                    .padding()
                }
            }
            .frame(height: 44)

            TabView(selection: $currentPage) {
                ForEach(Array(pages.enumerated()), id: \.offset) { index, page in
                    TutorialPageView(page: page)
                        .tag(index)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .always))
            .indexViewStyle(.page(backgroundDisplayMode: .always))

            Button {
                if currentPage < pages.count - 1 {
                    withAnimation {
                        currentPage += 1
                    }
                } else {
                    onFinish()
                }
            } label: {
                Text(currentPage < pages.count - 1 ? "Next" : "Get Started")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(Color.accentColor)
                    .foregroundStyle(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 14))
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 24)
        }
    }
}

private struct TutorialPage {
    let systemImage: String
    let iconColor: Color
    let title: String
    let description: String
}

private struct TutorialPageView: View {
    let page: TutorialPage

    var body: some View {
        VStack(spacing: 24) {
            Spacer()
            Image(systemName: page.systemImage)
                .resizable()
                .scaledToFit()
                .frame(width: 100, height: 100)
                .foregroundStyle(page.iconColor)

            Text(page.title)
                .font(.title2)
                .fontWeight(.bold)
                .multilineTextAlignment(.center)

            Text(page.description)
                .font(.body)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)

            Spacer()
            Spacer()
        }
    }
}

#Preview {
    TutorialView(onFinish: {})
}
