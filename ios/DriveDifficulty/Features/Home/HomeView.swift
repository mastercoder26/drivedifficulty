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
        !origin.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && !destination.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !isLoading
    }

    var body: some View {
        NavigationStack(path: $navigationPath) {
            ZStack {
                // Background Gradient
                LinearGradient(
                    colors: [Color.blue.opacity(0.15), Color.purple.opacity(0.15)],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                .ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 28) {
                        // Header Icon
                        VStack(spacing: 12) {
                            Image("hero-image")
                                .resizable()
                                .scaledToFill()
                                .frame(height: 180)
                                .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
                                .shadow(color: .blue.opacity(0.2), radius: 15, x: 0, y: 8)

                            Text("AI-powered insights for a safer journey")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                                .multilineTextAlignment(.center)
                                .padding(.horizontal)
                        }
                        .padding(.top, 16)

                        // Route Card
                        VStack(alignment: .leading, spacing: 16) {
                            Label {
                                Text("Route")
                            } icon: {
                                Image("route-icon")
                                    .resizable()
                                    .scaledToFit()
                                    .frame(width: 24, height: 24)
                                    .clipShape(RoundedRectangle(cornerRadius: 6))
                            }
                            .font(.headline)
                            .foregroundStyle(.secondary)

                            VStack(spacing: 12) {
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
                            }
                        }
                        .padding(20)
                        .background(.regularMaterial)
                        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
                        .shadow(color: .black.opacity(0.05), radius: 15, x: 0, y: 8)

                        // Preferences Card
                        VStack(alignment: .leading, spacing: 16) {
                            Label("Preferences", systemImage: "slider.horizontal.3")
                                .font(.headline)
                                .foregroundStyle(.secondary)

                            VStack(spacing: 24) {
                                DatePicker(
                                    "Departure Time",
                                    selection: $departureTime,
                                    in: Date()...,
                                    displayedComponents: [.date, .hourAndMinute]
                                )
                                .tint(.blue)
                                .font(.body.weight(.medium))

                                Divider()

                                VStack(alignment: .leading, spacing: 12) {
                                    HStack {
                                        Text("Hours Slept")
                                            .font(.body.weight(.medium))
                                        Spacer()
                                        Text("\(hoursSlept, specifier: "%.1f") hrs")
                                            .fontWeight(.bold)
                                            .foregroundStyle(.blue)
                                    }
                                    Slider(value: $hoursSlept, in: 4...12, step: 0.5)
                                        .tint(.blue)

                                    HStack {
                                        Text("4h")
                                        Spacer()
                                        Text("12h")
                                    }
                                    .font(.caption2.weight(.medium))
                                    .foregroundStyle(.secondary)
                                }
                            }
                        }
                        .padding(20)
                        .background(.regularMaterial)
                        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
                        .shadow(color: .black.opacity(0.05), radius: 15, x: 0, y: 8)

                        if let errorMessage {
                            HStack(spacing: 12) {
                                Image(systemName: "exclamationmark.triangle.fill")
                                Text(errorMessage)
                            }
                            .font(.subheadline.weight(.medium))
                            .foregroundStyle(.white)
                            .padding()
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(Color.red.opacity(0.85))
                            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                            .transition(.opacity.combined(with: .move(edge: .bottom)))
                        }

                        // Analyze Button
                        Button {
                            Task { await analyzeRoute() }
                        } label: {
                            HStack(spacing: 8) {
                                if isLoading {
                                    ProgressView()
                                        .tint(.white)
                                }
                                Text(isLoading ? "Analyzing Route..." : "Analyze Difficulty")
                                    .font(.title3.weight(.semibold))
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 18)
                            .background(
                                LinearGradient(
                                    colors: canAnalyze
                                        ? [.blue, .purple]
                                        : [.gray.opacity(0.3), .gray.opacity(0.3)],
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )
                            .foregroundStyle(canAnalyze ? .white : .secondary)
                            .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                            .shadow(
                                color: canAnalyze ? .blue.opacity(0.4) : .clear, radius: 12, x: 0,
                                y: 6
                            )
                            .scaleEffect(isLoading ? 0.96 : 1)
                            .animation(
                                .spring(response: 0.3, dampingFraction: 0.6), value: isLoading)
                        }
                        .disabled(!canAnalyze)
                        .padding(.bottom, 40)
                    }
                    .padding(.horizontal, 20)
                }
                .scrollIndicators(.hidden)
            }
            .navigationTitle("Drive Difficulty")
            .navigationDestination(for: RouteAnalysisResult.self) { result in
                ResultsView(result: result)
            }
            .animation(.spring(response: 0.4, dampingFraction: 0.8), value: errorMessage)
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
                origin: origin,
                destination: destination,
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
    let origin: String
    let destination: String
    let primaryRoute: ScoredRoute
    let alternateRoutes: [ScoredRoute]
}

#Preview {
    HomeView()
}
