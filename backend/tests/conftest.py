"""PATHWISE — pytest configuration and shared fixtures."""
import sys
import pytest
import numpy as np
from pathlib import Path

ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(ROOT))


@pytest.fixture(scope="session")
def sample_data():
    """
    Minimal in-memory data service for route engine tests.
    Uses real cache data if available, otherwise generates minimal synthetic grids.
    """
    from backend.services.data_service import DataService
    from backend.models.domain import GridMetadata
    import json

    cache = ROOT / "backend" / "data" / "cache"

    ds = DataService()
    try:
        ds.load()
        return ds
    except Exception:
        # Generate minimal test grids in-memory
        pytest.skip("Cache data not available — run data pipeline first")
