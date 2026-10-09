"""
VICTOR — Unsupervised terrain classification.

Groups the Jezero window into terrain archetypes using only real ingested NASA
measurements, with no labels and no hand-drawn boundaries:

    MOLA      slope, local roughness
    THEMIS    night-IR thermal inertia proxy
    CRISM     olivine (OLINDEX3) and carbonate (CINDEX2) indices

Two design decisions matter.

**It runs offline, not in the server.** Fitting happens here and only the
resulting integer label grid (`terrain_class.npy`) is committed. scikit-learn
therefore stays in requirements-pipeline.txt and never reaches the 512 MB
deployment instance. The classification is still genuinely unsupervised — it is
just computed once rather than per request, which also makes it deterministic.

**It is advisory, not authoritative.** The output is a map layer and a
human-readable label in segment evidence. It does NOT feed `traversability.npy`,
which stays driven by the documented MOLA slope bands, and it does not touch any
routing cost. The A*/Pareto engine remains the sole decision authority, so the
optimiser stays fully explainable.

Usage (from the repository root):

    python scripts/classify_terrain.py
    python scripts/classify_terrain.py --k 5        # force cluster count
    python scripts/classify_terrain.py --explain    # print per-cluster stats
"""
from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

CACHE = ROOT / "backend" / "data" / "cache"
CELL_NS_M = 177.5
CELL_EW_M = 187.1
CRISM_NODATA = -9999.0

# Candidate cluster counts. Below 3 the map says nothing useful; above 7 the
# archetypes stop being nameable, which defeats the purpose of the layer.
K_CANDIDATES = (3, 4, 5, 6, 7)

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s — %(message)s")
logger = logging.getLogger("victor.classify_terrain")


def load_features() -> tuple[np.ndarray, list[str], dict]:
    """Build the feature matrix from ingested grids.

    CRISM has ~34% swath gaps stored as -9999. Those are filled with the
    window median *for clustering only* — an unmeasured cell must not be
    treated as "no mineral", so the gap mask is kept and reported, and the
    label of a CRISM-gap cell is driven by its MOLA/THEMIS features.
    """
    required = ["slope", "thermal_proxy"]
    for name in required:
        if not (CACHE / f"{name}.npy").exists():
            logger.error(f"Missing {name}.npy — run scripts/fetch_nasa_data.py first.")
            sys.exit(2)

    slope = np.load(CACHE / "slope.npy").astype(np.float64)
    thermal = np.load(CACHE / "thermal_proxy.npy").astype(np.float64)
    elevation = np.load(CACHE / "elevation.npy").astype(np.float64)

    # Local roughness: standard deviation of elevation in a 3x3 neighbourhood.
    # Distinguishes blocky ejecta from smooth sediment at the same slope.
    from scipy.ndimage import generic_filter
    roughness = generic_filter(elevation, np.std, size=3, mode="nearest")

    features = [slope, roughness, thermal]
    names = ["mola_slope_deg", "mola_roughness_m", "themis_thermal_proxy"]

    crism_gap = np.zeros(slope.shape, dtype=bool)
    for grid_name, label in [
        ("olivine_index", "crism_olivine_olindex3"),
        ("carbonate_index", "crism_carbonate_cindex2"),
    ]:
        path = CACHE / f"{grid_name}.npy"
        if not path.exists():
            logger.warning(f"{grid_name}.npy absent — clustering without it.")
            continue
        arr = np.load(path).astype(np.float64)
        gap = arr <= CRISM_NODATA
        crism_gap |= gap
        valid = arr[~gap]
        fill = float(np.median(valid)) if valid.size else 0.0
        features.append(np.where(gap, fill, arr))
        names.append(label)

    stack = np.stack([f.ravel() for f in features], axis=1)
    meta = {
        "crism_gap_fraction": round(float(crism_gap.mean()), 4),
        "shape": list(slope.shape),
    }
    logger.info(f"Features: {', '.join(names)}")
    logger.info(f"CRISM swath gaps cover {meta['crism_gap_fraction'] * 100:.0f}% of cells")
    return stack, names, meta


def choose_k(X: np.ndarray, forced: int | None) -> tuple[int, dict[int, float]]:
    """Pick the cluster count by silhouette score.

    Scored on a subsample — silhouette is O(n^2) and 90,000 cells would be
    needlessly slow for a decision between five candidates.
    """
    from sklearn.cluster import KMeans
    from sklearn.metrics import silhouette_score

    if forced:
        logger.info(f"Using forced k={forced}")
        return forced, {}

    rng = np.random.default_rng(42)
    idx = rng.choice(X.shape[0], size=min(6000, X.shape[0]), replace=False)
    sample = X[idx]

    scores: dict[int, float] = {}
    for k in K_CANDIDATES:
        labels = KMeans(n_clusters=k, n_init=10, random_state=42).fit_predict(sample)
        scores[k] = float(silhouette_score(sample, labels))
        logger.info(f"  k={k}  silhouette={scores[k]:.4f}")

    best = max(scores, key=scores.get)
    logger.info(f"Chosen k={best} (highest silhouette)")
    return best, scores


