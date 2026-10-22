"""API endpoint integration tests using FastAPI TestClient."""
import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.services.data_service import DataService
from backend.dependencies import init_services


@pytest.fixture(scope="module")
def client():
    # Ensure data service is initialized for the app
    ds = DataService()
    ds.load()
    init_services(ds)
    with TestClient(app) as c:
        yield c


class TestAPIEndpoints:
    def test_health_endpoint(self, client):
        resp = client.get("/api/v1/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert "data_mode" in data
        assert data["grid_loaded"] is True
        assert data["grid_shape"] == [300, 300]

    def test_map_region_endpoint(self, client):
        resp = client.get("/api/v1/map/region")
        assert resp.status_code == 200
        data = resp.json()
        assert data["grid_rows"] == 300
        assert data["grid_cols"] == 300
        assert "Jezero" in data["region_name"]
        assert len(data["available_layers"]) > 0

    def test_map_layers_endpoint(self, client):
        resp = client.get("/api/v1/map/layers")
        assert resp.status_code == 200
        data = resp.json()
        assert "layers" in data
        layer_ids = [l["id"] for l in data["layers"]]
        assert "terrain" in layer_ids
        assert "hazard" in layer_ids
        assert "science" in layer_ids

    def test_science_targets_endpoint(self, client):
        resp = client.get("/api/v1/science/targets")
        assert resp.status_code == 200
        data = resp.json()
        assert "targets" in data
        assert len(data["targets"]) >= 3
        assert "MODEL" in data.get("label", "")

    def test_routes_demo_endpoint(self, client):
        resp = client.get("/api/v1/routes/demo")
        assert resp.status_code == 200
        data = resp.json()
        assert "computation_id" in data
        assert "strategies" in data
        assert len(data["strategies"]) == 4
        assert "SAFEST" in data["strategies"]
        assert "FASTEST" in data["strategies"]
        assert "SCIENCE_RICHEST" in data["strategies"]
        assert "BALANCED" in data["strategies"]
        assert "pareto" in data
        assert "comparison" in data

    def test_routes_compute_and_evidence_lifecycle(self, client):
        req_body = {
            "start": {"lat": 18.44, "lon": 77.45},
            "destination": {"lat": 18.48, "lon": 77.24},
            "constraints": {
                "max_slope_deg": 20.0,
                "max_eva_hours": 6.0,
                "walking_speed_kmh": 3.0
            },
            "strategies": ["SAFEST", "FASTEST", "SCIENCE_RICHEST", "BALANCED"]
        }
        resp = client.post("/api/v1/routes/compute", json=req_body)
        assert resp.status_code == 200
        data = resp.json()
        comp_id = data["computation_id"]
        assert len(data["strategies"]) == 4

        # Test evidence endpoint for first segment
        ev_resp = client.get(f"/api/v1/routes/{comp_id}/segments/0/evidence?strategy=BALANCED")
        assert ev_resp.status_code == 200
        ev_data = ev_resp.json()
        assert "cost_breakdown" in ev_data
        assert "counterfactuals" in ev_data
        assert "confidence_per_layer" in ev_data
        # Categorical confidence verification (HIGH/MODERATE/LOW)
        for conf in ev_data["confidence_per_layer"].values():
            assert conf in ["HIGH", "MODERATE", "LOW"]

    def test_scenarios_compare_endpoint(self, client):
        # First get demo routes to ensure store is populated
        demo_resp = client.get("/api/v1/routes/demo")
        comp_id = demo_resp.json()["computation_id"]

        compare_req = {
            "base_computation_id": comp_id,
            "modifications": {
                "max_slope_deg": 15.0
            }
        }
        resp = client.post("/api/v1/scenarios/compare", json=compare_req)
        assert resp.status_code == 200
        diff_data = resp.json()
        assert "modified_computation_id" in diff_data
        assert "diffs" in diff_data
        assert "impact_summary" in diff_data

    def test_environment_current_endpoint(self, client):
        resp = client.get("/api/v1/environment/current")
        assert resp.status_code == 200
        env = resp.json()
        assert env["region"] == "Jezero Crater, Mars"
        assert env["surface_temperature_day_c"] is not None
        assert env["atmospheric_pressure_pa"] is not None
        assert env["dust_opacity_tau"] is not None
        assert "MEDA" in env["temperature_source"]
