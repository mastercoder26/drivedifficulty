import SwiftUI

struct HomeView: View {
    @State private var origin = ""
    @State private var destination = ""
    @State private var departureTime = Date().addingTimeInterval(15 * 60)
    @State private var hoursSlept = 7.0
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var navigationPath = NavigationPath()

    private let apiClient = APIClient()

    private var canAnalyze: Bool {
        !origin.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
        !destination.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
        !isLoading
    }

    var body: some View {
        NavigationStack(path: $navigationPath) {
            Form {
                Section {
                    AddressSearchField(
                        title: "Origin",
                        placeholder: "Starting address",
                        systemImage: "mappin.circle.fill",
                        text: $origin
                    )

                    AddressSearchField(
                        title: "Destination",
                        placeholder: "Destination address",
                        systemImage: "flag.fill",
                        text: $destination
                    )
                } header: {
                    Text("Route")
                }

                Section {
                    DatePicker(
                        "Departure",
                        selection: $departureTime,
                        in: Date()...,
                        displayedComponents: [.date, .hourAndMinute]
                    )

                    Stepper(value: $hoursSlept, in: 4...12, step: 0.5) {
                        Text("Hours slept: \(hoursSlept, specifier: "%.1f")")
                    }
                } header: {
                    Text("When")
                } footer: {
                    Text("Traffic and fatigue estimates use departure time and sleep.")
                }

                if let errorMessage {
                    Section {
                        Label(errorMessage, systemImage: "exclamationmark.triangle.fill")
                            .foregroundStyle(.red)
                            .font(.subheadline)
                    }
                }

                Section {
                    Button {
                        Task { await analyzeRoute() }
                    } label: {
                        HStack {
                            Spacer()
                            if isLoading {
                                ProgressView()
                                    .padding(.trailing, 8)
                            }
                            Text(isLoading ? "Analyzing…" : "Analyze Difficulty")
                                .fontWeight(.semibold)
                            Spacer()
                        }
                    }
                    .disabled(!canAnalyze)
                }
            }
            .navigationTitle("Drive Difficulty")
            .navigationDestination(for: RouteAnalysisResult.self) { result in
                ResultsView(result: result)
            }
        }
    }

    private func analyzeRoute() async {
        errorMessage = nil
        isLoading = true
        defer { isLoading = false }

        do {
            let response = try await apiClient.analyzeRoute(
                origin: origin,
                destination: destination,
                departureTime: departureTime,
                includeAlternates: true,
                hoursSlept: hoursSlept
            )

            let result = RouteAnalysisResult(
                primaryRoute: response.primaryRoute,
                alternateRoutes: response.alternateRoutes
            )

            UINotificationFeedbackGenerator().notificationOccurred(.success)
            navigationPath.append(result)
        } catch {
            UINotificationFeedbackGenerator().notificationOccurred(.error)
            errorMessage = error.localizedDescription
        }
    }
}

struct RouteAnalysisResult: Hashable {
    let primaryRoute: ScoredRoute
    let alternateRoutes: [ScoredRoute]
}

#Preview {
    HomeView()
}