def name_clusters(centroids: np.ndarray, names: list[str]) -> list[str]:
    """Assign readable archetype names from each cluster's centroid.

    Thresholds are ABSOLUTE and physical, not relative to the other clusters.
    An earlier median-relative version produced names like "Steep rocky slope"
    for a 2.4-degree centroid — technically "steeper than the others", but
    plainly wrong to a reader and indefensible to a reviewer.

    Slope bands reuse the traversability thresholds already documented in
    docs/nasa-data-catalog.md (easy below 5 degrees, harder to 15, severe
    beyond). Thermal inertia bands follow the standard interpretation: high
    night-IR retention indicates rock, low indicates dust or loose sand.
    """
    i_slope = names.index("mola_slope_deg")
    i_rough = names.index("mola_roughness_m")
    i_therm = names.index("themis_thermal_proxy")
    i_ol = names.index("crism_olivine_olindex3") if "crism_olivine_olindex3" in names else None
    i_cb = names.index("crism_carbonate_cindex2") if "crism_carbonate_cindex2" in names else None

    # Roughness is scene-dependent (metres of local elevation spread), so
    # "blocky" is judged against this window's own upper quartile rather than
    # an absolute metre value that would not transfer to another region.
    rough_hi = float(np.percentile(centroids[:, i_rough], 75))

    labels: list[str] = []
    for c in centroids:
        slope, rough, therm = c[i_slope], c[i_rough], c[i_therm]

        # Landform, from absolute slope.
        if slope < 5.0:
            form = "plain"
        elif slope < 15.0:
            form = "slope"
        else:
            form = "steep scarp"

        # Surface character, from absolute thermal inertia proxy.
        if therm > 0.60:
            surface = "Bedrock"
        elif therm >= 0.40:
            surface = "Mixed-regolith"
        else:
            surface = "Sand-mantled"

        name = f"{surface} {form}"
        if rough > rough_hi and form != "steep scarp":
            name = f"Blocky {surface.lower()} {form}"

        # Mineral qualifier only where CRISM measured a genuinely elevated index
        # for this cluster relative to the others.
        if i_ol is not None and i_cb is not None:
            ol_hi = float(np.percentile(centroids[:, i_ol], 70))
            cb_hi = float(np.percentile(centroids[:, i_cb], 70))
            if c[i_ol] >= ol_hi and c[i_ol] > 0:
                name += " (olivine-bearing)"
            elif c[i_cb] >= cb_hi and c[i_cb] > 0:
                name += " (carbonate-bearing)"

        labels.append(name)

    # Disambiguate any duplicate names so each cluster id stays distinguishable.
    seen: dict[str, int] = {}
    unique: list[str] = []
    for name in labels:
        if name in seen:
            seen[name] += 1
            unique.append(f"{name} {seen[name] + 1}")
        else:
            seen[name] = 0
            unique.append(name)
    return unique


def main() -> int:
    parser = argparse.ArgumentParser(description="Classify Jezero terrain (unsupervised).")
    parser.add_argument("--k", type=int, default=None, help="Force cluster count.")
    parser.add_argument("--explain", action="store_true", help="Print per-cluster statistics.")
    args = parser.parse_args()

    from sklearn.cluster import KMeans
    from sklearn.preprocessing import StandardScaler

    X_raw, names, meta = load_features()

    # Standardise: slope is in degrees, roughness in metres, the indices are
    # unitless. Without this, whichever feature has the largest numeric range
    # would dominate the distance metric.
    scaler = StandardScaler()
    X = scaler.fit_transform(X_raw)

    k, scores = choose_k(X, args.k)

    model = KMeans(n_clusters=k, n_init=20, random_state=42)
    labels_flat = model.fit_predict(X)
    rows, cols = meta["shape"]
    labels = labels_flat.reshape(rows, cols).astype(np.int16)

    # Centroids back in real units, so the names and the report are physical.
    centroids = scaler.inverse_transform(model.cluster_centers_)
    class_names = name_clusters(centroids, names)

    classes = []
    for cid in range(k):
        mask = labels_flat == cid
        entry = {
            "id": cid,
            "name": class_names[cid],
            "cell_count": int(mask.sum()),
            "fraction": round(float(mask.mean()), 4),
            "centroid": {n: round(float(v), 4) for n, v in zip(names, centroids[cid])},
        }
        classes.append(entry)
        logger.info(
            f"  [{cid}] {entry['name']:42s} {entry['fraction'] * 100:5.1f}%  "
            f"slope={entry['centroid']['mola_slope_deg']:.1f}deg  "
            f"thermal={entry['centroid']['themis_thermal_proxy']:.2f}"
        )

    if args.explain:
        print(json.dumps(classes, indent=2))

    np.save(CACHE / "terrain_class.npy", labels)
    (CACHE / "terrain_classes.json").write_text(
        json.dumps(
            {
                "method": "k-means (unsupervised)",
                "k": k,
                "k_selection": "highest silhouette score" if scores else "forced",
                "silhouette_scores": scores,
                "features": names,
                "crism_gap_fraction": meta["crism_gap_fraction"],
                "classes": classes,
                "caveats": [
                    "Advisory only. Does not affect routing cost, traversability "
                    "or route ranking — the A*/Pareto engine is unchanged.",
                    "Cluster names are interpretations of centroid physics, not "
                    "published geological unit assignments.",
                    f"CRISM gaps cover {meta['crism_gap_fraction'] * 100:.0f}% of "
                    "cells; those cells are clustered on MOLA and THEMIS features "
                    "alone, with mineral features filled at the window median.",
                ],
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    logger.info(f"Wrote terrain_class.npy ({k} classes) + terrain_classes.json")
    return 0


if __name__ == "__main__":
    sys.exit(main())
