import SwiftUI

struct AlternateRouteCard: View {
    let route: ScoredRoute
    let isSelected: Bool
    let onSelect: () -> Void

    private var accentColor: Color {
        let rgb = route.label.systemColor
        return Color(red: rgb.red, green: rgb.green, blue: rgb.blue)
    }

    var body: some View {
        Button(action: onSelect) {
            HStack(spacing: 14) {
                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 8) {
                        Text(route.formattedScoreWithUncertainty)
                            .font(.title3.weight(.bold).monospacedDigit())
                            .foregroundStyle(accentColor)

                        Text(route.label.rawValue)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(.secondary)
                    }

                    if let topReason = route.reasons.first {
                        Text(topReason)
                            .font(.subheadline)
                            .foregroundStyle(.primary)
                            .lineLimit(1)
                    }

                    HStack(spacing: 12) {
                        Label(route.formattedDuration, systemImage: "clock")
                        Label(route.formattedDistance, systemImage: "arrow.left.and.right")
                    }
                    .font(.caption)
                    .foregroundStyle(.secondary)
                }

                Spacer(minLength: 0)

                if let delta = route.scoreDelta {
                    Text(deltaText(delta))
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(delta >= 0 ? .orange : .green)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Color(.tertiarySystemFill))
                        .clipShape(Capsule())
                }

                Image(systemName: isSelected ? "checkmark.circle.fill" : "chevron.right")
                    .foregroundStyle(isSelected ? Color.accentColor : Color(.tertiaryLabel))
            }
            .padding(16)
            .background(Color(.secondarySystemGroupedBackground))
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .strokeBorder(isSelected ? Color.accentColor : Color.clear, lineWidth: 2)
            )
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Alternate route, score \(route.formattedScoreWithUncertainty), \(route.label.rawValue)")
    }

    private func deltaText(_ delta: Double) -> String {
        let sign = delta >= 0 ? "+" : ""
        return "\(sign)\(String(format: "%.1f", delta))"
    }
}

#Preview {
    AlternateRouteCard(
        route: ScoredRoute(
            score: 5.1,
            uncalibratedScore: 5.0,
            label: .moderate,
            reasons: ["Many turns"],
            breakdown: DifficultyBreakdown(
                speed: 0.3, merges: 0.2, turns: 0.6, traffic: 0.2,
                length: 0.3, fatigue: 0.1,
                highway: 0.3, maneuvers: 0.6, navDensity: 0.4, effort: 0.3
            ),
            contributions: nil,
            uncertainty: ScoreUncertainty(low: 4.5, high: 5.7, confidence: 0.7, spread: 1.2),
            hotspots: nil,
            predictionId: nil,
            modelVersion: nil,
            requestFeedback: nil,
            feedbackReasons: nil,
            distanceMeters: 12000,
            durationSeconds: 1800,
            staticDurationSeconds: 1500,
            trafficDelaySeconds: 300,
            polyline: "abc",
            bounds: RouteBounds(
                southwest: Coordinate(latitude: 30.0, longitude: -97.0),
                northeast: Coordinate(latitude: 30.5, longitude: -97.5)
            ),
            scoreDelta: 0.9
        ),
        isSelected: false,
        onSelect: {}
    )
    .padding()
}
