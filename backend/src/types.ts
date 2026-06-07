export interface LatLng {
  lat: number;
  lng: number;
}

export interface Bounds {
  southwest: LatLng;
  northeast: LatLng;
}

export interface RouteStep {
  distanceMeters: number;
  staticDurationSeconds: number;
  maneuver?: string;
  navigationInstruction?: string;
  polyline?: string;
}

export interface ParsedRoute {
  distanceMeters: number;
  durationSeconds: number;
  staticDurationSeconds: number;
  polyline: string;
  bounds: Bounds;
  steps: RouteStep[];
  routeLabels?: string[];
}

export interface SpeedLimitPoint {
  placeId: string;
  speedLimit?: number;
  speedLimitUnit?: "KPH" | "MPH";
}

export interface ScoringBreakdown {
  highway: number;
  speed: number;
  maneuvers: number;
  traffic: number;
}

export interface ScoredRoute {
  score: number;
  label: string;
  reasons: string[];
  breakdown: ScoringBreakdown;
  distanceMeters: number;
  durationSeconds: number;
  staticDurationSeconds: number;
  trafficDelaySeconds: number;
  polyline: string;
  bounds: Bounds;
}

export interface AlternateRoute extends ScoredRoute {
  scoreDelta: number;
}

export interface DifficultyResponse {
  primaryRoute: ScoredRoute;
  alternateRoutes: AlternateRoute[];
}

export interface DifficultyRequest {
  origin: string;
  destination: string;
  departureTime?: string;
  includeAlternates?: boolean;
}

export interface ScoringContext {
  highwayShare: number;
  avgMph: number;
  maxMph: number;
  maneuversPer10Mi: number;
  delayRatio: number;
  breakdown: ScoringBreakdown;
}
