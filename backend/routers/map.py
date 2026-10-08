"""VICTOR — Map tiles and region info router."""
from pathlib import Path
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import FileResponse
from ..models.schemas import RegionInfoResponse, LayerInfo, LayersResponse
from ..models.enums import DataMode
from ..dependencies import get_data_service

router = APIRouter(prefix="/api/v1/map", tags=["map"])

TILES_BASE = Path(__file__).parent.parent / "data" / "tiles"


@router.get("/region", response_model=RegionInfoResponse)
async def get_region_info(data_service=Depends(get_data_service)):
    """Get region metadata and available data layers.

    Elevation and centre coordinates are computed from the loaded grids, so the
    UI never needs a hardcoded fallback for them.
    """
    import numpy as np

    meta = data_service.metadata
    elev = data_service.elevation

    return RegionInfoResponse(
        region_name="Jezero Crater, Mars",
        name="Jezero Crater",
        lat_min=meta.lat_min,
        lat_max=meta.lat_max,
        lon_min=meta.lon_min,
        lon_max=meta.lon_max,
        lat=round((meta.lat_min + meta.lat_max) / 2, 4),
        lon=round((meta.lon_min + meta.lon_max) / 2, 4),
        elevation_m=round(float(np.nanmean(elev)), 1),
        elevation_min_m=round(float(np.nanmin(elev)), 1),
        elevation_max_m=round(float(np.nanmax(elev)), 1),
        elevation_source="MOLA/MGS" if data_service.data_mode is DataMode.VERIFIED_SNAPSHOT
                         else "Synthetic elevation model",
        terrain_type="Crater Floor / Delta",
        terrain_subtype="Deltaic, sedimentary, olivine-bearing (Séítah)",
        region_description=(
            "Jezero Crater, a ~45 km impact crater holding a well-preserved "
            "ancient river delta. Mars 2020 Perseverance landing site."
        ),
        grid_rows=meta.rows,
        grid_cols=meta.cols,
        cell_size_ns_m=meta.cell_size_ns_m,
        cell_size_ew_m=meta.cell_size_ew_m,
        cell_shape=meta.cell_shape,
        region_ns_km=meta.region_ns_km,
        region_ew_km=meta.region_ew_km,
        coordinate_system=meta.coordinate_system,
        data_mode=data_service.data_mode,
        compliance=data_service.compliance,
        available_layers=[la.id for la in _build_layers(data_service) if la.available],
        provenance=data_service.get_provenance(),
    )


@router.get("/tiles/{layer}/{z}/{x}/{y}.png")
async def get_tile(layer: str, z: int, x: int, y: int):
    """Serve map tiles (PNG) for the given layer."""
    tile_path = TILES_BASE / layer / str(z) / str(x) / f"{y}.png"
    if not tile_path.exists():
        # Return a 1×1 transparent PNG as placeholder
        placeholder = TILES_BASE / "placeholder.png"
        if placeholder.exists():
            return FileResponse(str(placeholder), media_type="image/png")
        raise HTTPException(status_code=404, detail=f"Tile not found: {layer}/{z}/{x}/{y}")
    return FileResponse(str(tile_path), media_type="image/png",
                        headers={"Cache-Control": "max-age=3600"})


def _tiles_exist(layer_id: str) -> bool:
    """True when a rendered tile pyramid is on disk for this layer."""
    return (TILES_BASE / layer_id / "1").is_dir()


