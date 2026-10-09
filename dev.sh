#!/usr/bin/env bash
#
# VICTOR — start the local development stack.
#
# Thin wrapper around scripts/dev.py so the stack starts from the repository
# root regardless of where the shell happens to be. All arguments are forwarded:
#
#     ./dev.sh
#     ./dev.sh --backend-only
#     ./dev.sh --backend-port 8001 --open
#
set -euo pipefail
cd "$(dirname "$0")"

# `python` first: on Windows, `python3` is often a Microsoft Store stub that
# exists on PATH but refuses to run.
for candidate in python python3 py; do
  if command -v "$candidate" >/dev/null 2>&1; then
    exec "$candidate" scripts/dev.py "$@"
  fi
done

echo "Python 3.11+ was not found on PATH. Install it from https://www.python.org/downloads/" >&2
exit 1
