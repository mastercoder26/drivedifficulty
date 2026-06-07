import UIKit

enum MapApp {
    case appleMaps
    case googleMaps
}

enum RouteNavigationService {
    static func appleMapsURL(origin: String, destination: String) -> URL? {
        url(
            scheme: "http",
            host: "maps.apple.com",
            path: "/",
            queryItems: [
                URLQueryItem(name: "saddr", value: origin),
                URLQueryItem(name: "daddr", value: destination),
                URLQueryItem(name: "dirflg", value: "d"),
            ]
        )
    }

    static func googleMapsAppURL(origin: String, destination: String) -> URL? {
        url(
            scheme: "comgooglemaps",
            host: nil,
            path: "/",
            queryItems: [
                URLQueryItem(name: "saddr", value: origin),
                URLQueryItem(name: "daddr", value: destination),
                URLQueryItem(name: "directionsmode", value: "driving"),
            ]
        )
    }

    static func googleMapsWebURL(origin: String, destination: String) -> URL? {
        url(
            scheme: "https",
            host: "www.google.com",
            path: "/maps/dir/",
            queryItems: [
                URLQueryItem(name: "api", value: "1"),
                URLQueryItem(name: "origin", value: origin),
                URLQueryItem(name: "destination", value: destination),
                URLQueryItem(name: "travelmode", value: "driving"),
            ]
        )
    }

    static func googleMapsURL(origin: String, destination: String) -> URL? {
        if let appURL = googleMapsAppURL(origin: origin, destination: destination),
           UIApplication.shared.canOpenURL(appURL) {
            return appURL
        }
        return googleMapsWebURL(origin: origin, destination: destination)
    }

    static var isGoogleMapsInstalled: Bool {
        guard let url = URL(string: "comgooglemaps://") else { return false }
        return UIApplication.shared.canOpenURL(url)
    }

    private static func url(
        scheme: String,
        host: String?,
        path: String,
        queryItems: [URLQueryItem]
    ) -> URL? {
        var components = URLComponents()
        components.scheme = scheme
        components.host = host
        components.path = path
        components.queryItems = queryItems
        return components.url
    }
}
