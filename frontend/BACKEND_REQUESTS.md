# VICTOR — Frontend Backend Requests

> This file is the official communication channel for backend changes needed by
> the frontend. Per scope boundary: the frontend agent does NOT edit backend files.
> The backend agent should read this and implement or respond.

---

## Request 1: Environmental / Atmospheric Data Endpoint

**Status:** Needed for `Environmental Data` view  
**Priority:** Low (view renders honest "not available" without it)

**Requested endpoint:** `GET /api/v1/environment/current`

**Needed response shape:**
```json
{
  "region": "Jezero Crater",
  "surface_temperature_day_c": null,
  "surface_temperature_night_c": null,
  "temperature_source": "THEMIS_TI_derived | null",
  "dust_opacity_tau": null,
  "dust_opacity_source": "MCS_climatology | null",
  "atmospheric_pressure_pa": null,
  "pressure_source": null,
  "notes": "string explaining what is available vs. estimated",
  "data_mode": "DEMONSTRATION | VERIFIED_SNAPSHOT | LIVE"
}
```

**Notes:**
- Any field the backend cannot derive should be `null`, not a plausible-looking number
- `temperature_source` must name the instrument (e.g. `"THEMIS_TI_derived"`)
- Frontend will display `—` for any `null` field with a tooltip citing the source string

---

## Request 2: Region Info Response Typing

**Status:** `getRegionInfo()` (`GET /api/v1/map/region`) returns `Record<string, unknown>`.  
The frontend needs a documented shape to parse safely.

**Please confirm or implement this shape:**
```json
{
  "name": "Jezero Crater",
  "lat": 18.444,
  "lon": 77.450,
  "elevation_m": -2450,
  "terrain_type": "Crater Floor / Delta",
  "terrain_subtype": "Alluvial, Sedimentary",
  "region_description": "string",
  "data_mode": "DEMONSTRATION | VERIFIED_SNAPSHOT | LIVE"
}
```

**Notes:**
- The frontend `InfoBar` component reads `name`, `lat`, `lon`, `elevation_m`, `terrain_type`, `terrain_subtype`
- If `elevation_m` is null, the card shows `—`
- Other fields are optional / future

---

## Request 3: Layer List Response Typing

**Status:** `getLayers()` (`GET /api/v1/map/layers`) returns `Record<string, unknown>`.

**Requested shape:**
```json
{
  "layers": [
    {
      "id": "terrain",
      "name": "Base Terrain (HiRISE-style)",
      "type": "tile | polyline | contextual",
      "source": "MOLA | CRISM | THEMIS | HiRISE | MCS | MODEL",
      "description": "string",
      "available": true,
      "unavailable_reason": null
    }
  ]
}
```

**Notes:**
- `available: false` + `unavailable_reason: "Data not yet ingested"` → frontend renders
  the layer row disabled with a tooltip
- The frontend LayerControl drives from this endpoint; layers appear/activate automatically
  as the backend ingests more data

---

## Request 4: Science Strategy Comparison Response Typing

**Status:** `compareScienceStrategies(computationId)` (`GET /api/v1/science/compare/{id}`)  
returns `Record<string, unknown>`.

**Needed for:** `Science Opportunities` view strategy comparison cards.

**Requested shape:**
```json
{
  "computation_id": "string",
  "strategies": {
    "SAFEST": {
      "total_science_value": 4.21,
      "avg_science_value": 0.042,
      "peak_science_value": 0.88,
      "targets_accessed_count": 3
    }
  }
}
```

---

*Last updated: 2026-10-07 by frontend agent (Antigravity)*
