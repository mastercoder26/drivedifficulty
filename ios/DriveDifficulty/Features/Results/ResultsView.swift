import SwiftUI

struct ResultsView: View {
    let result: RouteAnalysisResult

    @Environment(\.openURL) private var openURL
    @State private var selectedRoute: ScoredRoute
    @State private var showFeedbackSheet = false
    @State private var feedbackRating: Double = 5
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
                if let conditions = selectedRoute.conditions, !conditions.sources.isEmpty {
                    conditionsSection(conditions)
                }
                navigationSection
                if let hotspots = selectedRoute.hotspots, !hotspots.isEmpty {
                    hotspotsSection(hotspots)
                }
                breakdownSection
                if let contributions = selectedRoute.contributions, !contributions.isEmpty {
                    contributionsSection(contributions)
                }
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

    private var navigationSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Start Navigation")
                .font(.headline)

            HStack(spacing: 12) {
                Button {
                    openInAppleMaps()
                } label: {
                    Label("Apple Maps", systemImage: "map.fill")
                        .font(.subheadline.weight(.semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 4)
                }
                .buttonStyle(.borderedProminent)
                .tint(Color(red: 0.0, green: 0.48, blue: 1.0))

                Button {
                    openInGoogleMaps()
                } label: {
                    Label("Google Maps", systemImage: "globe.americas.fill")
                        .font(.subheadline.weight(.semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 4)
                }
                .buttonStyle(.bordered)
            }
        }
        .padding(16)
        .background(Color(.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private func openInAppleMaps() {
        guard let url = RouteNavigationService.appleMapsURL(
            origin: result.origin,
            destination: result.destination
        ) else { return }
        openURL(url)
    }

    private func openInGoogleMaps() {
        guard let url = RouteNavigationService.googleMapsURL(
            origin: result.origin,
            destination: result.destination
        ) else { return }
        openURL(url)
    }

    @ViewBuilder
    private func conditionsSection(_ conditions: RouteConditions) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Live Conditions")
                .font(.headline)

            if conditions.weather.available {
                HStack(spacing: 12) {
                    Image(systemName: conditions.weather.systemImage)
                        .font(.title2)
                        .symbolRenderingMode(.multicolor)
                        .frame(width: 40, height: 40)
                        .background(Color(.tertiarySystemGroupedBackground))
                        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))

                    VStack(alignment: .leading, spacing: 2) {
                        HStack(spacing: 8) {
                            Text(conditions.weather.condition)
                                .font(.subheadline.weight(.semibold))
                            severityChip(
                                label: conditions.weather.severityLabel,
                                severity: conditions.weather.severity
                            )
                        }
                        Text(weatherDetailText(conditions.weather))
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                }
            }

            if conditions.road.available {
                Divider()
                HStack(spacing: 12) {
                    Image(systemName: "road.lanes")
                        .font(.title2)
                        .foregroundStyle(.blue)
                        .frame(width: 40, height: 40)
                        .background(Color(.tertiarySystemGroupedBackground))
                        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))

                    VStack(alignment: .leading, spacing: 2) {
                        Text(conditions.road.dominantRoadLabel)
                            .font(.subheadline.weight(.semibold))
                        Text(roadDetailText(conditions.road))
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                }
            }

            if conditions.road.constructionZones > 0 {
                conditionRow(
                    systemImage: "cone.fill",
                    color: .orange,
                    text: conditions.road.constructionZones == 1
                        ? "1 construction zone along the route"
                        : "\(conditions.road.constructionZones) construction zones along the route"
                )
            }

            if conditions.turns.available && conditions.turns.unprotectedLeftTurns > 0 {
                conditionRow(
                    systemImage: "arrow.turn.up.left",
                    color: .red,
                    text: conditions.turns.unprotectedLeftTurns == 1
                        ? "1 unprotected left turn (no signal)"
                        : "\(conditions.turns.unprotectedLeftTurns) unprotected left turns (no signal)"
                )
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private func conditionRow(systemImage: String, color: Color, text: String) -> some View {
        HStack(spacing: 10) {
            Image(systemName: systemImage)
                .font(.subheadline)
                .foregroundStyle(color)
                .frame(width: 24)
            Text(text)
                .font(.subheadline)
            Spacer()
        }
    }

    private func severityChip(label: String, severity: Double) -> some View {
        let color: Color = severity < 0.15 ? .green : severity < 0.4 ? .yellow : severity < 0.7 ? .orange : .red
        return Text(label)
            .font(.caption2.weight(.bold))
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(color.opacity(0.18))
            .foregroundStyle(color)
            .clipShape(Capsule())
    }

    private func weatherDetailText(_ weather: WeatherConditions) -> String {
        var parts: [String] = [String(format: "%.0f°F", weather.temperatureF)]
        if weather.windGustMph >= 15 {
            parts.append(String(format: "gusts %.0f mph", weather.windGustMph))
        }
        if weather.visibilityMiles > 0 && weather.visibilityMiles < 5 {
            parts.append(String(format: "visibility %.1f mi", weather.visibilityMiles))
        }
        if weather.icyRisk > 0.3 {
            parts.append("ice risk")
        }
        return parts.joined(separator: " · ")
    }

    private func roadDetailText(_ road: RoadConditions) -> String {
        var parts: [String] = []
        if road.avgLanes > 0 {
            parts.append(String(format: "avg %.1f lanes", road.avgLanes))
        }
        if road.majorRoadShare > 0 {
            parts.append(String(format: "%.0f%% major roads", road.majorRoadShare * 100))
        }
        if road.narrowRoadShare >= 0.15 {
            parts.append(String(format: "%.0f%% narrow", road.narrowRoadShare * 100))
        }
        if road.unpavedShare >= 0.05 {
            parts.append(String(format: "%.0f%% unpaved", road.unpavedShare * 100))
        }
        return parts.isEmpty ? "Road data from OpenStreetMap" : parts.joined(separator: " · ")
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

    private func contributionsSection(_ contributions: [FactorContribution]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Top Factors")
                .font(.headline)

            ForEach(contributions.prefix(5)) { entry in
                BreakdownBarRow(
                    title: entry.label,
                    value: entry.share
                )
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

            if selectedRoute.reasons.isEmpty {
                Text("No specific difficulty factors identified for this route.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            } else {
                ReasonChipFlowLayout(reasons: selectedRoute.reasons)
            }
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
                userRating: feedbackRating
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
                origin: "Miami, FL",
                destination: "Orlando, FL",
                primaryRoute: ScoredRoute(
                    score: 4.2,
                    uncalibratedScore: 4.0,
                    label: .easy,
                    reasons: ["Mostly highway", "Light traffic"],
                    breakdown: DifficultyBreakdown(
                        speed: 0.30, merges: 0.15, turns: 0.35, traffic: 0.15,
                        length: 0.45, fatigue: 0.20, weather: 0.35, road: 0.15,
                        highway: 0.30, maneuvers: 0.35, navDensity: 0.20, effort: 0.45
                    ),
                    contributions: [
                        FactorContribution(
                            factor: "speed",
                            label: "High-speed road burden",
                            value: 0.30,
                            weight: 0.3,
                            contribution: 0.09,
                            share: 0.35
                        ),
                        FactorContribution(
                            factor: "length",
                            label: "Length/monotony burden",
                            value: 0.45,
                            weight: 0.15,
                            contribution: 0.0675,
                            share: 0.26
                        )
                    ],
                    uncertainty: ScoreUncertainty(low: 3.6, high: 4.8, confidence: 0.75, spread: 1.2),
                    hotspots: [],
                    conditions: RouteConditions(
                        weather: WeatherConditions(
                            available: true, condition: "Rain", severity: 0.45,
                            precipIntensity: 0.5, snowRisk: 0, windSeverity: 0.2,
                            lowVisibilityRisk: 0.1, icyRisk: 0, temperatureF: 54,
                            windGustMph: 22, visibilityMiles: 4.5
                        ),
                        road: RoadConditions(
                            available: true, avgLanes: 2.6, narrowRoadShare: 0.1,
                            majorRoadShare: 0.8, unpavedShare: 0, roadSizeScore: 0.2,
                            constructionZones: 1, dominantRoadClass: "motorway"
                        ),
                        turns: TurnExposure(
                            available: true, unprotectedLeftTurns: 2,
                            protectedLeftTurns: 3, unprotectedTurnShare: 0.4
                        ),
                        sources: ["open-meteo", "osm-overpass"]
                    ),
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
