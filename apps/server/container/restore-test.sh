#!/bin/bash
# SPDX-FileCopyrightText: 2026 The Minhajna contributors
# SPDX-License-Identifier: AGPL-3.0-or-later

# Tests a restore of the backups (#620, answer 658), as root, from the start
# script after each daily base backup. With twice the database's size, its
# write-ahead log aside, free on the disk, so the copy cannot fill what the live
# database writes to, it fetches the latest base backup from the bucket into a
# scratch folder beside the live database, and starts a second PostgreSQL on it,
# with little memory, no network and a socket of its own, which recovers from
# the archived WAL within RESTORE_WAIT seconds (1800). It then checks that the
# restored database answers, holds no migration but the live one's, in their
# order up to what the archive has reached, and reads its worlds' table. A step
# that fails stops that PostgreSQL and erases the folder, and if the container
# stops mid-test, the start script erases the folder next time. It then writes
# one line to the admin log through the live database's superuser:
# restore.tested, by the UTC day, with passed, or failed and the step that
# failed (room, fetch, recover or check); it answers 0 or 1. Each question to a
# database has ANSWER_WAIT seconds, so a hung one cannot hold the daily backups
# back. What the second PostgreSQL logs is dropped, and WAL-G's lines carry no
# clock time.

set -uo pipefail

SOCKET=/var/run/postgresql
SCRATCH="$PGDATA.restore-test"
TEST_SOCKET="$SOCKET/restore-test"
PORT=5433
DATABASE=minhajna
WAIT=${RESTORE_WAIT:-1800}
ANSWER_WAIT=60
export PGHOST=$SOCKET PGUSER=postgres

log() { printf 'log [Restore test] %s\n' "$*"; }
as_postgres() { gosu postgres "$@"; }
scratch=''

clean() {
  if [ -n "$scratch" ] && kill -0 "$scratch" 2>/dev/null; then
    as_postgres pg_ctl stop -D "$SCRATCH" -m immediate -w -t 60 >/dev/null 2>&1 || kill -KILL "$scratch" 2>/dev/null
    wait "$scratch" 2>/dev/null
  fi
  scratch=''
  rm -rf "$SCRATCH" "$TEST_SOCKET"
}

record() {
  if ! timeout "$ANSWER_WAIT" gosu postgres psql -qAtX -d "$DATABASE" -v ON_ERROR_STOP=1 \
    -v result="$1" -v step="${2:-}" >/dev/null <<'SQL'; then
INSERT INTO admin_line (day, action, detail)
VALUES ((now() AT TIME ZONE 'UTC')::date, 'restore.tested',
  CASE WHEN :'step' = '' THEN jsonb_build_object('result', :'result')
  ELSE jsonb_build_object('result', :'result', 'step', :'step') END);
SQL
    log 'could not write to the admin log'
  fi
}

fail() {
  clean
  record failed "$1"
  log "failed: $1"
  exit 1
}

restored() { timeout "$ANSWER_WAIT" gosu postgres psql -h "$TEST_SOCKET" -p "$PORT" -qAtX "$@"; }
migrations=(-c 'SELECT string_agg(name, $$,$$ ORDER BY name) FROM minhajna_meta.migration')

clean
need=$(du -sk --exclude=pg_wal "$PGDATA" | cut -f1)
free=$(df -Pk "$(dirname "$SCRATCH")" | awk 'NR == 2 { print $4 }')
[ "$free" -gt "$((need * 2))" ] || fail room
install -d -o postgres -g postgres -m 700 "$SCRATCH"
install -d -o postgres -g postgres -m 755 "$TEST_SOCKET"
timeout "$WAIT" gosu postgres minhajna-wal-g backup-fetch "$SCRATCH" LATEST >/dev/null || fail fetch
as_postgres touch "$SCRATCH/recovery.signal"
gosu postgres postgres -D "$SCRATCH" -p "$PORT" -c listen_addresses= -c "unix_socket_directories=$TEST_SOCKET" \
  -c archive_mode=off -c shared_buffers=16MB -c 'restore_command=minhajna-wal-fetch %f %p' >/dev/null 2>&1 &
scratch=$!
deadline=$((SECONDS + WAIT))
until [ "$(restored -d postgres -c 'SELECT NOT pg_is_in_recovery()' 2>/dev/null)" = t ]; do
  kill -0 "$scratch" 2>/dev/null || fail recover
  [ "$SECONDS" -lt "$deadline" ] || fail recover
  sleep 1
done
live=$(timeout "$ANSWER_WAIT" gosu postgres psql -qAtX -d "$DATABASE" "${migrations[@]}") || fail check
copy=$(restored -d "$DATABASE" "${migrations[@]}") || fail check
{ [ -n "$copy" ] && [[ "$live," == "$copy,"* ]]; } || fail check
restored -d "$DATABASE" -c 'SELECT count(*) FROM world' >/dev/null || fail check
clean
record passed
log passed
