"""
Integration and Unit Tests for CanopyCast Bio-Climate Pipeline.
Verifies TabPFN tabular prediction, Gemma advisory, ElevenLabs audio, Sentry telemetry,
Lookalike database, Route elevation simulation, and TabPFN benchmark suite.
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.predictor import predictor
from app.advisor import gemma_advisor
from app.audio import audio_engine
from app.telemetry import telemetry_recorder
from app.lookalikes import get_lookalike_guide
from app.benchmark import benchmark_suite
from app.route_simulator import route_simulator

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

def test_pwa_offline_routes():
    res_manifest = client.get("/manifest.json")
    assert res_manifest.status_code == 200
    assert "CanopyCast" in res_manifest.text

    res_sw = client.get("/sw.js")
    assert res_sw.status_code == 200
    assert "canopycast-offline" in res_sw.text

def test_benchmark_endpoint():
    response = client.get("/api/benchmark")
    assert response.status_code == 200
    data = response.json()
    assert "models" in data
    assert len(data["models"]) >= 3
    assert any("TabPFN" in m["model"] for m in data["models"])

def test_lookalike_endpoint():
    response = client.get("/api/lookalike/Golden%20Chanterelle")
    assert response.status_code == 200
    data = response.json()
    assert "toxic_lookalike" in data
    assert "Jack O'Lantern" in data["toxic_lookalike"]
    assert len(data["diagnostic_traits"]) >= 3

def test_route_simulation_endpoint():
    payload = {
        "trailhead_elev_ft": 1500.0,
        "summit_elev_ft": 4000.0,
        "total_distance_miles": 3.5,
        "base_temp_f": 58.0,
        "base_soil_temp_f": 54.0,
        "days_since_rain": 2.0,
        "week_of_year": 41,
        "num_waypoints": 5
    }
    response = client.post("/api/route-simulation", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "route_overview" in data
    assert len(data["waypoints"]) == 5
    assert data["waypoints"][0]["elevation_ft"] == 1500.0
    assert data["waypoints"][-1]["elevation_ft"] == 4000.0

def test_gpx_endpoints():
    # 1. Test sample GPX list
    r_samples = client.get("/api/gpx/samples")
    assert r_samples.status_code == 200
    samples = r_samples.json()
    assert len(samples) >= 2
    assert "mt_hood_mirror_lake" in [s["id"] for s in samples]

    # 2. Test GPX analyze endpoint
    hood_xml = samples[0]["gpx_xml"]
    r_analyze = client.post("/api/gpx/analyze", json={
        "gpx_xml": hood_xml,
        "base_ambient_temp_f": 52.0,
        "base_soil_temp_f": 49.0,
        "days_since_rain": 2.0,
        "week_of_year": 41
    })
    assert r_analyze.status_code == 200
    analysis = r_analyze.json()
    assert "summary" in analysis
    assert "waypoints" in analysis
    assert analysis["summary"]["total_distance_miles"] > 0
    assert len(analysis["waypoints"]) >= 5

    # 3. Test GPX export endpoint
    r_export = client.post("/api/gpx/export", json=analysis)
    assert r_export.status_code == 200
    assert "application/gpx+xml" in r_export.headers.get("content-type", "")
    assert "<gpx" in r_export.text
    assert "</gpx>" in r_export.text


def test_tabpfn_prediction_ranges():
    res = predictor.predict_trail_conditions(
        elevation_ft=4500,
        week_of_year=42,
        ambient_temp_f=44.0,
        soil_temp_f=42.0,
        days_since_rain=1.5,
        canopy_cover_pct=80.0
    )
    assert 0 <= res["foliage_peak_pct"] <= 100
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

def test_audio_narration_dispatch():
    text = "**Canopy Dispatch - Peak Foliage** At 3000 feet, vibrant colors dominate the ridge."
    audio = audio_engine.synthesize_trail_dispatch(text)
    assert "spoken_text" in audio
    assert not any(symbol in audio["spoken_text"] for symbol in ["**", "##", "_"])

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
    assert "lookalike" in data
    assert "audio" in data
    assert "telemetry" in data
    assert data["telemetry"]["total_spans"] > 0
