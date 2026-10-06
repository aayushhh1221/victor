# Architecture Decision Record

## Five Fundamentally Different Product Thesis Options

---

### CONCEPT 1: "PATHWISE" — Multi-Objective Route Arbitration Engine

**Core thesis:** The map is the viewport into a multi-objective route optimization engine that computes, compares, and explains competing route strategies based on terrain traversability, hazard exposure, science value, and mission resource constraints — exposing the trade-offs that a mission planner must resolve.

**Main user:** Mission planner / EVA coordinator  
**Key NASA datasets:** MOLA (elevation), HiRISE (imagery/terrain), CRISM (mineralogy/science value), THEMIS (thermal inertia/surface material), MCS (dust conditions)  
**Scientific computation:** Weighted multi-objective A* pathfinding over a traversability cost grid derived from slope, roughness, and hazard layers. Science value scoring from CRISM mineral detections. Per-segment cost decomposition.  
**Intelligence layer:** Route optimizer + trade-off comparator + evidence explainer (AI for natural-language explanation of computed results only)  
**Route/location logic:** Start/destination selection → multi-objective route generation (SAFEST, FASTEST, SCIENCE-RICHEST, BALANCED) → comparative analysis → scenario modification → re-computation  
**User workflow:** Select region → set start/destination → choose mission priorities → compare 4 route strategies → inspect per-segment evidence → modify scenario → see impact  
**Differentiator:** The system doesn't just find a route — it finds 4 competing routes and explains why they differ using computed evidence from real NASA data  
**Demo moment:** "Route B is longer but passes within detour range of a high-value carbonate deposit. If you detour here, science value increases significantly while adding minimal traversal time." *(Exact values are computed at runtime, not hardcoded.)*  
**Technical difficulty:** High — multi-objective pathfinding, multi-layer data fusion, evidence decomposition  
**48-hour feasibility:** Achievable with precomputed data grids and simplified cost model  
**Main risk:** Route optimization may not feel visually impressive enough initially

### CONCEPT 2: "MARS ORACLE" — Predictive Environmental Decision Engine

**Core thesis:** Fuse atmospheric, thermal, and geological data to predict environmental conditions along any route at a given time, enabling temporal mission planning (when is it safe to walk?).

**Main user:** Mission commander / flight controller  
**Key NASA datasets:** MCS (atmospheric), THEMIS (thermal), MOLA (topography)  
**Scientific computation:** Temporal environmental modeling, dust opacity prediction, thermal exposure estimation  
**Intelligence layer:** Predictive time-series models for surface temperature and dust at specific locations  
**Differentiator:** Time-aware mission planning — not just WHERE but WHEN  
**Demo moment:** "If you depart at 10:00 local solar time, dust exposure is 40% lower than at 14:00"  
**Technical difficulty:** Very high — temporal modeling of Martian atmosphere with limited data  
**48-hour feasibility:** Very risky — insufficient data resolution for reliable temporal predictions  
**Main risk:** Temporal predictions lack sufficient ground truth. False confidence.

### CONCEPT 3: "GEOSYNTH" — Science Discovery Maximization Engine  

**Core thesis:** Instead of route planning, optimize which scientific targets to visit given limited EVA time, maximizing scientific return per hour of Marswalk.

**Main user:** Science team lead  
**Key NASA datasets:** CRISM (mineralogy), HiRISE (geology), Perseverance rover ground truth  
**Scientific computation:** Knapsack/TSP optimization over science targets weighted by geological value, proximity, and accessibility  
**Intelligence layer:** Science value scoring from mineral classification + geological context  
**Differentiator:** Science-first mission planning — every minute of EVA is allocated to maximize discovery  
**Demo moment:** "Given 4 hours of EVA, visiting targets B, D, and F yields 2.3× higher science value than the nearest 3 targets"  
**Technical difficulty:** Moderate  
**48-hour feasibility:** Good  
**Main risk:** Too narrow — doesn't address safety/navigation adequately

### CONCEPT 4: "STRATIGRAPHER" — Geological Cross-Section Intelligence

**Core thesis:** Generate rich geological cross-sections along any path, showing subsurface composition inference from orbital data, enabling astronauts to understand what lies beneath their route.

**Main user:** Field geologist / astronaut scientist  
**Key NASA datasets:** CRISM, MOLA, THEMIS, HiRISE DTMs  
**Scientific computation:** Mineral stratigraphy inference from spectral data + elevation correlation  
**Intelligence layer:** Cross-section rendering with geological interpretation  
**Differentiator:** Geology-first — no other team will build subsurface inference  
**Demo moment:** "This cross-section shows the contact between deltaic sediments and igneous basement rock at km 4.7 — a high-priority sampling site"  
**Technical difficulty:** Very high — geological inference from orbital data is PhD-level  
**48-hour feasibility:** Risky — simplified geological models may not be credible  
**Main risk:** Over-claiming geological inference from limited orbital data

### CONCEPT 5: "COUNTERFACTUAL MARS" — Mission Scenario Simulator

**Core thesis:** Build a scenario engine that answers: "What if X changes?" — enabling mission planners to stress-test their Marswalk plans against environmental, equipment, or priority changes.

