import MapKit
import SwiftUI

struct RouteMapView: UIViewRepresentable {
    let polyline: String
    let bounds: RouteBounds

    func makeUIView(context: Context) -> MKMapView {
        let mapView = MKMapView()
        mapView.delegate = context.coordinator
        mapView.isRotateEnabled = false
        mapView.pointOfInterestFilter = .excludingAll
        mapView.showsCompass = false
        return mapView
    }

    func updateUIView(_ mapView: MKMapView, context: Context) {
        context.coordinator.update(mapView: mapView, polyline: polyline, bounds: bounds)
    }

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    final class Coordinator: NSObject, MKMapViewDelegate {
        private var renderedPolyline: String?

        func update(mapView: MKMapView, polyline: String, bounds: RouteBounds) {
            guard renderedPolyline != polyline else { return }
            renderedPolyline = polyline

            mapView.removeOverlays(mapView.overlays)

            guard let routePolyline = PolylineDecoder.mkPolyline(from: polyline) else { return }
            mapView.addOverlay(routePolyline)

            let region = region(for: bounds, polyline: polyline)
            mapView.setVisibleMapRect(region, edgePadding: UIEdgeInsets(top: 32, left: 24, bottom: 32, right: 24), animated: false)
        }

        func mapView(_ mapView: MKMapView, rendererFor overlay: MKOverlay) -> MKOverlayRenderer {
            if let polyline = overlay as? MKPolyline {
                let renderer = MKPolylineRenderer(polyline: polyline)
                renderer.strokeColor = UIColor.systemBlue
                renderer.lineWidth = 5
                renderer.lineCap = .round
                renderer.lineJoin = .round
                return renderer
            }
            return MKOverlayRenderer(overlay: overlay)
        }

        private func region(for bounds: RouteBounds, polyline: String) -> MKMapRect {
            let sw = bounds.mapRect.southwest
            let ne = bounds.mapRect.northeast

            let minLat = min(sw.latitude, ne.latitude)
            let maxLat = max(sw.latitude, ne.latitude)
            let minLng = min(sw.longitude, ne.longitude)
            let maxLng = max(sw.longitude, ne.longitude)

            let topLeft = MKMapPoint(CLLocationCoordinate2D(latitude: maxLat, longitude: minLng))
            let bottomRight = MKMapPoint(CLLocationCoordinate2D(latitude: minLat, longitude: maxLng))
            var rect = MKMapRect(
                x: topLeft.x,
                y: topLeft.y,
                width: bottomRight.x - topLeft.x,
                height: bottomRight.y - topLeft.y
            )

            if rect.isNull || rect.size.width == 0 || rect.size.height == 0 {
                let coords = PolylineDecoder.decode(polyline)
                rect = coords.reduce(MKMapRect.null) { partial, coordinate in
                    let point = MKMapPoint(coordinate)
                    let pointRect = MKMapRect(x: point.x, y: point.y, width: 0, height: 0)
                    return partial.isNull ? pointRect : partial.union(pointRect)
                }
            }

            return rect.isNull ? MKMapRect.world : rect
        }
    }
}

#Preview {
    RouteMapView(
        polyline: "_p~iF~ps|U_ulLnnqC_mqNvxq`@",
        bounds: RouteBounds(
            southwest: Coordinate(latitude: 38.5, longitude: -120.2),
            northeast: Coordinate(latitude: 40.7, longitude: -120.95)
        )
    )
    .frame(height: 220)
    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
}
