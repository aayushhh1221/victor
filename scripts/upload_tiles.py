"""
VICTOR — Upload the map tile pyramid to Supabase Storage.

Why this exists: Render's filesystem is ephemeral. Tiles served from the API
instance disappear on every redeploy, so the map renders empty in production.
Storage also puts tiles on a CDN, which is strictly better than streaming ~8,000
PNGs through a 0.1-shared-CPU instance and its bandwidth allowance.

Volume: 8,185 PNGs, ~127 MB, against the free tier's 1 GB cap.

Usage (from the repository root):

    # one-time: create the bucket and upload everything
    python scripts/upload_tiles.py --create-bucket

    # resume an interrupted run (skips what is already uploaded)
    python scripts/upload_tiles.py

    # see what would happen without uploading
    python scripts/upload_tiles.py --dry-run

    # re-upload everything, ignoring the local manifest
    python scripts/upload_tiles.py --force

Required environment (or a .env file at the repository root):

    SUPABASE_URL          https://<project-ref>.supabase.co
    SUPABASE_SERVICE_KEY  the service_role key — NOT the anon key

The service key bypasses Row Level Security and must never reach the frontend.
It is read from the environment and never written to the manifest or logs.

After uploading, set this on the web service so the browser loads tiles from
the CDN instead of the API:

    NEXT_PUBLIC_TILE_BASE_URL=https://<project-ref>.supabase.co/storage/v1/object/public/<bucket>
"""
from __future__ import annotations

import argparse
import json
import logging
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

TILES_DIR = ROOT / "backend" / "data" / "tiles"
MANIFEST_PATH = TILES_DIR / ".upload_manifest.json"
DEFAULT_BUCKET = "victor-tiles"

# Concurrency. Each upload is a small PUT dominated by round-trip latency, so
# parallelism helps a lot; too much invites rate limiting on the free tier.
DEFAULT_WORKERS = 12

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s — %(message)s")
logger = logging.getLogger("victor.upload_tiles")


def load_env() -> None:
    """Load a repository-root .env if present, without overriding real env vars."""
    env_path = ROOT / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip())


def require_credentials() -> tuple[str, str]:
    load_env()
    url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_KEY", "")
    if not url or not key:
        logger.error(
            "SUPABASE_URL and SUPABASE_SERVICE_KEY must be set (environment or .env). "
            "Use the service_role key, not the anon key."
        )
        sys.exit(2)
    return url, key


def discover_tiles() -> list[tuple[Path, str]]:
    """Return (local_path, storage_path) for every PNG in the pyramid.

    Storage paths mirror the on-disk layout (`<layer>/<z>/<x>/<y>.png`) so the
    frontend's tile URL template needs only a different base, not different
    structure.
    """
    if not TILES_DIR.is_dir():
        logger.error(f"No tiles at {TILES_DIR}. Run scripts/generate_tiles.py first.")
        sys.exit(2)

    found: list[tuple[Path, str]] = []
    for path in sorted(TILES_DIR.rglob("*.png")):
        rel = path.relative_to(TILES_DIR).as_posix()
        found.append((path, rel))
    return found


def read_manifest() -> set[str]:
    """Storage paths already uploaded, for fast resume.

    A local manifest is used rather than listing the bucket because listing
    8,000+ objects is slow and paginated, and this script's job is to be
    re-runnable cheaply. `--force` ignores it, and uploads use upsert, so a
    stale manifest can never produce a corrupt bucket — only redundant work.
    """
    if not MANIFEST_PATH.exists():
        return set()
    try:
        return set(json.loads(MANIFEST_PATH.read_text(encoding="utf-8")).get("uploaded", []))
    except (json.JSONDecodeError, OSError):
        logger.warning("Manifest unreadable; treating as empty.")
        return set()


def write_manifest(uploaded: set[str], bucket: str) -> None:
    MANIFEST_PATH.write_text(
        json.dumps(
            {"bucket": bucket, "count": len(uploaded), "uploaded": sorted(uploaded)},
            indent=0,
        ),
        encoding="utf-8",
    )


def create_bucket(base_url: str, key: str, bucket: str) -> None:
    """Create a public bucket. Harmless if it already exists."""
    import requests

    resp = requests.post(
        f"{base_url}/storage/v1/bucket",
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        json={
            "id": bucket,
            "name": bucket,
            "public": True,
            "file_size_limit": 5 * 1024 * 1024,
            "allowed_mime_types": ["image/png"],
        },
        timeout=30,
    )
    if resp.status_code in (200, 201):
        logger.info(f"Created public bucket '{bucket}'.")
    elif resp.status_code == 409 or "already exists" in resp.text.lower():
        logger.info(f"Bucket '{bucket}' already exists — continuing.")
    else:
        logger.error(f"Could not create bucket: HTTP {resp.status_code} {resp.text[:200]}")
        sys.exit(1)


