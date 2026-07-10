import SwiftUI

@main
struct ApolloReceptionApp: App {
    @StateObject private var appState = AppState()

    var body: some Scene {
        WindowGroup("Apollo Reception") {
            ContentView(appState: appState)
                .frame(minWidth: 900, minHeight: 620)
        }
        .defaultSize(width: 1200, height: 800)
    }
}

private struct ContentView: View {
    @ObservedObject var appState: AppState

    var body: some View {
        Group {
            if let configuration = appState.configuration {
                ReceptionWebView(configuration: configuration, appState: appState)
                    .overlay(alignment: .bottomLeading) {
                        statusBadge
                    }
                    .toolbar {
                        Button("Reload") { appState.reload() }
                            .keyboardShortcut("r", modifiers: .command)
                    }
            } else {
                VStack(spacing: 12) {
                    Image(systemName: "lock.shield")
                        .font(.system(size: 38))
                    Text("Apollo Reception is not configured")
                        .font(.title2)
                    Text(appState.configurationError ?? "Configuration is unavailable.")
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                    Text("Set APOLLO_ENVIRONMENT and APOLLO_BASE_URL. No production URL is selected automatically.")
                        .font(.callout)
                        .foregroundStyle(.secondary)
                }
                .padding(32)
            }
        }
    }

    @ViewBuilder
    private var statusBadge: some View {
        switch appState.loadState {
        case .idle:
            EmptyView()
        case .loading:
            Label("Loading", systemImage: "arrow.triangle.2.circlepath")
                .statusBadgeStyle()
        case .ready:
            EmptyView()
        case .failed(let message):
            Label(message, systemImage: "exclamationmark.triangle")
                .statusBadgeStyle()
        }
    }
}

private extension View {
    func statusBadgeStyle() -> some View {
        padding(8)
            .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 8))
            .padding(12)
    }
}
