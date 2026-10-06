"""PATHWISE — FastAPI dependency injection."""
from functools import lru_cache
from .services.data_service import DataService
from .services.route_engine import RouteEngine
from .services.evidence_engine import EvidenceEngine
from .services.scenario_engine import ScenarioEngine

# Singleton instances (loaded once at startup)
_data_service: DataService | None = None
_route_engine: RouteEngine | None = None
_evidence_engine: EvidenceEngine | None = None
_scenario_engine: ScenarioEngine | None = None


def init_services(data_service: DataService) -> None:
    """Called at startup after grids are loaded."""
    global _data_service, _route_engine, _evidence_engine, _scenario_engine
    _data_service = data_service
    _route_engine = RouteEngine(data_service)
    _evidence_engine = EvidenceEngine(data_service)
    _scenario_engine = ScenarioEngine(data_service)


def get_data_service() -> DataService:
    if _data_service is None:
        raise RuntimeError("DataService not initialized")
    return _data_service


def get_route_engine() -> RouteEngine:
    if _route_engine is None:
        raise RuntimeError("RouteEngine not initialized")
    return _route_engine


def get_evidence_engine() -> EvidenceEngine:
    if _evidence_engine is None:
        raise RuntimeError("EvidenceEngine not initialized")
    return _evidence_engine


def get_scenario_engine() -> ScenarioEngine:
    if _scenario_engine is None:
        raise RuntimeError("ScenarioEngine not initialized")
    return _scenario_engine