def upload_one(session, base_url: str, key: str, bucket: str,
               local: Path, storage_path: str) -> tuple[str, bool, str]:
    """Upload a single tile. Returns (storage_path, ok, detail)."""
    try:
        data = local.read_bytes()
    except OSError as exc:
        return storage_path, False, f"read failed: {exc}"

    try:
        resp = session.post(
            f"{base_url}/storage/v1/object/{bucket}/{storage_path}",
            headers={
                "Authorization": f"Bearer {key}",
                "Content-Type": "image/png",
                "Cache-Control": "public, max-age=31536000, immutable",
                # Tiles are regenerated wholesale, so overwriting is always the
                # intent; this also makes re-runs idempotent.
                "x-upsert": "true",
            },
            data=data,
            timeout=60,
        )
    except Exception as exc:
        return storage_path, False, f"{type(exc).__name__}: {exc}"

    if resp.status_code in (200, 201):
        return storage_path, True, ""
    return storage_path, False, f"HTTP {resp.status_code} {resp.text[:120]}"


def main() -> int:
    parser = argparse.ArgumentParser(description="Upload map tiles to Supabase Storage.")
    parser.add_argument("--bucket", default=DEFAULT_BUCKET)
    parser.add_argument("--workers", type=int, default=DEFAULT_WORKERS)
    parser.add_argument("--create-bucket", action="store_true",
                        help="Create the bucket (public) before uploading.")
    parser.add_argument("--force", action="store_true",
                        help="Re-upload everything, ignoring the local manifest.")
    parser.add_argument("--dry-run", action="store_true",
                        help="Report what would be uploaded and exit.")
    parser.add_argument("--limit", type=int, default=0,
                        help="Upload at most N tiles (for a smoke test).")
    args = parser.parse_args()

    tiles = discover_tiles()
    total_bytes = sum(p.stat().st_size for p, _ in tiles)
    logger.info(f"Found {len(tiles)} tiles, {total_bytes / 1e6:.1f} MB")

    already = set() if args.force else read_manifest()
    pending = [(p, s) for p, s in tiles if s not in already]
    if args.limit:
        pending = pending[: args.limit]

    logger.info(f"Already uploaded: {len(already)} · pending: {len(pending)}")
    if total_bytes > 1_000_000_000:
        logger.warning(
            f"{total_bytes / 1e9:.2f} GB exceeds the Supabase free tier's 1 GB cap."
        )

    if args.dry_run:
        for _, s in pending[:10]:
            logger.info(f"  would upload {s}")
        if len(pending) > 10:
            logger.info(f"  … and {len(pending) - 10} more")
        logger.info("--dry-run: nothing uploaded.")
        return 0

    if not pending:
        logger.info("Nothing to upload. Bucket is up to date.")
        return 0

    base_url, key = require_credentials()
    if args.create_bucket:
        create_bucket(base_url, key, args.bucket)

    import requests
    session = requests.Session()

    uploaded = set(already)
    failures: list[tuple[str, str]] = []
    start = time.perf_counter()
    done = 0

    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {
            pool.submit(upload_one, session, base_url, key, args.bucket, p, s): s
            for p, s in pending
        }
        for fut in as_completed(futures):
            storage_path, ok, detail = fut.result()
            done += 1
            if ok:
                uploaded.add(storage_path)
            else:
                failures.append((storage_path, detail))
            if done % 250 == 0 or done == len(pending):
                rate = done / max(time.perf_counter() - start, 1e-6)
                logger.info(
                    f"  {done}/{len(pending)} · {rate:.0f}/s · {len(failures)} failed"
                )
            # Persist progress periodically so a crash does not lose the run.
            if done % 1000 == 0:
                write_manifest(uploaded, args.bucket)

    write_manifest(uploaded, args.bucket)
    elapsed = time.perf_counter() - start
    logger.info(f"Uploaded {len(pending) - len(failures)} tiles in {elapsed:.0f}s")

    if failures:
        logger.error(f"{len(failures)} uploads failed. First few:")
        for path, detail in failures[:5]:
            logger.error(f"  {path}: {detail}")
        logger.error("Re-run to retry only the failures (the manifest records successes).")
        return 1

    public_base = f"{base_url}/storage/v1/object/public/{args.bucket}"
    logger.info("Done. Set this on the web service:")
    logger.info(f"  NEXT_PUBLIC_TILE_BASE_URL={public_base}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
