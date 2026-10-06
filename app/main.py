"""
CanopyCast - Offline Bio-Climate Field Companion & Trail Foraging Oracle.
FastAPI Application serving TabPFN, Gemma, ElevenLabs, and Sentry agent telemetry.
"""

import os
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List

from app.predictor import predictor
from app.advisor import gemma_advisor
from app.audio import audio_engine
from app.telemetry import telemetry_recorder

app = FastAPI(
    title="CanopyCast Bio-Climate Field Companion",
    description="Open-Source AI Backcountry Agent built for Hacktoberfest 'Touch Grass'",
    version="1.0.0"
)

# Enable CORS for local testing & PWA deployment
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class TrailObservationRequest(BaseModel):
    elevation_ft: float = Field(2800, ge=0, le=14000, description="Elevation in feet")
    week_of_year: int = Field(41, ge=1, le=52, description="Current week of the year (35-46 is peak autumn)")
    ambient_temp_f: float = Field(52.0, ge=-20, le=115, description="Ambient air temperature in Fahrenheit")
    soil_temp_f: float = Field(48.5, ge=20, le=90, description="Soil temperature at 2-inch depth")
    days_since_rain: float = Field(2.5, ge=0, le=60, description="Days elapsed since significant rainfall")
    canopy_cover_pct: float = Field(75.0, ge=0, le=100, description="Tree canopy density percentage")
    slope_degrees: float = Field(18.0, ge=0, le=70, description="Slope inclination degrees")
    hiker_notes: Optional[str] = Field("", description="Field observations or camera notes from trail")

# Trail Preset Scenarios for quick evaluation
TRAIL_PRESETS = [
    {
        "id": "pnw_cascades",
        "name": "Cascade Rainforest (Mt. Hood, OR)",
        "elevation_ft": 3200,
        "week_of_year": 41,
        "ambient_temp_f": 51.0,
        "soil_temp_f": 49.0,
        "days_since_rain": 1.5,
        "canopy_cover_pct": 85.0,
        "slope_degrees": 22.0,
        "notes": "Moist conifer/maple floor with heavy moss beds along creek."
    },
    {
        "id": "appalachian_blueridge",
        "name": "Blue Ridge Parkway (Asheville, NC)",
        "elevation_ft": 4200,
        "week_of_year": 42,
        "ambient_temp_f": 46.0,
        "soil_temp_f": 44.0,
        "days_since_rain": 4.0,
        "canopy_cover_pct": 70.0,
        "slope_degrees": 15.0,
        "notes": "Hardwood oak-hickory ridge with red maples beginning vibrant turn."
    },
    {
        "id": "new_england_sugarloaf",
        "name": "Green Mountains (Vermont)",
        "elevation_ft": 1850,
        "week_of_year": 40,
        "ambient_temp_f": 54.0,
        "soil_temp_f": 50.0,
        "days_since_rain": 2.0,
        "canopy_cover_pct": 78.0,
        "slope_degrees": 12.0,
        "notes": "Classic sugar maple and yellow birch forest after light morning shower."
    },
    {
        "id": "colorado_rockies",
        "name": "San Juan Aspen Groves (Ouray, CO)",
        "elevation_ft": 8900,
        "week_of_year": 38,
        "ambient_temp_f": 41.0,
        "soil_temp_f": 38.0,
        "days_since_rain": 6.0,
        "canopy_cover_pct": 45.0,
        "slope_degrees": 28.0,
        "notes": "High alpine golden aspen belt with early chill frost warnings."
    }
]

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "app": "CanopyCast Bio-Climate Field Companion",
        "open_source_ai": {
            "tabular_foundation": predictor.use_native_tabpfn,
            "tabpfn_status": "Native Prior Labs Weights" if predictor.use_native_tabpfn else "Edge Backcountry Surrogate",
            "gemma_advisor": gemma_advisor.client_type,
            "elevenlabs_configured": bool(audio_engine.api_key),
            "sentry_tracing_enabled": bool(os.getenv("SENTRY_DSN"))
        }
    }

@app.get("/api/presets")
def get_trail_presets():
    return TRAIL_PRESETS

@app.post("/api/predict")
def predict_conditions(req: TrailObservationRequest):
    return predictor.predict_trail_conditions(
        elevation_ft=req.elevation_ft,
        week_of_year=req.week_of_year,
        ambient_temp_f=req.ambient_temp_f,
        soil_temp_f=req.soil_temp_f,
        days_since_rain=req.days_since_rain,
        canopy_cover_pct=req.canopy_cover_pct,
        slope_degrees=req.slope_degrees
    )

@app.post("/api/dispatch")
def generate_full_trail_dispatch(req: TrailObservationRequest):
    """Executes the complete open-source agent pipeline and returns telemetry."""
    # 1. TabPFN tabular prediction
    pred = predictor.predict_trail_conditions(
        elevation_ft=req.elevation_ft,
        week_of_year=req.week_of_year,
        ambient_temp_f=req.ambient_temp_f,
        soil_temp_f=req.soil_temp_f,
        days_since_rain=req.days_since_rain,
        canopy_cover_pct=req.canopy_cover_pct,
        slope_degrees=req.slope_degrees
    )

    # 2. Gemma botanical advisory
    advisory = gemma_advisor.generate_advisory(pred, hiker_notes=req.hiker_notes or "")

    # 3. ElevenLabs eyes-up audio narration
    audio_dispatch = audio_engine.synthesize_trail_dispatch(advisory["advisory_markdown"])

    # 4. Telemetry spans
    recent_traces = telemetry_recorder.get_latest_traces(limit=3)

    return {
        "prediction": pred,
        "advisory": advisory,
        "audio": audio_dispatch,
        "telemetry": {
            "traces": recent_traces,
            "total_spans": len(recent_traces),
            "total_latency_ms": sum(t.get("duration_ms", 0) for t in recent_traces)
        }
    }

@app.get("/api/telemetry")
def get_telemetry():
    return {
        "traces": telemetry_recorder.get_latest_traces(limit=15)
    }

# Mount static frontend
static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.exists(static_dir):
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
