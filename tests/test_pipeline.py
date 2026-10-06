"""
Integration and Unit Tests for CanopyCast Bio-Climate Pipeline.
Verifies TabPFN tabular prediction, Gemma advisory synthesis, ElevenLabs audio, and Sentry telemetry.
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.predictor import predictor
from app.advisor import gemma_advisor
from app.audio import audio_engine
from app.telemetry import telemetry_recorder

client = TestClient(app)

def test_health_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "open_source_ai" in data

def test_presets_endpoint():
    response = client.get("/api/presets")
    assert response.status_code == 200
    presets = response.json()
    assert len(presets) >= 4
    assert any(p["id"] == "pnw_cascades" for p in presets)

def test_tabpfn_prediction_ranges():
    # Test high-elevation autumn scenario
    res = predictor.predict_trail_conditions(
        elevation_ft=4500,
        week_of_year=42,
        ambient_temp_f=44.0,
        soil_temp_f=42.0,
        days_since_rain=1.5,
        canopy_cover_pct=80.0
    )
    assert 0 <= res["foliage_peak_pct"] <= 100
    assert res["foliage_stage"] in [
        "Early Green / Minimal Change",
        "Moderate Color Transition",
        "Near Peak Foliage",
        "Peak Vibrant Autumn Canopy",
        "Past Peak / Leaf Drop"
    ]
    assert isinstance(res["fungi_flush_species"], str)
    assert 0 <= res["fungi_confidence_pct"] <= 100

def test_gemma_advisory_synthesis():
    pred = predictor.predict_trail_conditions(
        elevation_ft=3200,
        week_of_year=41,
        ambient_temp_f=52.0,
        soil_temp_f=49.0,
        days_since_rain=2.0,
        canopy_cover_pct=75.0
    )
    advisory = gemma_advisor.generate_advisory(pred, hiker_notes="Spotted orange clusters on oak log")
    assert "advisory_markdown" in advisory
    assert len(advisory["advisory_markdown"]) > 50
    assert "species_botanical_name" in advisory
    assert "lookalike_alert" in advisory

def test_audio_narration_dispatch():
    text = "**Canopy Dispatch - Peak Foliage** At 3000 feet, vibrant colors dominate the ridge."
    audio = audio_engine.synthesize_trail_dispatch(text)
    assert "spoken_text" in audio
    assert not any(symbol in audio["spoken_text"] for symbol in ["**", "##", "_"])
    assert "provider" in audio

def test_full_agent_dispatch_endpoint():
    payload = {
        "elevation_ft": 3200,
        "week_of_year": 41,
        "ambient_temp_f": 52.0,
        "soil_temp_f": 49.0,
        "days_since_rain": 2.0,
        "canopy_cover_pct": 75.0,
        "slope_degrees": 15.0,
        "hiker_notes": "Clear morning hike"
    }
    response = client.post("/api/dispatch", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "prediction" in data
    assert "advisory" in data
    assert "audio" in data
    assert "telemetry" in data
    assert data["telemetry"]["total_spans"] > 0
