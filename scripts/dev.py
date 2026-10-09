"""
VICTOR — One-command local development server.

Starts both halves of the stack and streams their logs into a single terminal:

  * FastAPI backend .... http://localhost:8000  (launched as a package from the
                         repository root, which backend/main.py requires)
  * Next.js frontend ... http://localhost:3000

The environment is preflighted first — Node/npm on PATH, Python dependencies
importable, frontend packages installed, data grids on disk — and whatever is
missing gets installed, rather than failing half-started. Ctrl+C stops both
servers and any processes they spawned.

Usage (from anywhere — paths resolve against the repository root):

    python scripts/dev.py                       # both servers
    python scripts/dev.py --backend-only
    python scripts/dev.py --frontend-only
    python scripts/dev.py --backend-port 8001   # the frontend is told the new port
    python scripts/dev.py --host 0.0.0.0        # reachable from other devices
    python scripts/dev.py --open                # open a browser once ready
    python scripts/dev.py --no-install          # fail instead of installing

Why this exists: the stack needs two servers running at once, the backend only
imports correctly when launched from the repository root, and the frontend has to
be told which port the backend is on. Getting any one of those wrong yields a
page that loads but cannot fetch anything, so the sequence lives here instead of
in a list of README steps.
"""
import argparse
import importlib.util
import logging
import os
import shutil
import signal
import socket
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
import webbrowser
from pathlib import Path

ROOT = Path(__file__).parent.parent
FRONTEND_DIR = ROOT / "frontend"
CACHE_DIR = ROOT / "backend" / "data" / "cache"
IS_WINDOWS = os.name == "nt"

# The Windows console defaults to cp1252, which cannot encode the em-dashes in
# our own log format or the ▲ that `next dev` prints — and an encode error in a
# streaming thread would silence that server's logs for the rest of the session.
for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure"):
        _stream.reconfigure(encoding="utf-8", errors="replace")

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s — %(message)s")
logger = logging.getLogger("victor.dev")

# Serialises the two streaming threads so their lines cannot interleave.
_output_lock = threading.Lock()

# Mirrors scripts/bootstrap.py — the files DataService refuses to boot without.
REQUIRED_GRIDS = [
    "elevation.npy",
    "slope.npy",
    "traversability.npy",
    "hazard.npy",
    "science_value.npy",
    "grid_metadata.json",
    "science_targets.json",
    "provenance.json",
]

# Import names, not distribution names — what the backend actually does at boot.
REQUIRED_MODULES = {
    "fastapi": "fastapi",
    "uvicorn": "uvicorn",
    "pydantic_settings": "pydantic-settings",
    "numpy": "numpy",
}


class Style:
    """ANSI colours, blanked out when the stream cannot render them."""

    def __init__(self, enabled: bool) -> None:
        self.backend = "\033[36m" if enabled else ""
        self.frontend = "\033[35m" if enabled else ""
        self.bold = "\033[1m" if enabled else ""
        self.dim = "\033[2m" if enabled else ""
        self.reset = "\033[0m" if enabled else ""


def grids_present() -> bool:
    """True when every grid and metadata file the DataService requires exists."""
    return all((CACHE_DIR / name).exists() for name in REQUIRED_GRIDS)


