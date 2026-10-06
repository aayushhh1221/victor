"""PATHWISE — Map tiles and region info router."""
from pathlib import Path
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import FileResponse
from ..models.schemas import RegionInfoResponse
from ..dependencies import get_data_service

router = APIRouter(prefix="/api/v1/map", tags=["map"])

TILES_BASE = Path(__file__).parent.parent / "data" / "tiles"


@router.get("/region", response_model=RegionInfoResponse)
async def get_region_info(data_service=Depends(get_data_service)):
    """Get region metadata and available data layers."""
    meta = data_service.metadata
    return RegionInfoResponse(
        region_name="Jezero Crater, Mars",
        lat_min=meta.lat_min,
        lat_max=meta.lat_max,
        lon_min=meta.lon_min,
        lon_max=meta.lon_max,
        grid_rows=meta.rows,
        grid_cols=meta.cols,
        cell_size_ns_m=meta.cell_size_ns_m,
        cell_size_ew_m=meta.cell_size_ew_m,
        cell_shape=meta.cell_shape,
        region_ns_km=meta.region_ns_km,
        region_ew_km=meta.region_ew_km,
        coordinate_system=meta.coordinate_system,
        data_mode=data_service.data_mode,
        available_layers=[
            "terrain", "elevation", "hazard", "science",
            "perseverance_traverse"
        ],
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


@router.get("/layers")
async def get_layers(data_service=Depends(get_data_service)):
    """List available map layers with metadata."""
    return {
        "layers": [
            {
                "id": "terrain",
                "name": "Base Terrain (HiRISE)",
                "type": "DISPLAY_ONLY",
                "source": "HiRISE/MRO",
                "description": "High-resolution surface imagery — display only, not used in routing",
            },
            {
                "id": "elevation",
                "name": "Elevation (MOLA)",
                "type": "VERIFIED_SNAPSHOT",
                "source": "MOLA/MGS",
                "description": "Mars Orbiter Laser Altimeter elevation data",
            },
            {
                "id": "hazard",
                "name": "Hazard Zones",
                "type": "MODEL_DERIVED",
                "source": "THEMIS+slope model",
                "description": "Composite hazard: 0.5*slope + 0.3*rock + 0.2*surface_dust_risk (THEMIS TI)",
            },
            {
                "id": "science",
                "name": "Science Targets (CRISM MODEL)",
                "type": "MODEL_DERIVED",
                "source": "CRISM/MRO tier model",
                "description": "Science Priority Score — MODEL, not direct measurement. Tier-based.",
            },
            {
                "id": "perseverance_traverse",
                "name": "Perseverance Traverse (Reference)",
                "type": "REFERENCE",
                "source": "Mars 2020 / Perseverance",
                "description": "Perseverance rover traverse for reference and validation only",
            },
        ]
    }
