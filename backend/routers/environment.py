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

    dust = data_service.optional_grid("dust")
    has_dust = dust is not None

    notes_parts = []
    if has_thermal:
        notes_parts.append(
            "THEMIS night-IR thermal index is available as a relative 0-1 proxy "
            "for thermal inertia (high = heat-retaining rock, low = loose dust "
            "or sand). It is NOT a temperature and is not convertible to one "
            "without the THEMIS emissivity and atmospheric correction chain."
        )
    else:
        notes_parts.append("No thermal data ingested.")

    notes_parts.append(
        "Absolute surface temperature, dust opacity and atmospheric pressure "
        "require MRO Mars Climate Sounder (MCS) data, which is not ingested. "
        "Those fields are null rather than estimated."
    )

    return EnvironmentResponse(
        region="Jezero Crater, Mars",
        data_mode=data_service.data_mode,
        # Deliberately null — see the docstring.
        surface_temperature_day_c=None,
        surface_temperature_night_c=None,
        temperature_source=None,
        thermal_index_mean=(
            round(float(np.nanmean(thermal)), 4) if has_thermal else None
        ),
        thermal_index_source=(
            "THEMIS Night IR controlled mosaic / 2001 Mars Odyssey"
            if has_thermal else None
        ),
        dust_opacity_tau=(round(float(np.nanmean(dust)), 4) if has_dust else None),
        dust_opacity_source="MCS / Mars Reconnaissance Orbiter" if has_dust else None,
        atmospheric_pressure_pa=None,
        pressure_source=None,
        notes=" ".join(notes_parts),
    )
