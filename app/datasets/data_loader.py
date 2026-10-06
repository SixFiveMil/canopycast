"""
Data generator and loader for CanopyCast Bio-Climatic Trail Data.
Simulates historical USDA Forest Service & USGS microclimate trail logs for autumn foraging and foliage tracking.
"""

import os
import pandas as pd
import numpy as np

DATASET_PATH = os.path.join(os.path.dirname(__file__), "trail_climate_history.csv")

def generate_trail_dataset(num_samples: int = 500, save_path: str = DATASET_PATH) -> pd.DataFrame:
    """Generates a realistic historical bio-climate dataset for autumn trail conditions."""
    np.random.seed(42)
    
    # Features
    elevation = np.random.uniform(500, 5200, num_samples) # ft
    week = np.random.randint(35, 48, num_samples) # Autumn weeks (Late August to late November)
    days_since_rain = np.random.exponential(3.5, num_samples).clip(0, 21)
    canopy_cover = np.random.uniform(20, 95, num_samples) # percent
    soil_temp = (70 - (elevation / 1000) * 3.5 - (week - 35) * 1.8 + np.random.normal(0, 2.5, num_samples)).clip(32, 75)
    ambient_temp = (soil_temp + np.random.normal(3, 4, num_samples)).clip(28, 82)
    slope = np.random.uniform(0, 45, num_samples) # degrees
    
    # Target 1: Foliage Peak Percentage (0 - 100)
    # Higher elevation and later weeks peak earlier
    foliage_signal = (
        ((week - 35) * 11) + 
        ((elevation - 500) / 1000 * 9) - 
        (days_since_rain * 0.8) +
        np.random.normal(0, 5, num_samples)
    )
    # Peak curve (bell shape centered around optimal index)
    foliage_peak = np.clip(100 - np.abs(foliage_signal - 60) * 1.6, 0, 100).round(1)
    
    # Target 2: Fungi Flush Probability / Species
    # Fungi requires recent rain (low days_since_rain) and moderate soil temp (45-62°F)
    fungi_species = []
    for elev, st, rain, cnp in zip(elevation, soil_temp, days_since_rain, canopy_cover):
        if rain > 8 or st < 40 or st > 68:
            fungi_species.append("No Flush Detected")
        elif rain <= 3 and 48 <= st <= 58 and cnp > 60 and elev > 2500:
            fungi_species.append("Golden Chanterelle")
        elif rain <= 4 and 45 <= st <= 55 and cnp > 50 and elev < 2500:
            fungi_species.append("Lion's Mane")
        elif rain <= 3 and 52 <= st <= 65 and cnp > 40:
            fungi_species.append("Chicken of the Woods")
        elif rain <= 5 and 42 <= st <= 52 and elev > 3000:
            fungi_species.append("King Bolete (Porcini)")
        elif rain <= 4 and 46 <= st <= 56 and cnp > 65:
            fungi_species.append("Maitake (Hen of the Woods)")
        else:
            fungi_species.append("No Flush Detected")
            
    # Target 3: Frost Risk Index (None, Low, Moderate, Severe)
    frost_risk = []
    for amb, elev, wk in zip(ambient_temp, elevation, week):
        if amb > 45:
            frost_risk.append("Zero Frost")
        elif 38 < amb <= 45:
            frost_risk.append("Low")
        elif 32 < amb <= 38:
            frost_risk.append("Moderate")
        else:
            frost_risk.append("Severe")


    df = pd.DataFrame({
        "elevation_ft": elevation.round(0),
        "week_of_year": week,
        "ambient_temp_f": ambient_temp.round(1),
        "soil_temp_f": soil_temp.round(1),
        "days_since_rain": days_since_rain.round(1),
        "canopy_cover_pct": canopy_cover.round(1),
        "slope_degrees": slope.round(1),
        "foliage_peak_pct": foliage_peak,
        "fungi_flush_species": fungi_species,
        "frost_risk": frost_risk
    })
    
    os.makedirs(os.path.dirname(save_path), exist_ok=True)
    df.to_csv(save_path, index=False)
    return df

def load_dataset(path: str = DATASET_PATH) -> pd.DataFrame:
    """Loads dataset or generates it if not present."""
    if not os.path.exists(path):
        return generate_trail_dataset(500, path)
    return pd.read_csv(path)

if __name__ == "__main__":
    df = generate_trail_dataset()
    print(f"Generated {len(df)} historical trail records.")
    print(df.head(5))
