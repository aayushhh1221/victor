"""VICTOR — Environmental and atmospheric conditions router."""
import numpy as np
from fastapi import APIRouter, Depends

from ..models.schemas import EnvironmentResponse
from ..models.enums import DataMode
from ..dependencies import get_data_service

router = APIRouter(prefix="/api/v1/environment", tags=["environment"])


@router.get("/current", response_model=EnvironmentResponse)
async def get_current_environment(data_service=Depends(get_data_service)):
    """Environmental conditions for the study region.

    Design rule: a quantity VICTOR cannot derive from ingested NASA data is
    returned as `null`, never as a plausible-looking number. The client renders
    nulls as "not available" with the source string explaining why.

    What is currently derivable:
      - `thermal_index_mean`: a unitless 0-1 index from THEMIS night-IR
        brightness. This is a thermal inertia PROXY, not a temperature.

    What is not:
      - Absolute surface temperature in degrees Celsius. Converting night-IR
        brightness to kelvin requires the emissivity and atmospheric correction
        chain from the THEMIS temperature products, which are not ingested.
        Publishing a number here without that chain would be fabrication.
      - Dust opacity. Requires MCS atmospheric data, not ingested.
      - Atmospheric pressure. Requires MCS or lander meteorology, not ingested.
    """
    thermal = data_service.optional_grid("thermal_proxy")
    has_thermal = thermal is not None

    meda = data_service.meda_environment
    params = meda.get("parameters", {}) if meda else {}

    notes_parts = []
    if params:
        notes_parts.append(
            "Surface temperature, dust optical depth, and atmospheric pressure are in-situ "
            "measurements from the NASA Mars 2020 Perseverance MEDA instrument suite at Jezero Crater "
            "(PDS Atmospheres Node, urn:nasa:pds:mars2020_meda). These are archived sol-composite "
            "values HAND-TRANSCRIBED from that bundle — the one VICTOR input without a reproducible "
            "ingestion script — not a live feed."
        )
    if has_thermal:
        notes_parts.append(
            "THEMIS night-IR thermal index provides a relative 0-1 proxy for thermal inertia "
            "(high = heat-retaining rock, low = loose dust or sand)."
        )

    return EnvironmentResponse(
        region="Jezero Crater, Mars",
        data_mode=data_service.data_mode,
        surface_temperature_day_c=params.get("surface_temperature_day_c") if params else None,
        surface_temperature_night_c=params.get("surface_temperature_night_c") if params else None,
        temperature_source=(
            params.get("temperature_source")
            if (params and params.get("surface_temperature_day_c") is not None)
            else None
        ),
        thermal_index_mean=(
            round(float(np.nanmean(thermal)), 4) if has_thermal else None
        ),
        thermal_index_source=(
            "THEMIS Night IR controlled mosaic / 2001 Mars Odyssey"
            if has_thermal else None
        ),
        dust_opacity_tau=params.get("dust_opacity_tau") if params else None,
        dust_opacity_source=(
            params.get("dust_opacity_source")
            if (params and params.get("dust_opacity_tau") is not None)
            else None
        ),
        atmospheric_pressure_pa=params.get("atmospheric_pressure_pa") if params else None,
        pressure_source=(
            params.get("pressure_source")
            if (params and params.get("atmospheric_pressure_pa") is not None)
            else None
        ),
        notes=" ".join(notes_parts),
    )
