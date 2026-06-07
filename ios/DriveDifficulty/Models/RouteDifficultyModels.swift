import Foundation
import CoreLocation

// MARK: - Request

struct RouteDifficultyRequest: Encodable {
    let origin: String
    let destination: String
    let departureTime: String
    let includeAlternates: Bool
}

// MARK: - Response

struct RouteDifficultyResponse: Decodable {
    let primaryRoute: ScoredRoute
    let alternateRoutes: [ScoredRoute]
}

struct ScoredRoute: Decodable, Identifiable, Hashable {
    var id: String { polyline.prefix(32).description }

    let score: Double
    let label: DifficultyLabel
    let reasons: [String]
    let breakdown: DifficultyBreakdown
    let distanceMeters: Int
    let durationSeconds: Int
    let staticDurationSeconds: Int
    let trafficDelaySeconds: Int
    let polyline: String
    let bounds: RouteBounds
    let scoreDelta: Double?

    func hash(into hasher: inout Hasher) {
        hasher.combine(polyline)
    }

    static func == (lhs: ScoredRoute, rhs: ScoredRoute) -> Bool {
        lhs.polyline == rhs.polyline
    }
}

struct DifficultyBreakdown: Decodable {
    let highway: Double
    let speed: Double
    let maneuvers: Double
    let traffic: Double

    var items: [(key: String, title: String, value: Double)] {
        [
            ("highway", "Highway", highway),
            ("speed", "Speed", speed),
            ("maneuvers", "Maneuvers", maneuvers),
            ("traffic", "Traffic", traffic)
        ]
    }
}

struct RouteBounds: Decodable {
    let southwest: Coordinate
    let northeast: Coordinate

    var mapRect: (southwest: CLLocationCoordinate2D, northeast: CLLocationCoordinate2D) {
        (
            southwest: CLLocationCoordinate2D(latitude: southwest.latitude, longitude: southwest.longitude),
            northeast: CLLocationCoordinate2D(latitude: northeast.latitude, longitude: northeast.longitude)
        )
    }
}

struct Coordinate: Decodable {
    let latitude: Double
    let longitude: Double
}

enum DifficultyLabel: String, Decodable, CaseIterable {
    case veryEasy = "Very Easy"
    case easy = "Easy"
    case moderate = "Moderate"
    case hard = "Hard"
    case veryHard = "Very Hard"

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        let raw = try container.decode(String.self)
        if let match = DifficultyLabel(rawValue: raw) {
            self = match
            return
        }
        switch raw.lowercased() {
        case "very easy": self = .veryEasy
        case "easy": self = .easy
        case "moderate": self = .moderate
        case "hard": self = .hard
        case "very hard": self = .veryHard
        default: self = .moderate
        }
    }
}

// MARK: - Formatting

extension ScoredRoute {
    var distanceMiles: Double {
        Double(distanceMeters) / 1609.344
    }

    var formattedDistance: String {
        String(format: "%.1f mi", distanceMiles)
    }

    var formattedDuration: String {
        Self.formatDuration(seconds: durationSeconds)
    }

    var formattedStaticDuration: String {
        Self.formatDuration(seconds: staticDurationSeconds)
    }

    var formattedDelay: String? {
        guard trafficDelaySeconds > 0 else { return nil }
        return "+\(Self.formatDuration(seconds: trafficDelaySeconds))"
    }

    static func formatDuration(seconds: Int) -> String {
        let hours = seconds / 3600
        let minutes = (seconds % 3600) / 60
        if hours > 0 {
            return "\(hours)h \(minutes)m"
        }
        return "\(minutes) min"
    }
}

extension DifficultyLabel {
    var colorName: String {
        switch self {
        case .veryEasy: return "DifficultyVeryEasy"
        case .easy: return "DifficultyEasy"
        case .moderate: return "DifficultyModerate"
        case .hard: return "DifficultyHard"
        case .veryHard: return "DifficultyVeryHard"
        }
    }

    var systemColor: (red: Double, green: Double, blue: Double) {
        switch self {
        case .veryEasy: return (0.20, 0.78, 0.35)
        case .easy: return (0.40, 0.85, 0.45)
        case .moderate: return (1.00, 0.80, 0.00)
        case .hard: return (1.00, 0.55, 0.20)
        case .veryHard: return (0.95, 0.25, 0.25)
        }
    }
}
