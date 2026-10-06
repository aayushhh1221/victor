import json

with open("backend/data/demo/precomputed_routes.json") as f:
    d = json.load(f)

for name, r in d["strategies"].items():
    m = r["metrics"]
    print(f"{name}:")
    print(f"  distance_km: {m['distance_km']}")
    print(f"  estimated_time_hours: {m['estimated_time_hours']}")
    print(f"  total_science_value: {m['total_science_value']}")
    print(f"  avg_hazard_score: {m['avg_hazard_score']}")
    print(f"  pareto_status: {r['pareto_status']}")
    print(f"  nearby_targets: {[t['name'] for t in r['science_targets_nearby']]}")

print("\nComparison:", d["comparison"])
