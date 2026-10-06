# NASA Data Catalog

## Overview

All datasets target **Jezero Crater region**. Crater center is approximately 18.44° N, 77.45° E. The computation grid extends to 18.0–18.9° N, 77.0–78.0° E (~53 km × ~56 km) to capture surrounding terrain context.

---

## DATASET 1: MOLA — Mars Orbiter Laser Altimeter

| Field | Value |
|---|---|
| **Mission** | Mars Global Surveyor (MGS) |
| **Instrument** | Mars Orbiter Laser Altimeter (MOLA) |
| **Data product** | MEGDR (Mission Experiment Gridded Data Record) — global DEM |
| **Spatial resolution** | ~463 m/px at equator (128 ppd); regional products at 512 ppd (~115 m/px) |
| **Temporal info** | Collected 1997–2001; static product |
| **Coordinate system** | IAU 2000 planetocentric; positive east longitude |
| **Data format** | GeoTIFF, IMG (PDS3), binary grid |
| **Access** | PDS Geosciences Node; USGS Astropedia |
| **URL** | https://astrogeology.usgs.gov/search/map/Mars/GlobalSurveyor/MOLA |
| **Relevant fields** | Elevation (meters relative to areoid) |
| **Preprocessing** | Reproject to equirectangular; clip to Jezero region; compute slope grid |
| **Limitations** | ~463m resolution insufficient for rock-scale hazards; supplemented by HiRISE DTMs |
| **License** | Public domain (NASA/USGS) |
| **Can download beforehand** | ✅ Yes |
| **Use** | **PRIMARY** — elevation, slope computation, traversability cost base layer |

### Derived Products
- **Slope grid:** `slope = arctan(Δelevation / Δdistance)` computed per grid cell using 8-neighbor max gradient
- **Traversability cost:** Slope → traversability penalty: 0–5° = 1.0, 5–10° = 1.5, 10–15° = 2.5, 15–20° = 5.0, 20–25° = 10.0, >25° = impassable (999)

---

## DATASET 2: HiRISE — High Resolution Imaging Science Experiment

| Field | Value |
|---|---|
| **Mission** | Mars Reconnaissance Orbiter (MRO) |
| **Instrument** | HiRISE |
| **Data product** | RDR (Reduced Data Records) — map-projected images; DTMs |
| **Spatial resolution** | ~25 cm/px (imagery); ~1 m/px (DTMs) |
| **Temporal info** | Ongoing since 2006 |
| **Coordinate system** | IAU 2000 planetocentric; positive east longitude |
| **Data format** | JP2, GeoTIFF (DTMs), PDS3 IMG |
| **Access** | HiRISE website (uahirise.org); PDS Imaging Node |
| **URL** | https://www.uahirise.org/; https://hirise.lpl.arizona.edu/ |
| **Relevant fields** | High-res surface imagery; elevation at meter scale |
| **Preprocessing** | Select Jezero coverage tiles; mosaic if needed; use as visual base layer + roughness estimation |
| **Limitations** | Narrow swath (~6 km wide); not global coverage; large file sizes |
| **License** | Public domain (NASA) |
| **Can download beforehand** | ✅ Yes |
| **Use** | **PRIMARY** — base map imagery, rock density/roughness estimation, high-res local DTM |

### Specific Jezero Coverage
Multiple HiRISE images and DTMs cover the Jezero delta and crater floor. Key observations:
- ESP_037523_1985, ESP_046060_1985, and others cover the delta region
- DTMs exist for the delta and parts of the crater rim

---

## DATASET 3: CRISM — Compact Reconnaissance Imaging Spectrometer for Mars

| Field | Value |
|---|---|
| **Mission** | Mars Reconnaissance Orbiter (MRO) |
| **Instrument** | CRISM |
| **Data product** | TRDR (Targeted Reduced Data Records); mineral maps; spectral parameter maps |
| **Spatial resolution** | ~18 m/px (targeted mode); ~200 m/px (multispectral survey) |
| **Temporal info** | Ongoing since 2006 |
| **Coordinate system** | IAU 2000 planetocentric |
| **Data format** | PDS3 IMG; derived mineral maps in GeoTIFF |
| **Access** | PDS Geosciences Node; CRISM Data Users Workshop products |
| **URL** | https://crism.jhuapl.edu/ |
| **Relevant fields** | Mineral detections (olivine, carbonates, phyllosilicates, iron oxides, hydrated silica) |
| **Preprocessing** | Extract mineral parameter maps; classify mineral presence; generate science-value grid |
| **Limitations** | Targeted observations cover limited areas; spectral interpretation requires expertise |
| **License** | Public domain (NASA) |
| **Can download beforehand** | ✅ Yes |
| **Use** | **PRIMARY** — science value scoring layer; mineral classification drives science targets |

### Science Value Derivation
Mineral detections map to science priority tiers (MODEL — not a direct measurement):
- **Tier 1 (Score 0.8–1.0):** Carbonates, phyllosilicates, hydrated silica — biosignature-relevant; primary targets for Mars 2020 sample return (Farley et al. 2020)
- **Tier 2 (Score 0.5–0.8):** Olivine in altered contexts, sulfates — water interaction indicators; secondary astrobiological interest
- **Tier 3 (Score 0.2–0.5):** Pyroxene, iron oxides — geological context minerals; igneous history
- **Tier 4 (Score 0.0–0.2):** Unaltered basalt, unclassified — baseline geological material

