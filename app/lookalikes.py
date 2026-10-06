"""
Botanical Lookalike Identification Engine for CanopyCast.
Provides clear, side-by-side diagnostic checklists between edible target species and toxic lookalikes.
"""

from typing import Dict, Any, List

LOOKALIKE_DATABASE = {
    "Golden Chanterelle": {
        "target_species": "Golden Chanterelle (Cantharellus cibarius)",
        "edibility": "Choice Edible",
        "toxic_lookalike": "Jack O'Lantern (Omphalotus illudens)",
        "toxicity_level": "Severe Gastrointestinal Toxin",
        "diagnostic_traits": [
            {
                "feature": "Underside Structure",
                "target": "False blunt ridges (forked, decurrent wrinkles continuous with stem)",
                "toxic": "True sharp knife-like gills (crowded, non-forked, distinct from stem)"
            },
            {
                "feature": "Growth Substrate",
                "target": "Single or scattered on soil/moss mycorrhizal with hardwoods/conifers",
                "toxic": "Dense clusters directly attached to decaying wood, tree roots, or buried stumps"
            },
            {
                "feature": "Interior Flesh",
                "target": "Solid, white or pale cream interior (like string cheese)",
                "toxic": "Orange or yellowish interior matching cap color"
            },
            {
                "feature": "Aroma & Bioluminescence",
                "target": "Faint sweet apricot aroma; non-bioluminescent",
                "toxic": "Pungent earthy mushroom smell; gills glow faint green in pitch darkness"
            }
        ],
        "secondary_lookalike": "False Chanterelle (Hygrophoropsis aurantiaca) - Thin orange true gills, cottony stipe, mild toxin/inedible."
    },
    "Lion's Mane": {
        "target_species": "Lion's Mane (Hericium erinaceus)",
        "edibility": "Choice Edible & Medicinal",
        "toxic_lookalike": "No Deadly Lookalikes in North America",
        "toxicity_level": "Safe Genus (All North American Hericium species are edible)",
        "diagnostic_traits": [
            {
                "feature": "Hanging Spines",
                "target": "Long unbranched hanging white 'icicle' teeth (1-5 cm long)",
                "toxic": "N/A - Non-toxic genus"
            },
            {
                "feature": "Color & Freshness",
                "target": "Pure ivory to creamy white; spongy and succulent",
                "toxic": "Yellowed or brown specimens indicate bacterial decay or old age (bitter/spoilage)"
            },
            {
                "feature": "Related Species",
                "target": "Hericium erinaceus (single compact cluster of long spines)",
                "toxic": "Bear's Head Tooth (Hericium americanum - branched spine branches; also edible)"
            }
        ],
        "secondary_lookalike": "Coral tooth fungus (Hericium coralloides) - Branched coral-like structure, also choice edible."
    },
    "Chicken of the Woods": {
        "target_species": "Chicken of the Woods (Laetiporus sulphureus)",
        "edibility": "Choice Edible (Hardwood variants)",
        "toxic_lookalike": "Conifer-dwelling Laetiporus (Laetiporus conifericola / huroniensis)",
        "toxicity_level": "Gastrointestinal Irritant (when grown on conifers)",
        "diagnostic_traits": [
            {
                "feature": "Tree Host",
                "target": "Deciduous hardwoods (Oak, Beech, Maple, Cherry)",
                "toxic": "Coniferous trees (Hemlock, Pine, Fir, Spruce) absorbs toxic tree resins"
            },
            {
                "feature": "Pore Surface",
                "target": "Bright sulfur-yellow tiny pores (no gills whatsoever)",
                "toxic": "Jack O'Lantern has orange gills and stem (not shelf polypore)"
            },
            {
                "feature": "Shelf Margin",
                "target": "Tender, succulent wavy bright orange outer rim that exudes water when squeezed",
                "toxic": "Hard chalky brackets (Ganoderma or Phellinus - fibrous and inedible)"
            }
        ],
        "secondary_lookalike": "Velvet-Top Fungus (Phaeolus schweinitzii) - Dark brown/greenish, dye mushroom, tough and inedible."
    },
    "King Bolete (Porcini)": {
        "target_species": "King Bolete / Porcini (Boletus edulis)",
        "edibility": "Choice Edible",
        "toxic_lookalike": "Bitter Bolete (Tylopilus felleus) & Red-Pored Boletes (Rubroboletus)",
        "toxicity_level": "Extreme Bitterness (Tylopilus) / Severe Toxin (Rubroboletus satanas)",
        "diagnostic_traits": [
            {
                "feature": "Stipe Reticulation",
                "target": "White raised netting/reticulum on top half of chubby stem",
                "toxic": "Dark brown/black prominent netting on stipe (Tylopilus felleus)"
            },
            {
                "feature": "Pore Color & Bruising",
                "target": "White in youth, turning olive-yellow. NEVER bruises blue or brown",
                "toxic": "Pores that bruise dark blue, or have bright red/orange mouth openings"
            },
            {
                "feature": "Taste Test",
                "target": "Sweet, nutty, mushroom aroma",
                "toxic": "Overwhelmingly bitter (tiny nibble test on cap tip and spit out)"
            }
        ],
        "secondary_lookalike": "Satan's Bolete (Rubroboletus satanas) - Ghostly white cap with blood-red pores that bruise blue (poisonous)."
    },
    "Maitake (Hen of the Woods)": {
        "target_species": "Maitake / Hen of the Woods (Grifola frondosa)",
        "edibility": "Choice Edible",
        "toxic_lookalike": "Black-Staining Polypore (Meripilus sumstinei)",
        "toxicity_level": "Non-Toxic Lookalike (Tough / Low Culinary Value)",
        "diagnostic_traits": [
            {
                "feature": "Bruising Reaction",
                "target": "Flesh remains pale gray/tan; does NOT stain black upon handling",
                "toxic": "Bruises intensely dark black within 15-30 minutes of handling"
            },
            {
                "feature": "Frond Structure",
                "target": "Numerous small spoon-shaped overlapping fronds (2-7 cm wide)",
                "toxic": "Much larger, thicker fan-shaped brackets (up to 20 cm wide)"
            },
            {
                "feature": "Base Location",
                "target": "Clustered at the root base of mature oak trees in autumn",
                "toxic": "Grows around hardwood stumps or roots in summer and early autumn"
            }
        ],
        "secondary_lookalike": "Berkeley's Polypore (Bondarzewia berkeleyi) - Very large cream-colored shelves, fibrous and tasteless."
    }
}

def get_lookalike_guide(species_name: str) -> Dict[str, Any]:
    """Retrieves detailed lookalike safety comparisons for a species."""
    return LOOKALIKE_DATABASE.get(species_name, {
        "target_species": species_name,
        "edibility": "General Fungal Scouting",
        "toxic_lookalike": "Varied Local Species",
        "toxicity_level": "Observation Only",
        "diagnostic_traits": [
            {
                "feature": "Field Observation Rule",
                "target": "Always cross-reference multiple field identifiers before considering harvest.",
                "toxic": "Never consume any wild mushroom without spore print and expert verification."
            }
        ],
        "secondary_lookalike": "Consult regional mycological field guides."
    })