**Main user:** Mission planner / risk manager  
**Key NASA datasets:** All major Mars datasets as baseline  
**Scientific computation:** Scenario re-computation engine — change inputs, see route/risk/science impact  
**Intelligence layer:** Parametric sensitivity analysis  
**Differentiator:** Not just one plan — test many plans against scenarios  
**Demo moment:** "If maximum traversal slope drops from 15° to 10° due to suit limitation, a significant percentage of routes become non-viable and the optimal route shifts west." *(Exact values are computed at runtime, not hardcoded.)*  
**Technical difficulty:** High  
**48-hour feasibility:** Achievable if built on top of Concept 1's route engine  
**Main risk:** Without a strong base route engine, scenarios have nothing to compare against

---

## Scoring Matrix

| Criterion (Weight) | C1: PATHWISE | C2: ORACLE | C3: GEOSYNTH | C4: STRATIGRAPHER | C5: COUNTERFACTUAL |
|---|---|---|---|---|---|
| Challenge relevance (20%) | 9 | 7 | 7 | 6 | 8 |
| NASA-data depth (15%) | 9 | 7 | 8 | 9 | 8 |
| Novelty (15%) | 8 | 8 | 7 | 9 | 8 |
| Scientific credibility (15%) | 8 | 6 | 8 | 7 | 7 |
| Technical depth (10%) | 9 | 8 | 7 | 9 | 8 |
| Mission usefulness (10%) | 9 | 7 | 7 | 6 | 8 |
| Demo impact (10%) | 9 | 7 | 7 | 8 | 8 |
| Feasibility (5%) | 8 | 5 | 8 | 5 | 7 |
| **Weighted Total** | **8.65** | **7.00** | **7.35** | **7.40** | **7.85** |

### GENERIC-AI COMMONNESS PENALTY

| Concept | Penalty | Reason |
|---|---|---|
| C1: PATHWISE | -0.3 | Route planning is common, but multi-objective + evidence is rare |
| C2: ORACLE | -0.5 | Environmental dashboards are common |
| C3: GEOSYNTH | -0.8 | Science POI maps are very common |
| C4: STRATIGRAPHER | -0.1 | Almost no teams will attempt geological cross-sections |
| C5: COUNTERFACTUAL | -0.2 | Scenario engines are uncommon |

### Final Scores (post-penalty)

| Concept | Score |
|---|---|
| **C1: PATHWISE** | **8.35** |
| C5: COUNTERFACTUAL | 7.65 |
| C4: STRATIGRAPHER | 7.30 |
| C3: GEOSYNTH | 6.55 |
| C2: ORACLE | 6.50 |

---

## WINNING CONCEPT: PATHWISE (C1) + Selected Elements of C5

### Hybrid Architecture: PATHWISE with Scenario Layer

Combine the core multi-objective route arbitration engine (C1) with the scenario comparison capability (C5) for maximum impact.

---

## The Winning Concept Answers

### What are we building?
**PATHWISE** — A multi-objective Marswalk planning platform that uses real NASA orbital data to compute, compare, and explain competing route strategies across Jezero Crater. It fuses 6 instrument datasets from 4 NASA Mars missions — elevation (MOLA/MGS), surface imagery (HiRISE/MRO), mineral composition (CRISM/MRO), thermal properties (THEMIS/Odyssey), atmospheric context (MCS/MRO), and reference traverse data (Perseverance/Mars 2020) — into a traversability + science-value cost grid, then runs multi-objective route optimization to generate SAFEST, FASTEST, SCIENCE-RICHEST, and BALANCED route strategies — exposing the trade-offs that a mission planner must resolve.

### Why does it solve the real problem?
A real Marswalker doesn't need a pretty map — they need to know: "Given my constraints (time, energy, suit limits, science objectives), which path should I take, and why?" PATHWISE computes defensible answers to this question and shows the evidence.

### Why does NASA data matter?
NASA data IS the computation substrate. MOLA elevation drives slope cost. CRISM minerals drive science value. HiRISE texture drives roughness estimation. THEMIS thermal inertia drives surface material classification. Without NASA data, there is no route intelligence.

### What is genuinely different?
1. **Four competing route strategies, not one.** Most tools return a single "best" route.
2. **Quantified trade-offs.** Route comparisons show computed differences in distance, time, hazard, and science value. *(Exact values populated at runtime.)*
3. **Per-segment evidence.** Click any route segment → see which NASA layers contributed to its cost.
4. **Scenario re-computation.** Change mission priorities → routes recompute → see what shifts.

### What does the system COMPUTE rather than merely DISPLAY?
- Slope grid from MOLA elevation
- Traversability cost from slope + roughness
- Science value scores from CRISM mineral detections
- Multi-objective weighted A* pathfinding (4 different weight profiles)
- Route metrics comparison (distance, time, hazard exposure, science value)
- Per-segment cost decomposition
- Scenario sensitivity analysis

### What does the user DECIDE using the system?
"Which route strategy balances my mission's safety requirements with scientific objectives, given the terrain and conditions at Jezero Crater?"

### What is the project's technical moat?
The multi-layer data fusion pipeline + multi-objective route engine + evidence decomposition. This cannot be replicated by prompting an LLM — it requires actual geospatial computation on actual NASA raster data.

### Why would another generic AI solution look different?
A generic AI solution would produce a map + chatbot + basic route. It would not compute traversability from elevation data. It would not run multi-objective pathfinding. It would not decompose route decisions into per-segment evidence. It would not offer scenario comparison.

### What will the judge remember after the demo?
"They showed four different routes for the same mission — safest, fastest, most scientifically valuable, and balanced — and you could see exactly WHY they differed. When they changed the mission priority, the routes visibly shifted. That was real computation, not a pretty map."
