import SwiftUI

struct ResultsView: View {
    let result: RouteAnalysisResult

    @State private var selectedRoute: ScoredRoute
    @State private var showFeedbackSheet = false
    @State private var feedbackRating: Double = 5
    @State private var choseAlternate = false
    @State private var feedbackSubmitted = false

    init(result: RouteAnalysisResult) {
        self.result = result
        _selectedRoute = State(initialValue: result.primaryRoute)
    }

    private var alternates: [ScoredRoute] {
        var routes: [ScoredRoute] = []
        let all = [result.primaryRoute] + result.alternateRoutes

        for route in all where route.polyline != selectedRoute.polyline {
            routes.append(route)
        }
        return routes
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                scoreSection
                mapSection
                tripDetailsSection
                if let hotspots = selectedRoute.hotspots, !hotspots.isEmpty {
                    hotspotsSection(hotspots)
                }
                breakdownSection
                reasonsSection
                feedbackSection

                if !alternates.isEmpty {
                    alternatesSection
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
        }
        .background(Color(.systemGroupedBackground))
        .navigationTitle("Results")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showFeedbackSheet) {
            feedbackSheet
        }
        .onAppear {
            if selectedRoute.requestFeedback == true && selectedRoute.predictionId != nil {
                showFeedbackSheet = true
            }
        }
    }

    private var scoreSection: some View {
        VStack(spacing: 12) {
            ScoreGaugeView(score: selectedRoute.score, label: selectedRoute.label)

            Text(selectedRoute.label.rawValue)
                .font(.title3.weight(.semibold))
                .foregroundStyle(labelColor)
                .padding(.horizontal, 14)
                .padding(.vertical, 6)
                .background(labelColor.opacity(0.15))
                .clipShape(Capsule())

            if selectedRoute.uncertainty != nil {
                Text(selectedRoute.formattedScoreWithUncertainty)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(.secondary)
                    .monospacedDigit()

                if let confidence = selectedRoute.uncertainty?.confidence {
                    Text(String(format: "%.0f%% confidence", confidence * 100))
                        .font(.caption)
                        .foregroundStyle(.tertiary)
                }
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
    }

    private var mapSection: some View {
        RouteMapView(polyline: selectedRoute.polyline, bounds: selectedRoute.bounds)
            .frame(height: 220)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            .shadow(color: .black.opacity(0.08), radius: 8, y: 4)
    }

    private var tripDetailsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Trip")
                .font(.headline)

            HStack(spacing: 16) {
                detailTile(
                    title: "ETA",
                    value: selectedRoute.formattedDuration,
                    systemImage: "clock.fill"
                )

                if let delay = selectedRoute.formattedDelay {
                    detailTile(
                        title: "Delay",
                        value: delay,
                        systemImage: "car.fill",
                        valueColor: .orange
                    )
                }

                detailTile(
                    title: "Distance",
                    value: selectedRoute.formattedDistance,
                    systemImage: "arrow.left.and.right"
                )
            }

            HStack(spacing: 6) {
                Image(systemName: "gauge.with.dots.needle.33percent")
                    .foregroundStyle(.secondary)
                Text("Normal drive: \(selectedRoute.formattedStaticDuration)")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(16)
        .background(Color(.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private func hotspotsSection(_ hotspots: [SegmentHotspot]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Difficulty Hotspots")
                .font(.headline)

            ForEach(hotspots.prefix(5)) { hotspot in
                HStack(spacing: 10) {
                    Text("#\(hotspot.segmentIndex + 1)")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(.white)
                        .frame(width: 28, height: 28)
                        .background(Color.orange.gradient)
                        .clipShape(Circle())

                    VStack(alignment: .leading, spacing: 2) {
                        Text(hotspot.label ?? "Segment \(hotspot.segmentIndex + 1)")
                            .font(.subheadline.weight(.medium))
                        Text(String(format: "Intensity %.0f%%", hotspot.difficulty * 100))
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                }
            }
        }
        .padding(16)
        .background(Color(.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private var breakdownSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Difficulty Breakdown")
                .font(.headline)

            ForEach(selectedRoute.breakdown.items, id: \.key) { item in
                BreakdownBarRow(title: item.title, value: item.value)
            }
        }
        .padding(16)
        .background(Color(.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private var reasonsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Why this score")
                .font(.headline)

            ReasonChipFlowLayout(reasons: selectedRoute.reasons)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private var feedbackSection: some View {
        Group {
            if selectedRoute.predictionId != nil {
                VStack(alignment: .leading, spacing: 12) {
                    Text("Was this accurate?")
                        .font(.headline)

                    if feedbackSubmitted {
                        Label("Thanks for your feedback!", systemImage: "checkmark.circle.fill")
                            .foregroundStyle(.green)
                    } else {
                        Button {
                            showFeedbackSheet = true
                        } label: {
                            Label("Rate this prediction", systemImage: "hand.thumbsup")
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.borderedProminent)
                    }
                }
                .padding(16)
                .background(Color(.secondarySystemGroupedBackground))
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            }
        }
    }

    private var feedbackSheet: some View {
        NavigationStack {
            Form {
                Section("How difficult was this drive?") {
                    Slider(value: $feedbackRating, in: 1...10, step: 1)
                    Text("Rating: \(Int(feedbackRating))/10")
                        .monospacedDigit()
                }

                Section {
                    Toggle("I chose a different route", isOn: $choseAlternate)
                }
            }
            .navigationTitle("Feedback")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Skip") { showFeedbackSheet = false }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Submit") {
                        Task { await submitFeedback() }
                    }
                }
            }
        }
        .presentationDetents([.medium])
    }

    private var alternatesSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Alternate Routes")
                .font(.headline)

            ForEach(alternates) { route in
                AlternateRouteCard(
                    route: route,
                    isSelected: route.polyline == selectedRoute.polyline
                ) {
                    withAnimation(.easeInOut(duration: 0.25)) {
                        selectedRoute = route
                    }
                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                }
            }
        }
    }

    private func submitFeedback() async {
        guard let predictionId = selectedRoute.predictionId else { return }
        do {
            try await APIClient().submitFeedback(
                predictionId: predictionId,
                userRating: feedbackRating,
                alternateSelected: choseAlternate
            )
            feedbackSubmitted = true
            showFeedbackSheet = false
        } catch {
            showFeedbackSheet = false
        }
    }

    private var labelColor: Color {
        let rgb = selectedRoute.label.systemColor
        return Color(red: rgb.red, green: rgb.green, blue: rgb.blue)
    }

    @ViewBuilder
    private func detailTile(
        title: String,
        value: String,
        systemImage: String,
        valueColor: Color = .primary
    ) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Label(title, systemImage: systemImage)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(valueColor)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct BreakdownBarRow: View {
    let title: String
    let value: Double

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(title)
                    .font(.subheadline)
                Spacer()
                Text(String(format: "%.0f%%", value * 100))
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(.secondary)
                    .monospacedDigit()
            }

            GeometryReader { geometry in
                ZStack(alignment: .leading) {
                    Capsule()
                        .fill(Color(.systemGray5))
                    Capsule()
                        .fill(barColor)
                        .frame(width: geometry.size.width * min(max(value, 0), 1))
                }
            }
            .frame(height: 8)
        }
    }

    private var barColor: Color {
        switch value {
        case 0..<0.35: return .green
        case 0.35..<0.65: return .orange
        default: return .red
        }
    }
}

#Preview {
    NavigationStack {
        ResultsView(
            result: RouteAnalysisResult(
                primaryRoute: ScoredRoute(
                    score: 4.2,
                    uncalibratedScore: 4.0,
                    label: .easy,
                    reasons: ["Mostly highway", "Light traffic"],
                    breakdown: DifficultyBreakdown(
                        speed: 0.30, merges: 0.15, turns: 0.35, traffic: 0.15,
                        length: 0.45, fatigue: 0.20,
                        highway: 0.30, maneuvers: 0.35, navDensity: 0.20, effort: 0.45
                    ),
                    contributions: nil,
                    uncertainty: ScoreUncertainty(low: 3.6, high: 4.8, confidence: 0.75, spread: 1.2),
                    hotspots: [],
                    predictionId: nil,
                    modelVersion: "hybrid-v1",
                    requestFeedback: false,
                    feedbackReasons: nil,
                    distanceMeters: 312000,
                    durationSeconds: 10800,
                    staticDurationSeconds: 9900,
                    trafficDelaySeconds: 900,
                    polyline: "_p~iF~ps|U_ulLnnqC_mqNvxq`@",
                    bounds: RouteBounds(
                        southwest: Coordinate(latitude: 30.2, longitude: -97.8),
                        northeast: Coordinate(latitude: 32.8, longitude: -96.8)
                    ),
                    scoreDelta: nil
                ),
                alternateRoutes: []
            )
        )
    }
}