def _build_layers(data_service) -> list[LayerInfo]:
    """Authoritative layer list, with availability derived from what exists.

    Availability is computed from the grids actually ingested and the tiles
    actually rendered — never hardcoded. A layer the UI should offer but cannot
    yet draw is returned with available=False and a reason, so the client can
    render it disabled instead of inventing data for it.
    """
    is_real = data_service.data_mode is not DataMode.DEMONSTRATION

    def src(real: str) -> str:
        return real if is_real else f"{real} (synthetic proxy)"

    NOT_INGESTED = "Data source not yet ingested"
    NO_TILES = "Grid ingested but map tiles not yet rendered"

    specs: list[dict] = [
        {
            "id": "imagery",
            "name": "Base Imagery (CTX)",
            "type": "tile",
            "source": src("CTX / Mars Reconnaissance Orbiter"),
            "description": (
                "Real orbital imagery of Jezero from the MRO Context Camera, "
                "~5 m/px. Display only — not used in routing."
            ),
            "classification": "MEASURED",
            "available": data_service.has_grid("imagery") and _tiles_exist("imagery"),
            "reason": NOT_INGESTED if not data_service.has_grid("imagery") else NO_TILES,
            "default_opacity": 1.0,
        },
        {
            "id": "terrain",
            "name": "Shaded Relief",
            "type": "tile",
            "source": src("MOLA / Mars Global Surveyor, colormapped"),
            "description": (
                "Relief rendered by colormapping the elevation grid. Not orbital "
                "imagery."
            ),
            "classification": "DERIVED",
            "available": _tiles_exist("terrain"),
            "reason": NO_TILES,
            "default_opacity": 1.0,
        },
        {
            "id": "elevation",
            "name": "Elevation (MOLA)",
            "type": "tile",
            "source": src("MOLA / Mars Global Surveyor"),
            "description": "Mars Orbiter Laser Altimeter elevation, 463 m/px native.",
            "classification": "MEASURED",
            "available": _tiles_exist("elevation"),
            "reason": NO_TILES,
            "default_opacity": 0.7,
        },
        {
            "id": "thermal",
            "name": "Thermal Inertia Proxy (THEMIS)",
            "type": "tile",
            "source": src("THEMIS / 2001 Mars Odyssey"),
            "description": (
                "Night-IR brightness as a thermal inertia PROXY — high values "
                "indicate heat-retaining rocky surfaces, low values loose dust "
                "or sand. Not a published thermal inertia product."
            ),
            "classification": "DERIVED",
            "available": data_service.has_grid("thermal_proxy") and _tiles_exist("thermal"),
            "reason": NOT_INGESTED if not data_service.has_grid("thermal_proxy") else NO_TILES,
            "default_opacity": 0.5,
        },
        {
            "id": "hazard",
            "name": "Hazard Zones",
            "type": "tile",
            "source": src("MOLA slope + THEMIS night IR"),
            "description": (
                "Composite hazard on a 0-10 scale: "
                "10 * (0.7 * clip(slope/25,0,1) + 0.3 * (1 - thermal_proxy))."
            ),
            "classification": "DERIVED",
            "available": _tiles_exist("hazard"),
            "reason": NO_TILES,
            "default_opacity": 0.6,
        },
        {
            "id": "science",
            "name": "Science Priority (MODEL)",
            "type": "tile",
            "source": "Published Jezero science targets",
            "description": (
                "Science Priority Score — a MODEL over published target "
                "locations, on a 0-1 scale. Not a direct measurement."
            ),
            "classification": "MODELLED",
            "available": _tiles_exist("science"),
            "reason": NO_TILES,
            "default_opacity": 0.6,
        },
        {
            "id": "composition",
            "name": "Surface Composition (CRISM)",
            "type": "tile",
            "source": "CRISM / Mars Reconnaissance Orbiter",
            "description": "Per-cell mineral identification from CRISM spectra.",
            "classification": None,
            "available": False,
            "reason": NOT_INGESTED,
            "default_opacity": 0.6,
        },
        {
            "id": "dust_activity",
            "name": "Dust Activity (MCS)",
            "type": "tile",
            "source": "MCS / Mars Reconnaissance Orbiter",
            "description": "Atmospheric dust opacity from Mars Climate Sounder.",
            "classification": None,
            "available": False,
            "reason": NOT_INGESTED,
            "default_opacity": 0.5,
        },
        {
            "id": "perseverance_traverse",
            "name": "Previous Rover Route (Perseverance)",
            "type": "polyline",
            "source": "Mars 2020 / Perseverance",
            "description": (
                "Coarse reference polyline for orientation and validation only. "
                "Not full mission telemetry."
            ),
            "classification": "MEASURED",
            "available": True,
            "reason": None,
            "default_opacity": 1.0,
        },
    ]

    return [
        LayerInfo(
            id=s["id"],
            name=s["name"],
            type=s["type"],
            source=s["source"],
            description=s["description"],
            classification=s["classification"],
            available=s["available"],
            unavailable_reason=None if s["available"] else s["reason"],
            default_opacity=s["default_opacity"],
        )
        for s in specs
    ]


@router.get("/layers", response_model=LayersResponse)
async def get_layers(data_service=Depends(get_data_service)):
    """List map layers with explicit availability.

    The client should drive its layer panel entirely from this response.
    Layers become available on their own as sources are ingested and tiles
    rendered, with no frontend change required.
    """
    return LayersResponse(
        data_mode=data_service.data_mode,
        layers=_build_layers(data_service),
    )
