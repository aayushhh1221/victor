# PATHWISE — Anticipated Judge Q&A & Technical Defense

**Project:** PATHWISE — Multi-Objective Marswalk Arbitration Engine  
**Challenge:** NASA Space Apps Challenge 2026 — Interplanetary Survival Guide: Martian Map  

---

### Q1: What specific NASA datasets are integrated into PATHWISE, and how are they used?
**Answer:**  
PATHWISE fuses **6 instrument datasets across 4 NASA Mars missions**:
1. **MOLA (Mars Global Surveyor):** 128 ppd Mission Experiment Gridded Data Record (MEGDR) providing topography, from which slope angles and traversability penalties are computed.
2. **HiRISE (Mars Reconnaissance Orbiter):** High-resolution visible imagery providing the display base layer.
3. **CRISM (MRO):** Targeted hyperspectral mineralogy observations identifying key scientific mineral classes (carbonates, phyllosilicates, hydrated silica, altered olivine).
4. **THEMIS (Mars Odyssey):** Thermal inertia infrared records characterizing surface mantling (fine dust vs. rock/bedrock) to refine surface hazard.
5. **MCS (MRO):** Mars Climate Sounder contextual atmospheric limb profiles characterizing seasonal regional dust opacity. (Explicitly labeled as contextual atmospheric context, not per-cell walking hazards).
6. **Perseverance Rover (Mars 2020):** Ground-truth reference traverse tracking Sols 1–1000 across Jezero Crater floor, Séítah, and Delta front for validation.

---

### Q2: How does PATHWISE differ from Google Maps or conventional pathfinding algorithms?
**Answer:**  
Google Maps and standard navigation tools solve a single objective: finding the path of minimum travel time or Euclidean distance. On a planetary EVA, **optimizing a single metric is mission-fatal**.
PATHWISE formulates Mars exploration as a **Multi-Objective Optimization Problem (MOOP)** with 4 competing strategies:
- **SAFEST:** Minimizes terrain hazard and steep slopes.
- **FASTEST:** Minimizes distance and travel time.
- **SCIENCE-RICHEST:** Maximizes visits to high-tier mineralogical science targets.
- **BALANCED:** Arbitrates an optimal compromise between consumable usage and scientific yield.

We compute **Pareto Dominance** across all 4 routes. If all routes are Pareto non-dominated (as verified in our test suite), each route represents a genuine, mathematically distinct compromise that a human mission commander must decide upon.

---

### Q3: How do you handle A* pathfinding with science rewards without introducing negative edge costs?
**Answer:**  
Standard A* requires all edge weights to be non-negative; negative edge weights invalidate Dijkstra/A* consistency and can cause negative-weight cycles.  
To seek science without negative edge costs, PATHWISE uses a **non-negative science penalty formulation**:
$$\text{science\_penalty} = w_{\text{science\_penalty}} \times (1.0 - \text{science\_value})$$
Because $\text{science\_value} \in [0.0, 1.0]$, the penalty term is always $\ge 0$. High-science cells have a penalty near 0, making them energetically favored by A*, while preserving all theoretical guarantees of A* optimality and admissible heuristics.

---

### Q4: How is geospatial precision handled on Mars? Did you use standard Earth Web Mercator?
**Answer:**  
No. Earth Web Mercator (EPSG:3857) assumes Earth's equatorial radius (6,378,137 m). Mars has a mean radius of **3,389,500 m** (IAU2000 planetocentric standard).  
PATHWISE implements an explicit affine transformation mapping Mars planetocentric latitude/longitude (East-positive) to Leaflet pixel space:
$$x_{\text{pixel}} = \frac{\text{lon} - \text{lon}_{\min}}{\text{lon}_{\max} - \text{lon}_{\min}} \times \text{tile\_extent}$$
$$y_{\text{pixel}} = \frac{\text{lat}_{\max} - \text{lat}}{\text{lat}_{\max} - \text{lat}_{\min}} \times \text{tile\_extent}$$
All scale bars and segment distances use the great-circle **Mars Haversine formula** parameterized with Mars mean radius $R_{\text{Mars}} = 3,389,500\text{ m}$. Our grid cells are explicitly non-square (~177 m N–S × ~187 m E–W at 18.5°N), and distance math respects this exact geometry.

---

### Q5: How does PATHWISE represent uncertainty and data provenance?
**Answer:**  
We avoid artificial or fabricated precision:
1. **Categorical Confidence:** We report data confidence as **HIGH**, **MODERATE**, or **LOW** based on instrument coverage and spatial resolution, rather than inventing ungrounded numeric percentages (like 94.7%).
2. **Science Priority as a Model:** Science values are explicitly labeled in the UI as **MODEL scores**, derived from published Mars 2020 science team priorities (Farley et al. 2020, Goudge et al. 2015), not claimed as direct physical sensor outputs.
3. **Data Mode Transparency:** The app header displays an animated badge showing the current operating mode (**VERIFIED_SNAPSHOT**, **LIVE**, or **DEMONSTRATION**), ensuring users and evaluators know the provenance of the underlying data.

---

### Q6: What is the "Analytical Counterfactual Attribution" in the Evidence Inspector?
**Answer:**  
In human-in-the-loop mission planning, astronauts need to know *why* a route avoids a certain passage. Rather than running slow black-box ML models, PATHWISE performs **closed-form analytical counterfactual attribution** for every 250m segment:
$$\text{cost\_without\_X} = \text{total\_edge\_cost} - \text{contribution}_X$$
This allows the Evidence Inspector to state deterministically: *"Without the hazard factor, this segment's traversal cost would decrease by 28%."* It gives mission commanders full explainability without additional computation overhead.

---

### Q7: What is the system latency and offline readiness?
**Answer:**  
- **Latency:** On a 300×300 grid (90,000 cells), all 4 routes compute in **~1.2 seconds**.
- **First Load:** Precomputed demo routes load in **< 100 milliseconds** via our `/api/v1/routes/demo` endpoint.
- **Offline Resilience:** The application is 100% functional offline without active internet connectivity. All tiles, elevation grids, and mineral catalogs are bundled in the repository snapshot.
