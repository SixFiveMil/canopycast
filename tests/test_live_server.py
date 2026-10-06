import urllib.request
import json

base_url = 'http://localhost:8000'

def request_endpoint(method, path, data=None):
    url = f'{base_url}{path}'
    req = urllib.request.Request(url, method=method)

    if data:
        req.data = json.dumps(data).encode('utf-8')
        req.add_header('Content-Type', 'application/json')
    try:
        with urllib.request.urlopen(req) as resp:
            content = resp.read()
            print(f"[PASS] {method} {path} -> {resp.status} (Length: {len(content)})")
            try:
                return json.loads(content.decode('utf-8'))
            except Exception:
                return content.decode('utf-8')
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode('utf-8', errors='ignore')
        print(f"[FAIL] {method} {path} -> {e.code}: {err_msg}")
        return None
    except Exception as e:
        print(f"[FAIL] {method} {path} -> Error: {e}")
        return None

if __name__ == "__main__":
    print("--- RUNNING LIVE SERVER TEST SUITE ---")
    request_endpoint('GET', '/')
    request_endpoint('GET', '/styles.css')
    request_endpoint('GET', '/app.js')
    presets = request_endpoint('GET', '/api/presets')

    if presets:
        for p in presets:
            print(f"\nTesting preset: {p['name']}")
            payload = {
                'elevation_ft': p['elevation_ft'],
                'week_of_year': p['week_of_year'],
                'ambient_temp_f': p['ambient_temp_f'],
                'soil_temp_f': p['soil_temp_f'],
                'days_since_rain': p['days_since_rain'],
                'canopy_cover_pct': p['canopy_cover_pct'],
                'slope_degrees': p['slope_degrees'],
                'hiker_notes': p.get('notes', '')
            }
            res = request_endpoint('POST', '/api/dispatch', payload)
            if res:
                print(f"  -> Foliage: {res['prediction']['foliage_peak_pct']}% ({res['prediction']['foliage_stage']})")
                print(f"  -> Species: {res['prediction']['fungi_flush_species']} ({res['prediction']['fungi_confidence_pct']}%)")
                print(f"  -> Frost: {res['prediction']['frost_risk']}")
                print(f"  -> Traces: {len(res['telemetry']['traces'])} spans ({res['telemetry']['total_latency_ms']}ms)")

    print("\n--- NEW FEATURES TESTING ---")
    request_endpoint('GET', '/api/benchmark')
    request_endpoint('GET', '/api/lookalike/Golden%20Chanterelle')
    request_endpoint('POST', '/api/route-simulation', {
        'trailhead_elev_ft': 1800.0,
        'summit_elev_ft': 4200.0,
        'total_distance_miles': 4.0,
        'base_temp_f': 56.0,
        'base_soil_temp_f': 52.0,
        'days_since_rain': 2.0,
        'week_of_year': 41,
        'num_waypoints': 6
    })

    print("\n--- GPX ENDPOINTS TESTING ---")
    gpx_samples = request_endpoint('GET', '/api/gpx/samples')
    if gpx_samples:
        hood_xml = gpx_samples[0]['gpx_xml']
        gpx_res = request_endpoint('POST', '/api/gpx/analyze', {
            'gpx_xml': hood_xml,
            'base_ambient_temp_f': 52.0,
            'base_soil_temp_f': 49.0,
            'days_since_rain': 2.0,
            'week_of_year': 41
        })
        if gpx_res:
            print(f"  -> Analyzed GPX: {gpx_res['trail_name']} ({gpx_res['summary']['total_distance_miles']} mi)")
            print(f"  -> Flushes found: {gpx_res['summary']['fungi_flushes_found']} zones")
            request_endpoint('POST', '/api/gpx/export', gpx_res)

    print("\n--- BOUNDARY / ERROR TESTING ---")

    # Test invalid json
    request_endpoint('POST', '/api/predict', {'elevation_ft': -500})
    request_endpoint('POST', '/api/predict', {'elevation_ft': 'invalid_string'})
    request_endpoint('GET', '/api/telemetry')


