# Drive Difficulty — Backend

TypeScript Vercel API that scores driving routes on a 0–10 difficulty scale using Google Routes and Roads APIs.

## Prerequisites

- Node.js 18+
- [Vercel CLI](https://vercel.com/docs/cli) (`npm i -g vercel`)
- Google Cloud project with billing enabled

## Google Cloud Setup

1. Create a project in [Google Cloud Console](https://console.cloud.google.com/).
2. Enable APIs:
   - **Routes API** (`routes.googleapis.com`)
   - **Roads API** (`roads.googleapis.com`)
3. Create an API key under **APIs & Services → Credentials**.
4. Restrict the key:
   - **API restrictions:** Routes API, Roads API
   - **Application restrictions:** IP addresses (Vercel) or none for local dev
5. *(Optional)* Enable the **Roads Speed Limits** SKU for posted speed limits. Without it, the API falls back to implied speeds from route step durations.

## Local Development

```bash
cd backend
npm install
cp ../.env.example ../.env.local   # or backend/.env.local
```

Set environment variables in `.env.local`:

```
GOOGLE_MAPS_API_KEY=your_key_here
ALLOWED_ORIGINS=*
```

Run the dev server:

```bash
npm run dev
```

The API is available at `http://localhost:3000/api/route/difficulty`.

### Example request

```bash
curl -X POST http://localhost:3000/api/route/difficulty \
  -H "Content-Type: application/json" \
  -d '{
    "origin": "Austin, TX",
    "destination": "Dallas, TX",
    "departureTime": "2026-06-06T17:30:00Z",
    "includeAlternates": true
  }'
```

## Tests

```bash
cd backend
npm test
```

Unit tests cover the scoring engine with fixtures for highway, urban, and traffic scenarios.

## Deploy to Vercel

```bash
cd backend
vercel link          # link to a Vercel project
vercel env add GOOGLE_MAPS_API_KEY
vercel env add ALLOWED_ORIGINS
vercel deploy
```

Set the root directory to `backend/` in your Vercel project settings, or deploy from the `backend` folder.

Production URL: `https://<your-project>.vercel.app/api/route/difficulty`

## API

### `POST /api/route/difficulty`

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `origin` | string | yes | Start address |
| `destination` | string | yes | End address |
| `departureTime` | string | no | RFC 3339 departure time for traffic-aware routing |
| `includeAlternates` | boolean | no | Request up to 3 alternate routes |

**Response:**

```json
{
  "primaryRoute": {
    "score": 4.2,
    "label": "Easy",
    "reasons": ["Mostly highway", "Light traffic"],
    "breakdown": { "highway": 0.18, "speed": 0.42, "maneuvers": 0.31, "traffic": 0.12 },
    "distanceMeters": 312000,
    "durationSeconds": 10800,
    "staticDurationSeconds": 9900,
    "trafficDelaySeconds": 900,
    "polyline": "encoded...",
    "bounds": { "southwest": { "lat": 30.2, "lng": -97.8 }, "northeast": { "lat": 32.8, "lng": -96.8 } }
  },
  "alternateRoutes": [
    { "...": "same shape", "scoreDelta": -0.5 }
  ]
}
```

### Scoring model

| Factor | Weight | Range |
|--------|--------|-------|
| Non-highway complexity | 35% | 0–1 |
| Speed intensity | 30% | 0–1 |
| Maneuver density | 20% | 0–1 |
| Traffic stress | 15% | 0–1 |

Final score = weighted sum × 10 (one decimal).

| Score | Label |
|-------|-------|
| 0 – 2 | Very Easy |
| 2 – 4 | Easy |
| 4 – 6 | Moderate |
| 6 – 8 | Hard |
| 8 – 10 | Very Hard |

## Project structure

```
backend/
├── api/route/difficulty.ts    # Vercel serverless handler
├── src/
│   ├── google/
│   │   ├── routes.ts          # Google Routes computeRoutes client
│   │   └── roads.ts           # snapToRoads + speedLimits
│   ├── scoring/
│   │   ├── index.ts           # Scoring orchestrator
│   │   ├── highway.ts         # Highway share heuristics
│   │   ├── speed.ts           # Speed intensity
│   │   ├── maneuvers.ts       # Maneuver complexity
│   │   ├── traffic.ts         # Traffic stress
│   │   ├── reasons.ts         # Human-readable reasons
│   │   ├── labels.ts          # Score → label mapping
│   │   └── smoothstep.ts      # Normalization helper
│   ├── utils/
│   │   ├── polyline.ts        # Decode + sample polylines
│   │   └── duration.ts        # Parse protobuf durations
│   └── types.ts
├── vercel.json
└── package.json
```
