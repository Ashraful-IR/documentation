#!/usr/bin/env bash
# Manage the project-local PostgreSQL cluster (no system privileges needed).
#   scripts/db.sh start | stop | status
set -euo pipefail

PG_BIN="${PG_BIN:-/usr/lib/postgresql/18/bin}"
DATA_DIR="$(cd "$(dirname "$0")/.." && pwd)/.local/pg"
SOCK_DIR="/tmp/docu_pg_sock"
PORT="${PG_PORT:-5433}"
LOG="$DATA_DIR.log"

case "${1:-}" in
  start)
    mkdir -p "$SOCK_DIR"
    if ! "$PG_BIN/pg_ctl" -D "$DATA_DIR" status >/dev/null 2>&1; then
      "$PG_BIN/pg_ctl" -D "$DATA_DIR" -l "$LOG" -o "-p $PORT -k $SOCK_DIR" start
      echo "PostgreSQL started on port $PORT"
    else
      echo "PostgreSQL already running on port $PORT"
    fi
    ;;
  stop)
    "$PG_BIN/pg_ctl" -D "$DATA_DIR" stop -m fast || echo "Not running."
    ;;
  status)
    "$PG_BIN/pg_ctl" -D "$DATA_DIR" status || true
    ;;
  *)
    echo "Usage: $0 {start|stop|status}" >&2
    exit 1
    ;;
esac