---

## DATASET 4: THEMIS — Thermal Emission Imaging System

| Field | Value |
|---|---|
| **Mission** | Mars Odyssey |
| **Instrument** | THEMIS |
| **Data product** | Global daytime/nighttime IR mosaics; derived thermal inertia |
| **Spatial resolution** | ~100 m/px (IR) |
| **Temporal info** | Ongoing since 2002 |
| **Coordinate system** | IAU 2000 |
| **Data format** | GeoTIFF, PDS3 IMG |
| **Access** | ASU THEMIS portal; JMARS |
| **URL** | https://themis.asu.edu/ |
| **Relevant fields** | Thermal inertia → surface material classification (dust, sand, bedrock, rocks) |
| **Preprocessing** | Extract thermal inertia for Jezero region; classify into surface material types |
| **Limitations** | 100m resolution — good for regional traversability, not individual rocks |
| **License** | Public domain (NASA) |
| **Can download beforehand** | ✅ Yes |
| **Use** | **SECONDARY** — surface material classification → hazard/traversability refinement |

### Surface Material Classification from Thermal Inertia
| Thermal Inertia (TI) Range | Material | Traversability Impact |
|---|---|---|
| < 100 J/(m²·K·s½) | Fine dust | Moderate risk (low traction) |
| 100–300 | Sand/granular | Good traversability |
| 300–600 | Indurated soil / small rocks | Good traversability |
| 600–1200 | Bedrock / large rocks | Rock hazard; requires navigation |
| > 1200 | Dense bedrock | Generally traversable but rough |

---

## DATASET 5: MCS — Mars Climate Sounder

| Field | Value |
|---|---|
| **Mission** | Mars Reconnaissance Orbiter (MRO) |
| **Instrument** | Mars Climate Sounder |
| **Data product** | Atmospheric profiles; dust column optical depth |
| **Spatial resolution** | ~5 km vertical; horizontal varies |
| **Temporal info** | Ongoing since 2006; seasonal data |
| **Coordinate system** | Lat/lon + altitude profiles |
| **Data format** | PDS3/4 tables; ASCII/binary |
| **Access** | PDS Atmospheres Node |
| **URL** | https://pds-atmospheres.nmsu.edu/ |
| **Relevant fields** | Dust optical depth at Jezero region; temperature profiles |
| **Preprocessing** | Extract seasonal dust statistics for Jezero latitude; provide contextual conditions |
| **Limitations** | Atmospheric data, not surface-specific; used for environmental context, not routing |
| **License** | Public domain (NASA) |
| **Can download beforehand** | ✅ Yes |
| **Use** | **CONTEXTUAL** — atmospheric dust conditions as environmental context layer |

---

## DATASET 6: Perseverance Rover Traverse & Science Data

| Field | Value |
|---|---|
| **Mission** | Mars 2020 (Perseverance) |
| **Instrument** | Navigation/science instruments |
| **Data product** | Rover traverse waypoints; science target locations; sample collection sites |
| **Spatial resolution** | Point data (GPS-equivalent positions) |
| **Temporal info** | 2021–present (ongoing) |
| **Coordinate system** | IAU 2000 planetocentric |
| **Data format** | JSON (via mars.nasa.gov API); CSV |
| **Access** | mars.nasa.gov/mars2020/mission/where-is-the-rover/ |
| **URL** | https://mars.nasa.gov/mars2020/ |
| **Relevant fields** | Rover position history; sol numbers; named science targets |
| **Preprocessing** | Extract waypoint coordinates; overlay on map as reference traverse |
| **Limitations** | Rover path ≠ EVA path; different constraints; but provides ground truth for terrain |
| **License** | Public domain (NASA) |
| **Can download beforehand** | ✅ Yes |
| **Use** | **REFERENCE** — Perseverance traverse as validation/reference layer; science target catalog |

---

## Data Strategy Summary

| Priority | Dataset | Role in System |
|---|---|---|
| **P0 (Must have)** | MOLA | Elevation → slope → traversability cost |
| **P0 (Must have)** | HiRISE | Base imagery → visual context |
| **P0 (Must have)** | CRISM | Mineralogy → science value scoring |
| **P1 (Should have)** | THEMIS | Thermal inertia → surface material → hazard refinement |
| **P2 (Nice to have)** | MCS | Atmospheric dust → environmental context |
| **P2 (Nice to have)** | Perseverance | Rover traverse → reference/validation |

### Data Mode Architecture

| Mode | Priority | Behavior |
|---|---|---|
| **VERIFIED_SNAPSHOT** | PRIMARY | Real NASA data pre-downloaded, cropped, cached locally with full PDS product ID provenance. This is real NASA data, not synthetic. |
| **LIVE** | STRETCH GOAL | Direct NASA PDS/API access. Not reliable for demo; never depend on this. |
| **DEMONSTRATION** | EMERGENCY FALLBACK ONLY | Synthetic grids matching real Jezero topography. Clearly labeled "DEMONSTRATION — NOT REAL NASA DATA." Used only if verified snapshots are corrupted or missing. |

All modes use the same internal data schema. Data mode indicator is always visible in the UI header. The hackathon demo MUST run from VERIFIED_SNAPSHOT mode to satisfy the challenge requirement of real/verified NASA open data.
