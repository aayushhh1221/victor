"""
VICTOR — Rebuild backend/data/cache/data_manifest.json hashes.

The manifest pins the SHA-256 of every committed cache file so the backend can
verify integrity at load time (DataService._load_manifest) and degrade to
DEMONSTRATION mode when anything is tampered with or stale. This script is how
the manifest stays true after a legitimate edit to a cache file — for example
the hand-transcribed MEDA environment JSON, the one cache input without a
reproducible pipeline script.

It recomputes the hash and size of every file already listed in the manifest
(files are never added or removed here — add new inputs to the manifest
deliberately), then rebuilds the manifest_id, which is the SHA-256 of the
per-file hashes concatenated in sorted-filename order. That derivation was
reverse-verified against the committed manifest, so the id stays meaningful for
cache keying and audit.

Usage (from the repository root):

    python scripts/update_manifest.py            # rewrite hashes + manifest_id
    python scripts/update_manifest.py --check    # exit 1 if anything drifted
"""
from __future__ import annotations

import hashlib
import json
import logging
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
MANIFEST_PATH = ROOT / "backend" / "data" / "cache" / "data_manifest.json"

logging.basicConfig(level=logging.INFO, format="%(levelname)s — %(message)s")
logger = logging.getLogger("victor.update_manifest")


def compute_file_hash(path: Path) -> tuple[str, int]:
    data = path.read_bytes()
    return hashlib.sha256(data).hexdigest(), len(data)


def derive_manifest_id(files: dict) -> str:
    """manifest_id = sha256 of the per-file hashes, filenames sorted."""
    ordered = "".join(files[name]["sha256"] for name in sorted(files))
    return hashlib.sha256(ordered.encode()).hexdigest()


def main() -> int:
    if not MANIFEST_PATH.exists():
        logger.error(f"No manifest at {MANIFEST_PATH}")
        return 1

    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    files: dict = manifest.get("files", {})
    cache_dir = MANIFEST_PATH.parent
    changed: list[str] = []

    for name in sorted(files):
        path = cache_dir / name
        if not path.exists():
            logger.error(f"Listed file missing on disk: {name} — fix the manifest by hand")
            return 1
        digest, size = compute_file_hash(path)
        if files[name].get("sha256") != digest or files[name].get("bytes") != size:
            changed.append(name)
        files[name]["sha256"] = digest
        files[name]["bytes"] = size

    manifest["files"] = files
    manifest["manifest_id"] = derive_manifest_id(files)

    if "--check" in sys.argv:
        if changed:
            logger.error(f"Stale entries: {changed}. Run scripts/update_manifest.py to refresh.")
            return 1
        logger.info("Manifest is current.")
        return 0

    if not changed:
        logger.info("All hashes already current; manifest_id unchanged.")
        return 0

    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    logger.info(f"Updated {len(changed)} entr{'y' if len(changed) == 1 else 'ies'}: {changed}")
    logger.info(f"New manifest_id: {manifest['manifest_id']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
