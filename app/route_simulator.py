"""
Trail Elevation Profile & Foliage Gradient Route Simulator for CanopyCast.
Simulates bio-climatic conditions and TabPFN inferences across a multi-mile mountain hike.
"""

from typing import Dict, Any, List
from app.predictor import predictor
from app.telemetry import telemetry_recorder

class TrailRouteSimulator:
    def simulate_hike_route(
        self,
        trailhead_elev_ft: float = 1800.0,
        summit_elev_ft: float = 4200.0,
        total_distance_miles: float = 4.0,
        base_temp_f: float = 56.0,
        base_soil_temp_f: float = 52.0,
        days_since_rain: float = 2.0,
        week_of_year: int = 41,
        num_waypoints: int = 6
    ) -> Dict[str, Any]:
        """Simulates a hiking route elevation gradient and predicts conditions at each waypoint."""
        with telemetry_recorder.record_span(
            op="simulator.route_gradient",
            description="Trail Elevation Gradient Simulation",
            metadata={"trailhead": trailhead_elev_ft, "summit": summit_elev_ft, "distance": total_distance_miles}
        ) as span:

            waypoints = []
            elev_step = (summit_elev_ft - trailhead_elev_ft) / (num_waypoints - 1)
            dist_step = total_distance_miles / (num_waypoints - 1)

            peak_foliage_waypoint = None
            highest_foliage = -1
            flushing_species_zones = []

            for i in range(num_waypoints):
                dist = round(i * dist_step, 1)
                # Elevation curve (slight sigmoid incline)
                elev = round(trailhead_elev_ft + i * elev_step)
                # Standard environmental lapse rate (~3.3°F drop per 1,000 ft gain)
                elev_gain_k = (elev - trailhead_elev_ft) / 1000.0
                ambient_temp = round(base_temp_f - (elev_gain_k * 3.3), 1)
                soil_temp = round(base_soil_temp_f - (elev_gain_k * 2.8), 1)
                canopy_pct = max(30.0, min(90.0, round(85.0 - (i * 7.5), 1)))

                pred = predictor.predict_trail_conditions(
                    elevation_ft=float(elev),
                    week_of_year=week_of_year,
                    ambient_temp_f=ambient_temp,
                    soil_temp_f=soil_temp,
                    days_since_rain=days_since_rain,
                    canopy_cover_pct=canopy_pct,
                    slope_degrees=round(10.0 + i * 3.5, 1)
                )

                foliage = pred["foliage_peak_pct"]
                species = pred["fungi_flush_species"]

                if foliage > highest_foliage:
                    highest_foliage = foliage
                    peak_foliage_waypoint = {
                        "mile": dist,
                        "elevation_ft": elev,
                        "foliage_pct": foliage
                    }

                if species != "No Flush Detected":
                    flushing_species_zones.append({
                        "mile": dist,
                        "elevation_ft": elev,
                        "species": species,
                        "confidence": pred["fungi_confidence_pct"]
                    })

                waypoints.append({
                    "waypoint_index": i + 1,
                    "distance_miles": dist,
                    "elevation_ft": elev,
                    "ambient_temp_f": ambient_temp,
                    "soil_temp_f": soil_temp,
                    "canopy_cover_pct": canopy_pct,
                    "foliage_peak_pct": foliage,
                    "foliage_stage": pred["foliage_stage"],
                    "fungi_species": species,
                    "fungi_confidence_pct": pred["fungi_confidence_pct"],
                    "frost_risk": pred["frost_risk"]
                })

            span["waypoints_generated"] = len(waypoints)
            return {
                "route_overview": {
                    "total_distance_miles": total_distance_miles,
                    "elevation_gain_ft": round(summit_elev_ft - trailhead_elev_ft),
                    "trailhead_elevation_ft": trailhead_elev_ft,
                    "summit_elevation_ft": summit_elev_ft,
                    "peak_foliage_mile": peak_foliage_waypoint["mile"] if peak_foliage_waypoint else 0.0,
                    "peak_foliage_pct": highest_foliage,
                    "flush_zones_count": len(flushing_species_zones)
                },
                "waypoints": waypoints,
                "flushing_species_zones": flushing_species_zones
            }

route_simulator = TrailRouteSimulator()
