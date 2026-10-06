"""
GPX Trail Track Parser and Enriched Bio-Climate Exporter for CanopyCast.
Parses AllTrails, Garmin, and Strava GPX files to evaluate TabPFN foliage and fungi flushes along real trails.
Generates enriched GPX files with botanical waypoints for GPS watches and backcountry devices.
"""

import math
import xml.etree.ElementTree as ET
from typing import Dict, Any, List, Tuple
from app.predictor import predictor
from app.telemetry import telemetry_recorder

# Sample realistic GPX XML trails
SAMPLE_GPX_TRAILS = {
    "mt_hood_mirror_lake": {
        "name": "Mount Hood - Mirror Lake & Tom Dick Harry Ridge (OR)",
        "gpx_xml": """<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="CanopyCast" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>Mirror Lake &amp; Tom Dick Harry Ridge Trail</name></metadata>
  <trk>
    <name>Mirror Lake Climb</name>
    <trkseg>
      <trkpt lat="45.3052" lon="-121.7942"><ele>920.0</ele></trkpt>
      <trkpt lat="45.3031" lon="-121.7925"><ele>985.0</ele></trkpt>
      <trkpt lat="45.3015" lon="-121.7901"><ele>1060.0</ele></trkpt>
      <trkpt lat="45.2990" lon="-121.7880"><ele>1150.0</ele></trkpt>
      <trkpt lat="45.2965" lon="-121.7850"><ele>1230.0</ele></trkpt>
      <trkpt lat="45.2940" lon="-121.7820"><ele>1310.0</ele></trkpt>
      <trkpt lat="45.2915" lon="-121.7800"><ele>1420.0</ele></trkpt>
      <trkpt lat="45.2890" lon="-121.7770"><ele>1540.0</ele></trkpt>
    </trkseg>
  </trk>
</gpx>"""
    },
    "blue_ridge_craggy": {
        "name": "Blue Ridge Parkway - Craggy Pinnacle Trail (NC)",
        "gpx_xml": """<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="CanopyCast" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>Craggy Pinnacle Ridge Trail</name></metadata>
  <trk>
    <name>Craggy Pinnacle Climb</name>
    <trkseg>
      <trkpt lat="35.6980" lon="-82.3820"><ele>1580.0</ele></trkpt>
      <trkpt lat="35.6995" lon="-82.3805"><ele>1630.0</ele></trkpt>
      <trkpt lat="35.7010" lon="-82.3790"><ele>1685.0</ele></trkpt>
      <trkpt lat="35.7025" lon="-82.3775"><ele>1735.0</ele></trkpt>
      <trkpt lat="35.7040" lon="-82.3760"><ele>1795.0</ele></trkpt>
    </trkseg>
  </trk>
</gpx>"""
    }
}

