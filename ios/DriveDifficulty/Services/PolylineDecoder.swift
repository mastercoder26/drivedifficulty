import CoreLocation
import MapKit

enum PolylineDecoder {
    /// Decodes a Google-encoded polyline string into coordinates.
    static func decode(_ encoded: String) -> [CLLocationCoordinate2D] {
        var coordinates: [CLLocationCoordinate2D] = []
        var index = encoded.startIndex
        var latitude: Int32 = 0
        var longitude: Int32 = 0

        while index < encoded.endIndex {
            guard let latResult = decodeComponent(from: encoded, index: &index) else { break }
            latitude += latResult

            guard let lngResult = decodeComponent(from: encoded, index: &index) else { break }
            longitude += lngResult

            coordinates.append(
                CLLocationCoordinate2D(
                    latitude: Double(latitude) / 1e5,
                    longitude: Double(longitude) / 1e5
                )
            )
        }

        return coordinates
    }

    static func mkPolyline(from encoded: String) -> MKPolyline? {
        let coords = decode(encoded)
        guard !coords.isEmpty else { return nil }
        return MKPolyline(coordinates: coords, count: coords.count)
    }

    private static func decodeComponent(from encoded: String, index: inout String.Index) -> Int32? {
        var result: Int32 = 0
        var shift: Int32 = 0
        var byte: Int32

        repeat {
            guard index < encoded.endIndex else { return nil }
            let scalar = encoded[index].asciiValue.map(Int32.init) ?? 0
            index = encoded.index(after: index)
            byte = scalar - 63
            result |= (byte & 0x1F) << shift
            shift += 5
        } while byte >= 0x20

        let delta = (result & 1) != 0 ? ~(result >> 1) : (result >> 1)
        return delta
    }
}
