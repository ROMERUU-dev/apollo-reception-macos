import Foundation

@MainActor
final class AppState: ObservableObject {
    enum LoadState: Equatable {
        case idle
        case loading
        case ready
        case failed(String)
    }

    let configuration: AppConfiguration?
    let configurationError: String?

    @Published private(set) var loadState: LoadState = .idle
    @Published private(set) var currentURL: URL?
    @Published private(set) var reloadGeneration = 0
    @Published private(set) var blockedNavigation: URL?

    init() {
        do {
            configuration = try AppConfiguration.load()
            configurationError = nil
        } catch {
            configuration = nil
            configurationError = error.localizedDescription
        }
    }

    func beginLoading(_ url: URL?) {
        currentURL = url
        loadState = .loading
    }

    func finishLoading(_ url: URL?) {
        currentURL = url
        loadState = .ready
    }

    func failLoading(_ message: String) {
        loadState = .failed(message)
    }

    func noteBlockedNavigation(_ url: URL?) {
        blockedNavigation = url
    }

    func reload() {
        reloadGeneration += 1
    }
}
