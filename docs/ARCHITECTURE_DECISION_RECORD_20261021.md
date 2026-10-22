# VICTOR Architecture Decision Record (ADR)

**Document ID:** `docs/ARCHITECTURE_DECISION_RECORD_20261021.md`  
**Date:** October 21, 2026  
**Status:** Approved & Implemented  
**Inputs:** `docs/AUDIT_REPORT_20261021_203212.md`, `docs/VICTOR_CODING_AGENT_IMPLEMENTATION_PLAN_20261021.md`, and direct user authorization.

---

## 1. Context & Mission Boundaries

VICTOR is an independent planetary exploration tool built for the **NASA Space Apps Challenge 2026** focusing on Jezero Crater, Mars ($18.0^\circ\text{–}18.9^\circ\text{N}, 77.0^\circ\text{–}78.0^\circ\text{E}$). The application computes multi-criteria A* traversal corridors over a $300 \times 300$ non-square computational grid (~$177.5\text{ m} \times 187.1\text{ m}$ per cell).

This record formally establishes the algorithmic safety, geospatial coordinate contracts, data provenance standards, and operational limits.

---

## 2. Core Decisions & Contracts

### Decision 1: EVA Duration Safety Budget & Reserve Model (AUD-001)
- **Contract:** Traversal duration is budgeted on a strict one-way traverse with a mandatory **20% life-support safety reserve margin**:
  $$\text{EVA}_{\text{required}} = t_{\text{traverse}} \times 1.20 \le \text{EVA}_{\text{max}}$$
- **Enforcement:** If a candidate A* path has an estimated traversal time where $t \times 1.20 > \text{EVA}_{\text{max}}$, the path is strictly rejected as non-admissible. If all strategies exceed the budget, the backend returns HTTP 422 with a deterministic infeasibility report showing the requested limit vs the minimum feasible traverse duration.
- **Reporting:** Every route and mission report explicitly surfaces `effective_eva_budget_hours`, `estimated_time_hours`, `eva_reserve_hours` ($0.20 \times t$), and `eva_margin_hours` ($\text{EVA}_{\text{max}} - 1.20 \times t$).

### Decision 2: Geospatial Extent & Endpoint Safety (AUD-002)
- **Contract:** Coordinates are strictly bounded to the validated Jezero Crater study window:
  $$\text{Latitude} \in [18.0^\circ, 18.9^\circ]\text{N}, \quad \text{Longitude} \in [77.0^\circ, 78.0^\circ]\text{E}$$
- **Validation:** Finite real numbers only (NaN, $\pm\infty$ rejected with HTTP 422). No silent coordinate clamping on public API requests.
- **Safety Pre-Check:** Before A* execution, both the start and destination grid cells are inspected. If either point has $\text{slope} > \text{max\_slope\_deg}$ or $\text{traversability} \ge 5.0$ (impassable rock or loose drift barrier), the computation is rejected immediately with HTTP 422 identifying the exact endpoint and failure condition.

### Decision 3: Scenario Weight Overrides (AUD-003)
- **Contract:** Scenario modification requests may supply custom strategy weights:
  - Allowed keys: `distance`, `traversability`, `hazard`, `science_penalty`.
  - Allowed bounds: clamped to $[0.0, 5.0]$.
- **Enforcement:** The route engine computes with the effective weights and echoes them in `Route.effective_weights`. Unknown keys or non-numeric values are rejected.

### Decision 4: Computation Store Persistence & Cache Invalidation (AUD-004, AUD-005)
- **Contract:** Computations persisted to the store (in-memory or Supabase Postgres) must serialize the complete request context (`RouteComputeRequest`), data manifest ID, and schema version.
- **Rehydration:** If a legacy record without request context is queried for scenario comparison, the backend refuses with HTTP 422 rather than inventing arbitrary default parameters.
- **Cache Identity:** Cache keys incorporate start/dest coordinates, constraints, strategies, `data_manifest_id`, and `weight_overrides`. Any manifest update triggers a natural cache miss.

### Decision 5: NASA-Only Science Priority & Environmental Provenance (AUD-006, AUD-007, AUD-008)
- **Data Manifest:** All active array files (`elevation.npy`, `slope.npy`, `traversability.npy`, `hazard.npy`, `thermal_proxy.npy`, `olivine_index.npy`, `carbonate_index.npy`, `imagery.npy`) must match SHA-256 hashes in `data_manifest.json` at startup. If any file is missing or mismatched, `data_mode` degrades from `VERIFIED_SNAPSHOT` with an explicit diagnostic.
- **CRISM Science Routing:** Science routing yield in verified mode is derived strictly from MRO CRISM spectral indices (`OLINDEX3` and `CINDEX2`). Swath gaps are treated as unmeasured (`UNAVAILABLE` / 0 penalty discount). Published literature targets are retained strictly as an advisory display overlay marked `MODELLED`.
- **Environmental Data:** No hardcoded numeric fallbacks in `GET /api/v1/environment/current`. MEDA measurements are loaded strictly from the verified manifest; if absent, fields return `null` with a clear explanation.

### Decision 6: Global Explorer Map Policy (AUD-010)
- **Contract:** Third-party OpenPlanetary Carto CDN is completely removed.
- **Global Layers:** Direct NASA Solar System Treks endpoints (`MOLA 463m` and `Viking MDIM 2.1`) are permitted with a prominent offline/error fallback banner if the external service is unreachable.

### Decision 7: Evidence Truthfulness & Source Disclaimers (AUD-009, AUD-011)
- **CRISM Resolution:** Displayed resolution is corrected from 18 m to the authentic **181.14 m/px** (MRO CRISM MRDR).
- **THEMIS:** Clarified as a **night-IR thermal inertia proxy [0..1]**, not a calibrated physical mineral abundance or temperature.
- **Project Representation:** Clarified as an independent **NASA Space Apps Challenge 2026** project, removing any inaccurate claims of NASA program endorsement or operation.
