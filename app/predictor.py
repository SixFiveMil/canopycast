"""
TabPFN Bio-Climatic Foundation Engine for CanopyCast.
Predicts fall foliage peak status, high-value mushroom flush likelihood, and microclimate frost risk.
Supports Prior Labs' TabPFN with seamless offline backcountry fallback.
"""

import os
import pandas as pd
import numpy as np
from typing import Dict, Any, Tuple
from app.datasets.data_loader import load_dataset
from app.telemetry import telemetry_recorder

# Check for TabPFN token
TABPFN_TOKEN = os.getenv("TABPFN_TOKEN", "")

class BioClimatePredictor:
    def __init__(self):
        self.data = load_dataset()
        self.use_native_tabpfn = False
        self.tabpfn_regressor = None
        self.tabpfn_classifier = None
        self.fallback_regressor = None
        self.fallback_classifier = None
        self._initialize_models()

    def _initialize_models(self):
        """Initializes TabPFN models, falling back to local ensemble if token is unconfigured or offline."""
        features_reg = ["elevation_ft", "week_of_year", "ambient_temp_f", "days_since_rain", "canopy_cover_pct"]
        features_clf = ["elevation_ft", "soil_temp_f", "days_since_rain", "canopy_cover_pct", "ambient_temp_f"]
        
        X_reg = self.data[features_reg].values
        y_reg = self.data["foliage_peak_pct"].values

        X_clf = self.data[features_clf].values
        y_clf = self.data["fungi_flush_species"].values

        # Try initializing native TabPFN if token exists
        if TABPFN_TOKEN:
            try:
                from tabpfn import TabPFNClassifier, TabPFNRegressor
                os.environ["TABPFN_TOKEN"] = TABPFN_TOKEN
                self.tabpfn_regressor = TabPFNRegressor(device="cpu")
                # Subsample up to 250 rows for optimal TabPFN prompt context
                idx = np.random.choice(len(X_reg), min(250, len(X_reg)), replace=False)
                self.tabpfn_regressor.fit(X_reg[idx], y_reg[idx])
                
                self.tabpfn_classifier = TabPFNClassifier(device="cpu")
                self.tabpfn_classifier.fit(X_clf[idx], y_clf[idx])
                self.use_native_tabpfn = True
                print("TabPFN Foundation Model successfully initialized and fitted.")
            except Exception as e:
                print(f"TabPFN init exception: {e}. Falling back to edge surrogate.")
                self.use_native_tabpfn = False

        # Always train fallback local models for instantaneous edge inference and zero-connectivity trail mode
        from sklearn.ensemble import GradientBoostingRegressor, RandomForestClassifier
        self.fallback_regressor = GradientBoostingRegressor(n_estimators=100, random_state=42)
        self.fallback_regressor.fit(X_reg, y_reg)

        self.fallback_classifier = RandomForestClassifier(n_estimators=100, random_state=42)
        self.fallback_classifier.fit(X_clf, y_clf)

    def predict_trail_conditions(
        self,
        elevation_ft: float,
        week_of_year: int,
        ambient_temp_f: float,
        soil_temp_f: float,
        days_since_rain: float,
        canopy_cover_pct: float,
        slope_degrees: float = 15.0
    ) -> Dict[str, Any]:
        """Runs tabular inference for foliage color peak and fungi flush probability."""
        features_reg = np.array([[elevation_ft, week_of_year, ambient_temp_f, days_since_rain, canopy_cover_pct]])
        features_clf = np.array([[elevation_ft, soil_temp_f, days_since_rain, canopy_cover_pct, ambient_temp_f]])

        with telemetry_recorder.record_span(
            op="tabpfn.bio_prediction",
            description="Tabular Bio-Climate Inference",
            metadata={"elevation": elevation_ft, "native_tabpfn": self.use_native_tabpfn}
        ) as span:
            
            if self.use_native_tabpfn and self.tabpfn_regressor and self.tabpfn_classifier:
                foliage_pred = float(self.tabpfn_regressor.predict(features_reg)[0])
                fungi_pred = str(self.tabpfn_classifier.predict(features_clf)[0])
                try:
                    # Probabilities if available
                    probs = self.tabpfn_classifier.predict_proba(features_clf)[0]
                    confidence = float(np.max(probs))
                except Exception:
                    confidence = 0.88
                engine_name = "TabPFN Foundation Model (Prior Labs)"
            else:
                foliage_pred = float(self.fallback_regressor.predict(features_reg)[0])
                fungi_pred = str(self.fallback_classifier.predict(features_clf)[0])
                probs = self.fallback_classifier.predict_proba(features_clf)[0]
                confidence = float(np.max(probs))
                engine_name = "TabPFN Edge Surrogate (Offline Backcountry Mode)"

            # Clamp foliage to 0 - 100%
            foliage_pct = round(max(0.0, min(100.0, foliage_pred)), 1)
            
            # Frost Risk calculation
            if ambient_temp_f <= 32:
                frost_risk = "Severe (Sub-Freezing Frost Hazard)"
            elif ambient_temp_f <= 38:
                frost_risk = "Moderate (Ground Frost Expected)"
            elif ambient_temp_f <= 44:
                frost_risk = "Low (Borderline Chill)"
            else:
                frost_risk = "None (Mild Trail Conditions)"

            result = {
                "engine": engine_name,
                "is_native_tabpfn": self.use_native_tabpfn,
                "foliage_peak_pct": foliage_pct,
                "foliage_stage": self._categorize_foliage(foliage_pct),
                "fungi_flush_species": fungi_pred,
                "fungi_confidence_pct": round(confidence * 100, 1),
                "frost_risk": frost_risk,
                "inputs": {
                    "elevation_ft": elevation_ft,
                    "week_of_year": week_of_year,
                    "ambient_temp_f": ambient_temp_f,
                    "soil_temp_f": soil_temp_f,
                    "days_since_rain": days_since_rain,
                    "canopy_cover_pct": canopy_cover_pct,
                    "slope_degrees": slope_degrees
                }
            }
            span["result_summary"] = f"Foliage: {foliage_pct}%, Species: {fungi_pred}"
            return result

    def _categorize_foliage(self, pct: float) -> str:
        if pct < 20:
            return "Early Green / Minimal Change"
        elif pct < 50:
            return "Moderate Color Transition"
        elif pct < 85:
            return "Near Peak Foliage"
        elif pct <= 100:
            return "Peak Vibrant Autumn Canopy"
        return "Past Peak / Leaf Drop"

# Global singleton
predictor = BioClimatePredictor()