class GpxTrailEngine:
    def parse_and_analyze_gpx(
        self,
        gpx_xml_string: str,
        base_ambient_temp_f: float = 54.0,
        base_soil_temp_f: float = 50.0,
        days_since_rain: float = 2.0,
        week_of_year: int = 41
    ) -> Dict[str, Any]:
        """Parses GPX XML and executes TabPFN predictions along the trail's actual GPS trackpoints."""
        with telemetry_recorder.record_span(
            op="gpx.track_analysis",
            description="GPX Trail Trackpoint & TabPFN Bio-Climate Evaluation",
            metadata={"xml_length": len(gpx_xml_string)}
        ) as span:

            # Strip namespaces for resilient parsing
            clean_xml = self._strip_xml_namespaces(gpx_xml_string)
            root = ET.fromstring(clean_xml)

            track_name = "Imported Trail Route"
            trk_elem = root.find(".//trk")
            if trk_elem is not None and trk_elem.find("name") is not None:
                track_name = trk_elem.find("name").text or track_name

            raw_points: List[Tuple[float, float, float]] = []
            for trkpt in root.findall(".//trkpt"):
                lat = float(trkpt.attrib.get("lat", 0.0))
                lon = float(trkpt.attrib.get("lon", 0.0))
                ele_elem = trkpt.find("ele")
                ele_meters = float(ele_elem.text) if ele_elem is not None and ele_elem.text else 0.0
                ele_feet = ele_meters * 3.28084
                raw_points.append((lat, lon, ele_feet))

            if not raw_points:
                # Also check route points (rtept)
                for rtept in root.findall(".//rtept"):
                    lat = float(rtept.attrib.get("lat", 0.0))
                    lon = float(rtept.attrib.get("lon", 0.0))
                    ele_elem = rtept.find("ele")
                    ele_meters = float(ele_elem.text) if ele_elem is not None and ele_elem.text else 0.0
                    raw_points.append((lat, lon, ele_meters * 3.28084))

            if not raw_points:
                raise ValueError("No valid GPS trackpoints (<trkpt>) found in the GPX file.")

            # Sample/downsample if points exceed 25 for fast edge inference
            sampled_points = self._sample_trackpoints(raw_points, target_count=10)

            # Compute cumulative distances in miles
            total_dist_miles = 0.0
            analyzed_waypoints = []
            min_elevation = float("inf")
            max_elevation = float("-inf")
            peak_foliage_point = None
            highest_foliage = -1
            fungi_waypoints = []

            for i, (lat, lon, elev_ft) in enumerate(sampled_points):
                if i > 0:
                    prev_lat, prev_lon, _ = sampled_points[i - 1]
                    leg_miles = self._haversine_distance_miles(prev_lat, prev_lon, lat, lon)
                    total_dist_miles += leg_miles

                min_elevation = min(min_elevation, elev_ft)
                max_elevation = max(max_elevation, elev_ft)

                # Standard thermal lapse rate (~3.3°F drop per 1,000 ft above baseline)
                elev_delta_k = (elev_ft - sampled_points[0][2]) / 1000.0
                ambient_temp = round(base_ambient_temp_f - (elev_delta_k * 3.3), 1)
                soil_temp = round(base_soil_temp_f - (elev_delta_k * 2.8), 1)
                canopy_pct = max(35.0, min(90.0, round(85.0 - (i * 4.0), 1)))

                pred = predictor.predict_trail_conditions(
                    elevation_ft=round(elev_ft, 0),
                    week_of_year=week_of_year,
                    ambient_temp_f=ambient_temp,
                    soil_temp_f=soil_temp,
                    days_since_rain=days_since_rain,
                    canopy_cover_pct=canopy_pct,
                    slope_degrees=14.0
                )

                foliage = pred["foliage_peak_pct"]
                species = pred["fungi_flush_species"]
                conf = pred["fungi_confidence_pct"]

                if foliage > highest_foliage:
                    highest_foliage = foliage
                    peak_foliage_point = {
                        "mile": round(total_dist_miles, 2),
                        "elevation_ft": round(elev_ft, 0),
                        "foliage_pct": foliage,
                        "lat": lat,
                        "lon": lon
                    }

                if species != "No Flush Detected":
                    fungi_waypoints.append({
                        "species": species,
                        "confidence": conf,
                        "mile": round(total_dist_miles, 2),
                        "elevation_ft": round(elev_ft, 0),
                        "lat": lat,
                        "lon": lon
                    })

                analyzed_waypoints.append({
                    "waypoint_index": i + 1,
                    "lat": round(lat, 5),
                    "lon": round(lon, 5),
                    "distance_miles": round(total_dist_miles, 2),
                    "elevation_ft": round(elev_ft, 0),
                    "ambient_temp_f": ambient_temp,
                    "soil_temp_f": soil_temp,
                    "foliage_peak_pct": foliage,
                    "foliage_stage": pred["foliage_stage"],
                    "fungi_species": species,
                    "fungi_confidence_pct": conf,
                    "frost_risk": pred["frost_risk"]
                })

            span["trackpoints_analyzed"] = len(analyzed_waypoints)
            return {
                "trail_name": track_name,
                "summary": {
                    "total_distance_miles": round(total_dist_miles, 2),
                    "min_elevation_ft": round(min_elevation, 0),
                    "max_elevation_ft": round(max_elevation, 0),
                    "elevation_gain_ft": round(max(0.0, max_elevation - min_elevation), 0),
                    "peak_foliage_point": peak_foliage_point,
                    "fungi_flushes_found": len(fungi_waypoints)
                },
                "waypoints": analyzed_waypoints,
                "fungi_waypoints": fungi_waypoints
            }

    def export_enriched_gpx(self, analysis_result: Dict[str, Any]) -> str:
        """Generates a downloadable GPX file embedded with bio-climate waypoint tags for GPS devices."""
        trail_name = analysis_result.get("trail_name", "CanopyCast Trail")
        waypoints = analysis_result.get("waypoints", [])
        fungi_wpts = analysis_result.get("fungi_waypoints", [])
        peak_foliage = analysis_result.get("summary", {}).get("peak_foliage_point")

        xml_lines = [
            '<?xml version="1.0" encoding="UTF-8"?>',
            '<gpx version="1.1" creator="CanopyCast (Hacktoberfest 2026)" xmlns="http://www.topografix.com/GPX/1/1">',
            f'  <metadata><name>{trail_name} - Bio-Climate Enriched</name></metadata>'
        ]

        # Add Fungi Waypoints
        for f in fungi_wpts:
            xml_lines.append(f'  <wpt lat="{f["lat"]}" lon="{f["lon"]}"><ele>{round(f["elevation_ft"] / 3.28084, 1)}</ele><name>🍄 {f["species"]} ({f["confidence"]}%)</name><desc>Predicted high-value fungi flush zone at Mile {f["mile"]} ({f["elevation_ft"]} ft).</desc><sym>Mushroom</sym></wpt>')

        # Add Peak Foliage Waypoint
        if peak_foliage:
            xml_lines.append(f'  <wpt lat="{peak_foliage["lat"]}" lon="{peak_foliage["lon"]}"><ele>{round(peak_foliage["elevation_ft"] / 3.28084, 1)}</ele><name>🍁 Peak Autumn Canopy ({peak_foliage["foliage_pct"]}%)</name><desc>Prime autumn foliage color saturation zone at Mile {peak_foliage["mile"]}.</desc><sym>Scenic Area</sym></wpt>')

        # Re-attach Track
        xml_lines.append('  <trk>')
        xml_lines.append(f'    <name>{trail_name}</name>')
        xml_lines.append('    <trkseg>')
        for wp in waypoints:
            ele_m = round(wp["elevation_ft"] / 3.28084, 1)
            xml_lines.append(f'      <trkpt lat="{wp["lat"]}" lon="{wp["lon"]}"><ele>{ele_m}</ele></trkpt>')
        xml_lines.append('    </trkseg>')
        xml_lines.append('  </trk>')
        xml_lines.append('</gpx>')

        return "\n".join(xml_lines)

    def _sample_trackpoints(self, points: List[Tuple[float, float, float]], target_count: int = 10) -> List[Tuple[float, float, float]]:
        if len(points) <= target_count:
            return points
        step = (len(points) - 1) / (target_count - 1)
        sampled = [points[int(round(i * step))] for i in range(target_count)]
        return sampled

    def _haversine_distance_miles(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        r = 3958.8 # Earth radius in miles
        phi1 = math.radians(lat1)
        phi2 = math.radians(lat2)
        dphi = math.radians(lat2 - lat1)
        dlambda = math.radians(lon2 - lon1)
        a = math.sin(dphi / 2.0)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2.0)**2
        c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
        return r * c

    def _strip_xml_namespaces(self, xml_string: str) -> str:
        import re
        return re.sub(r'\sxmlns(:\w+)?="[^"]+"', '', xml_string, count=0)

gpx_engine = GpxTrailEngine()
