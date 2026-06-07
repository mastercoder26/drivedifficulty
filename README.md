# Drive Difficulty — Backend

TypeScript Vercel API that scores driving routes on a calibrated 0–10 workload scale using Google Routes/Roads APIs, a hybrid deterministic + ML residual model, and optional Supabase feedback logging.

## Prerequisites

- Node.js 18+
- [Vercel CLI](https://vercel.com/docs/cli) (`npm i -g vercel`)
- Google Cloud project with billing enabled
- *(Optional)* Supabase project for prediction logging and retraining

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
cp ../.env.example ../.env.local
```

Set environment variables in `.env.local`:

```
GOOGLE_MAPS_API_KEY=your_key_here
ALLOWED_ORIGINS=*
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

Run the Supabase migration in `backend/supabase/migrations/001_predictions.sql` if using feedback logging.

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
    "includeAlternates": true,
    "hoursSlept": 7,
    "continuousDriveMinutes": 45
  }'
```

## Tests

```bash
cd backend
npm test
npm run build
```

Unit tests cover highway, urban, traffic, long-drive fatigue, merge clusters, and exchange-heavy routes.

## Deploy to Vercel

```bash
cd backend
vercel link
vercel env add GOOGLE_MAPS_API_KEY
vercel env add ALLOWED_ORIGINS
vercel env add SUPABASE_URL
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel deploy
```

Set the root directory to `backend/` in your Vercel project settings.

## API

### `POST /api/route/difficulty`

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `origin` | string | yes | Start address |
| `destination` | string | yes | End address |
| `departureTime` | string | no | RFC 3339 departure time for traffic-aware routing |
| `includeAlternates` | boolean | no | Request alternate routes |
| `hoursSlept` | number | no | Driver sleep hours (default 7) |
| `continuousDriveMinutes` | number | no | Prior continuous driving (default route duration) |

**Response highlights:**

- `score` — calibrated 0–10 difficulty
- `uncalibratedScore`, `breakdown`, `contributions`, `uncertainty`, `hotspots`
- `predictionId` — present when Supabase logging succeeds
- `requestFeedback` — active-learning prompt flag

### `POST /api/route/feedback`

Submit user feedback for a logged prediction:

```json
{
  "predictionId": "uuid",
  "userRating": 7,
  "alternateSelected": false
}
```

## Hybrid scoring model

Pipeline: **segments → features → base score + segment aggregation → fatigue → ML residual → isotonic calibration**.

| Component | Weight / role |
|-----------|----------------|
| Speed (S) | 30% of base score |
| Merges/interchanges (M) | 25% — includes exponential merge spacing |
| Turns/maneuvers (T) | 15% |
| Traffic (C) | 15% |
| Length/monotony (L) | 15% |
| Fatigue | duration, circadian, sleep, continuous drive |
| Segment aggregation | 55% mean + 25% P90 + 20% max local difficulty |
| ML residual | LightGBM ONNX correction (optional) |

| Score | Label |
|-------|-------|
| 0 – 2 | Very Easy |
| 2 – 4 | Easy |
| 4 – 6 | Moderate |
| 6 – 8 | Hard |
| 8 – 10 | Very Hard |

## ML retraining

```bash
pip install -r ml/requirements.txt
python ml/export_training_data.py   # requires Supabase
python ml/train.py --csv ml/training.csv
python ml/export_onnx.py --model ml/artifacts/residual.lgb --output backend/models/residual_v1.onnx
```

Weekly CI: `.github/workflows/retrain-model.yml`

## Project structure

```
backend/
├── api/route/
│   ├── difficulty.ts          # Score routes + log predictions
│   └── feedback.ts            # User feedback endpoint
├── src/scoring/
│   ├── index.ts               # Hybrid orchestrator
│   ├── segments.ts            # Segment extraction + local scoring
│   ├── features.ts            # Route feature vector
│   ├── baseScore.ts           # S/M/T/C/L base score
│   ├── mergeBurden.ts         # Merge cluster + spacing
│   ├── segmentAggregate.ts    # P90/max aggregation
│   ├── fatigue.ts             # Fatigue + raw score blend
│   ├── calibration.ts         # Isotonic calibration
│   ├── mlResidual.ts          # ONNX inference
│   ├── uncertainty.ts         # Confidence bands
│   ├── explain.ts             # Factor contributions + hotspots
│   └── activeLearning.ts      # Feedback prompt triggers
├── src/db/supabase.ts         # Prediction + feedback storage
├── supabase/migrations/       # Postgres schema
├── models/                    # ONNX artifacts
└── features.schema.json       # Shared feature schema
ml/                            # Python training pipeline
shared/features.schema.json    # Canonical feature order
ios/                           # SwiftUI client
```
