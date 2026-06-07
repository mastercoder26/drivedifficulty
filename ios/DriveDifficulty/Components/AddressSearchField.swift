import MapKit
import SwiftUI

struct AddressSearchField: View {
    let title: String
    let placeholder: String
    let systemImage: String
    @Binding var text: String

    @StateObject private var completer = AddressSearchCompleter()
    @FocusState private var isFocused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 12) {
                Image(systemName: systemImage)
                    .foregroundStyle(.secondary)
                    .frame(width: 20)

                TextField(placeholder, text: $text)
                    .focused($isFocused)
                    .textInputAutocapitalization(.words)
                    .autocorrectionDisabled()
                    .onChange(of: text) { _, newValue in
                        completer.queryFragment = newValue
                    }
            }
            .padding(.vertical, 4)

            if isFocused, !completer.suggestions.isEmpty {
                Divider()
                    .padding(.leading, 32)

                ForEach(Array(completer.suggestions.prefix(4).enumerated()), id: \.offset) { _, suggestion in
                    Button {
                        text = suggestion.title + (suggestion.subtitle.isEmpty ? "" : ", \(suggestion.subtitle)")
                        completer.clear()
                        isFocused = false
                    } label: {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(suggestion.title)
                                .font(.body)
                                .foregroundStyle(.primary)
                            if !suggestion.subtitle.isEmpty {
                                Text(suggestion.subtitle)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.vertical, 8)
                        .padding(.leading, 32)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel(title)
    }
}

@MainActor
final class AddressSearchCompleter: NSObject, ObservableObject, MKLocalSearchCompleterDelegate {
    @Published var suggestions: [MKLocalSearchCompletion] = []

    private let completer = MKLocalSearchCompleter()

    var queryFragment: String = "" {
        didSet {
            completer.queryFragment = queryFragment
        }
    }

    override init() {
        super.init()
        completer.delegate = self
        completer.resultTypes = .address
    }

    func clear() {
        suggestions = []
        completer.queryFragment = ""
    }

    nonisolated func completerDidUpdateResults(_ completer: MKLocalSearchCompleter) {
        Task { @MainActor in
            suggestions = completer.results
        }
    }

    nonisolated func completer(_ completer: MKLocalSearchCompleter, didFailWithError error: Error) {
        Task { @MainActor in
            suggestions = []
        }
    }
}