def port_in_use(port: int, host: str = "127.0.0.1") -> bool:
    """True when something is already listening — checked before we try to bind."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.5)
        return sock.connect_ex((host, port)) == 0


def npm_command(args: list[str]) -> list[str] | None:
    """
    An npm invocation that works on POSIX and Windows alike.

    On Windows npm is a .cmd shim, which CreateProcess will not always launch
    directly, so it is routed through the command interpreter.
    """
    npm = shutil.which("npm")
    if npm is None:
        return None
    if IS_WINDOWS and npm.lower().endswith((".cmd", ".bat")):
        return ["cmd", "/c", npm, *args]
    return [npm, *args]


def spawn(cmd: list[str], cwd: Path, env: dict[str, str]) -> subprocess.Popen:
    """
    Start a child with its own process group and merged, line-buffered output.

    The separate group means our Ctrl+C does not race the child's own signal
    handling; shutdown is driven explicitly by terminate() instead.
    """
    kwargs: dict = {}
    if IS_WINDOWS:
        kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP
    else:
        kwargs["start_new_session"] = True
    return subprocess.Popen(
        cmd,
        cwd=str(cwd),
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        **kwargs,
    )


def stream_output(proc: subprocess.Popen, label: str, colour: str, reset: str) -> None:
    """
    Forward a child's output to our stdout, one labelled line at a time.

    Bytes are normalised to UTF-8 and written to the raw buffer rather than
    passed through print(), so a character the console's native codepage cannot
    represent degrades to a replacement glyph instead of killing this thread.
    """
    if proc.stdout is None:
        return
    prefix = f"{colour}[{label}]{reset} ".encode("utf-8")
    out = sys.stdout.buffer
    for raw in iter(proc.stdout.readline, b""):
        line = raw.decode("utf-8", errors="replace").rstrip()
        if line:
            with _output_lock:
                out.write(prefix + line.encode("utf-8", errors="replace") + b"\n")
                out.flush()


def terminate(proc: subprocess.Popen, label: str) -> None:
    """
    Stop a child and everything it spawned.

    `next dev` forks workers that keep port 3000 bound if only the parent is
    signalled, so the whole tree is taken down.
    """
    if proc.poll() is not None:
        return
    logger.info(f"Stopping {label}...")
    if IS_WINDOWS:
        subprocess.run(
            ["taskkill", "/F", "/T", "/PID", str(proc.pid)],
            capture_output=True,
        )
    else:
        try:
            os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
        except (ProcessLookupError, PermissionError):
            proc.terminate()
    try:
        proc.wait(timeout=10)
    except subprocess.TimeoutExpired:
        proc.kill()


def run_install(cmd: list[str], cwd: Path, description: str) -> None:
    """Run an install step, failing loudly rather than starting a broken stack."""
    logger.info(f"{description}...")
    result = subprocess.run(cmd, cwd=str(cwd))
    if result.returncode != 0:
        logger.error(f"{description} failed with exit code {result.returncode}.")
        sys.exit(result.returncode)


def preflight(need_backend: bool, need_frontend: bool, install: bool) -> None:
    """Verify — and where possible repair — everything the servers depend on."""
    if need_backend:
        missing = [
            dist
            for module, dist in REQUIRED_MODULES.items()
            if importlib.util.find_spec(module) is None
        ]
        if missing:
            if not install:
                logger.error(
                    f"Missing Python packages: {', '.join(missing)}. "
                    "Install them with: pip install -r backend/requirements.txt"
                )
                sys.exit(1)
            run_install(
                [sys.executable, "-m", "pip", "install", "-r",
                 str(ROOT / "backend" / "requirements.txt")],
                ROOT,
                "Installing backend dependencies",
            )

        if not grids_present():
            logger.error(
                "Data grids are missing from backend/data/cache — the backend "
                "cannot serve routes without them. Generate them with:\n"
                "    python scripts/bootstrap.py --skip-tiles"
            )
            sys.exit(1)

    if need_frontend:
        if npm_command(["--version"]) is None:
            logger.error(
                "npm was not found on PATH. Install Node.js 18+ from "
                "https://nodejs.org and reopen your terminal."
            )
            sys.exit(1)

        if not (FRONTEND_DIR / "node_modules").is_dir():
            if not install:
                logger.error(
                    "frontend/node_modules is missing. Install it with: "
                    "cd frontend && npm install"
                )
                sys.exit(1)
            run_install(
                npm_command(["install"]),  # type: ignore[arg-type]
                FRONTEND_DIR,
                "Installing frontend dependencies (first run only)",
            )


def wait_for_backend(proc: subprocess.Popen, port: int, timeout: float = 120.0) -> bool:
    """
    Poll /api/v1/health until the backend answers.

    Loading the grids takes a moment, and the frontend's first fetch should not
    land before then. Returns False if the process dies or the wait times out.
    """
    url = f"http://127.0.0.1:{port}/api/v1/health"
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if proc.poll() is not None:
            return False
        try:
            with urllib.request.urlopen(url, timeout=3) as response:
                if response.status == 200:
                    return True
        except (urllib.error.URLError, OSError):
            pass
        time.sleep(0.5)
    return False


def check_ports(ports: dict[str, int]) -> None:
    """Refuse to start when a port is taken, naming which one and why."""
    taken = {label: port for label, port in ports.items() if port_in_use(port)}
    if not taken:
        return
    for label, port in taken.items():
        logger.error(f"Port {port} ({label}) is already in use.")
    hint = (
        'netstat -ano | findstr :PORT    (then: taskkill /F /PID <pid>)'
        if IS_WINDOWS
        else 'lsof -ti :PORT | xargs kill'
    )
    logger.error(
        "Stop the process using it, or pick another port with "
        "--backend-port / --frontend-port.\n"
        f"    Find it with: {hint}"
    )
    sys.exit(1)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Run the VICTOR stack on localhost.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--backend-only", action="store_true",
                        help="Start only the FastAPI backend.")
    parser.add_argument("--frontend-only", action="store_true",
                        help="Start only the Next.js frontend.")
    parser.add_argument("--backend-port", type=int, default=8000,
                        help="Backend port (default: 8000).")
    parser.add_argument("--frontend-port", type=int, default=3000,
                        help="Frontend port (default: 3000).")
    parser.add_argument("--host", default="127.0.0.1",
                        help="Bind address. Use 0.0.0.0 to expose on your "
                             "network (default: 127.0.0.1).")
    parser.add_argument("--no-reload", action="store_true",
                        help="Disable backend auto-reload on file changes.")
    parser.add_argument("--no-install", action="store_true",
                        help="Fail on missing dependencies instead of installing.")
    parser.add_argument("--no-color", action="store_true",
                        help="Disable coloured log prefixes.")
    parser.add_argument("--open", action="store_true",
                        help="Open the app in a browser once the stack is up.")
    args = parser.parse_args()

    if args.backend_only and args.frontend_only:
        parser.error("--backend-only and --frontend-only are mutually exclusive.")

    need_backend = not args.frontend_only
    need_frontend = not args.backend_only
    style = Style(enabled=not args.no_color and sys.stdout.isatty())

    preflight(need_backend, need_frontend, install=not args.no_install)

    wanted = {}
    if need_backend:
        wanted["backend"] = args.backend_port
    if need_frontend:
        wanted["frontend"] = args.frontend_port
    check_ports(wanted)

    procs: list[tuple[str, subprocess.Popen]] = []
    threads: list[threading.Thread] = []

    def watch(proc: subprocess.Popen, label: str, colour: str) -> None:
        thread = threading.Thread(
            target=stream_output,
            args=(proc, label, colour, style.reset),
            daemon=True,
        )
        thread.start()
        threads.append(thread)

    try:
        if need_backend:
            cmd = [
                sys.executable, "-u", "-m", "uvicorn", "backend.main:app",
                "--host", args.host, "--port", str(args.backend_port),
            ]
            if not args.no_reload:
                cmd.append("--reload")
            logger.info(f"Starting backend on http://localhost:{args.backend_port}")
            # PYTHONIOENCODING fixes the mangled em-dashes in the backend's own
            # log format at source, rather than relying on our replacement pass.
            backend = spawn(cmd, ROOT, {
                **os.environ,
                "PYTHONUNBUFFERED": "1",
                "PYTHONIOENCODING": "utf-8",
            })
            procs.append(("backend", backend))
            watch(backend, "backend", style.backend)

            if not wait_for_backend(backend, args.backend_port):
                logger.error(
                    "Backend did not become healthy. See the [backend] output above."
                )
                raise SystemExit(1)
            logger.info("Backend is healthy.")

        if need_frontend:
            # Shell variables outrank .env.local in Next.js, so this keeps the
            # client pointed at whichever backend port is actually in use.
            env = {
                **os.environ,
                "NEXT_PUBLIC_API_URL": f"http://localhost:{args.backend_port}",
                "BROWSER": "none",
            }
            cmd = npm_command(
                ["run", "dev", "--", "--port", str(args.frontend_port),
                 "--hostname", args.host]
            )
            logger.info(f"Starting frontend on http://localhost:{args.frontend_port}")
            frontend = spawn(cmd, FRONTEND_DIR, env)  # type: ignore[arg-type]
            procs.append(("frontend", frontend))
            watch(frontend, "frontend", style.frontend)

        app_url = (
            f"http://localhost:{args.frontend_port}"
            if need_frontend
            else f"http://localhost:{args.backend_port}/docs"
        )
        print(
            f"\n{style.bold}  VICTOR is running{style.reset}\n"
            f"    App ......... {app_url}\n"
            + (
                f"    API docs .... http://localhost:{args.backend_port}/docs\n"
                f"    Health ...... http://localhost:{args.backend_port}"
                "/api/v1/health\n"
                if need_backend
                else ""
            )
            + f"\n  {style.dim}Ctrl+C to stop{style.reset}\n",
            flush=True,
        )

        if args.open:
            webbrowser.open(app_url)

        # Exit as soon as either server dies, so a crash is not mistaken for a
        # working stack with one half silently missing.
        while True:
            for label, proc in procs:
                code = proc.poll()
                if code is not None:
                    logger.error(f"{label} exited with code {code}.")
                    raise SystemExit(code or 1)
            time.sleep(0.5)

    except KeyboardInterrupt:
        print()
        logger.info("Shutting down.")
    finally:
        for label, proc in reversed(procs):
            terminate(proc, label)
        for thread in threads:
            thread.join(timeout=2)
        logger.info("All servers stopped.")


if __name__ == "__main__":
    main()
