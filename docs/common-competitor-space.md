# Common Competitor Space Analysis

## The 10 Most Likely AI-Generated Solutions

### 1. 3D Mars Globe with Data Layers
**Why common:** Every LLM knows CesiumJS/Three.js + Mars textures. Visually impressive with minimal logic.  
**What it gets right:** Eye-catching, demonstrates technical skill, shows multi-mission data.  
**What it misses:** No intelligence, no decision support, no route analysis. It's a visualization, not a tool.  
**Why judges consider it ordinary:** Hundreds of teams will build this. Google Mars already exists.  
**Technical depth lacking:** No computation beyond rendering. No scientific processing.

### 2. GIS Dashboard with Layer Toggles
**Why common:** Standard web-GIS pattern. Leaflet + GeoTIFF tiles = quick results.  
**What it gets right:** Satisfies "layered view" requirement. Professional appearance.  
**What it misses:** No synthesis, no intelligence, no route planning. Passive data display.  
**Why judges consider it ordinary:** This is literally a GIS viewer with Mars data — QGIS already does this.  
**Technical depth lacking:** No scientific processing pipeline.

### 3. Shortest-Path Route Planner
**Why common:** A* on elevation grid is textbook CS. Every AI assistant can generate this.  
**What it gets right:** Addresses route planning. Demonstrates algorithmic thinking.  
**What it misses:** Only optimizes distance. Ignores hazards, science, resource constraints, uncertainty.  
**Why judges consider it ordinary:** Dijkstra on Mars ≠ innovation.  
**Technical depth lacking:** Single-objective, no trade-off analysis, no science integration.

### 4. Hazard Heatmap / Risk Map
**Why common:** Slope + roughness → heatmap is straightforward GIS processing.  
**What it gets right:** Safety-relevant. Uses real data meaningfully.  
**What it misses:** No route context, no science layer, no decision support.  
**Why judges consider it ordinary:** A heatmap is a single derived layer, not a system.  
**Technical depth lacking:** No route intelligence, no multi-objective reasoning.

### 5. AI Chatbot / Mars Assistant
**Why common:** LLM + RAG over NASA docs = fast MVP. Very trendy.  
**What it gets right:** Natural language interaction. Can surface NASA information.  
**What it misses:** No computation, no spatial reasoning, no route planning. LLM hallucinates science.  
**Why judges consider it ordinary:** Every other team will have an AI chatbot. It's 2026.  
**Technical depth lacking:** The chatbot replaces computation with text generation.

### 6. Rover-Style Navigation Simulator
**Why common:** "Drive a virtual rover on Mars" is intuitive and fun.  
**What it gets right:** Engaging demo. Shows terrain interaction.  
**What it misses:** Astronauts aren't rovers. Different constraints, different objectives.  
**Why judges consider it ordinary:** Gaming-adjacent, not scientifically rigorous.  
**Technical depth lacking:** Simulation without optimization or decision support.

### 7. NASA Data Dashboard
**Why common:** Fetch NASA APIs → display tiles/charts = standard pattern.  
**What it gets right:** Multi-mission data aggregation. Professional look.  
**What it misses:** Aggregation ≠ synthesis. No spatial reasoning, no route context.  
**Why judges consider it ordinary:** It's an API wrapper with charts.  
**Technical depth lacking:** No derived intelligence.

### 8. Route Recommendation System (basic)
**Why common:** "Click two points → get suggested route" is obvious.  
**What it gets right:** Direct user workflow. Actionable output.  
**What it misses:** Single route, no trade-offs, no explanation of WHY.  
**Why judges consider it ordinary:** Google Maps does this for Earth.  
**Technical depth lacking:** No multi-objective optimization, no evidence layer.

### 9. Scientific POI Map
**Why common:** Plot known geological features on a map = simple data overlay.  
**What it gets right:** Addresses science discovery. Uses real targets.  
**What it misses:** Passive display. No route integration, no prioritization.  
**Why judges consider it ordinary:** A map of dots is not a mission planning tool.  
**Technical depth lacking:** No value scoring, no route coupling.

### 10. Polished Mars Mission Planner (surface-level)
**Why common:** Combines map + route + a few info panels. The "obvious full solution."  
**What it gets right:** Addresses multiple requirements. Looks complete.  
**What it misses:** Surface-deep across all features. No genuine computation underneath.  
**Why judges consider it ordinary:** Breadth without depth. The AI "everything app."  
**Technical depth lacking:** Wide but shallow. No single feature is defensibly deep.

---

## Common Solution Weaknesses Matrix

| Weakness | # Solutions Affected |
|---|---:|
| No multi-objective optimization | 9/10 |
| No route trade-off analysis | 8/10 |
| No science-safety trade-off | 9/10 |
| No uncertainty communication | 10/10 |
| No evidence/provenance for decisions | 9/10 |
| No scenario comparison | 10/10 |
| No computational pipeline beyond rendering | 7/10 |
| LLM as scientific authority | 3/10 |
| Single-objective route (distance only) | 6/10 |
| No explanation of WHY a route was chosen | 8/10 |

---

## THE GAP

The gap is in **multi-objective route intelligence with explainable trade-offs**.

Most teams will show data. Very few will COMPUTE over that data to produce:
1. Multiple route strategies with different optimization objectives
2. Quantified science-vs-safety trade-offs
3. Evidence-backed explanations of why Route A differs from Route B
4. Scenario analysis: "what changes if mission priorities shift"
5. Per-segment provenance: which NASA data influenced each route decision

This gap is:
- Supported by real NASA data (MOLA, CRISM, HiRISE, THEMIS)
- Supported by real algorithms (weighted A*, Pareto-optimal multi-objective routing)
- Explainable to judges in under 7 minutes
- Not trivially reproducible by running a prompt through an AI coding assistant
- Scientifically defensible (terrain traversability, mineral science value, slope risk)
