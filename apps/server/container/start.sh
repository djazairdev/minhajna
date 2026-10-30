#!/bin/bash
# SPDX-FileCopyrightText: 2026 The Minhajna contributors
# SPDX-License-Identifier: AGPL-3.0-or-later

# Starts the demo server's container (#633, answer 550). On an empty disk it
# restores the latest base backup and every archived WAL file from the bucket in
# WALG_S3_PREFIX, or, when the bucket holds none, makes a new database and backs
# it up at once. A restore lands in a separate folder first, so a failed one
# leaves no half-made database behind. PostgreSQL then archives each WAL file as
# it fills, and at least every ARCHIVE_TIMEOUT seconds (60). A base backup is
# taken whenever the latest is BACKUP_EVERY seconds old (a day), on starting
# too, keeping the last two; one that fails is tried again 5 minutes later. On
# SIGTERM the server stops, the last WAL is archived and PostgreSQL stops, which
# needs a stop grace of about 120 seconds. If the bucket cannot be read within
# BUCKET_WAIT seconds (120), or a restore within RESTORE_WAIT (1800), the
# container stops rather than start an empty or partial database. PostgreSQL
# runs as postgres and listens on its socket only; the server runs as minhajna,
# a role that is no superuser, without the bucket's settings. ARCHIVE=off runs
# with no bucket, for trying the image; nothing outlives the container then.
# Logs carry no clock times: they are cut from PostgreSQL's and WAL-G's lines.

set -euo pipefail

SOCKET=/var/run/postgresql
DATABASE=minhajna
RESTORING="$PGDATA.restoring"
export PGHOST=$SOCKET PGUSER=postgres PGDATABASE=postgres

log() { printf 'log [Container] %s\n' "$*"; }
fatal() {
  printf 'fatal [Container] %s\n' "$*" >&2
  exit 1
}
archiving() { [ -n "${WALG_S3_PREFIX:-}" ]; }
as_postgres() { gosu postgres "$@"; }

if ! archiving && [ "${ARCHIVE:-}" != off ]; then
  fatal 'set WALG_S3_PREFIX and the bucket credentials, or ARCHIVE=off to keep nothing'
fi

settings=(-c listen_addresses= -c "unix_socket_directories=$SOCKET" -c log_line_prefix=)
if archiving; then
  settings+=(-c archive_mode=on -c 'archive_command=minhajna-wal-g wal-push %p')
  settings+=(-c "archive_timeout=${ARCHIVE_TIMEOUT:-60}" -c 'restore_command=minhajna-wal-fetch %f %p')
fi

backup_due_in() {
  local listing
  listing=$(as_postgres minhajna-wal-g backup-list --json 2>/dev/null) || listing='[]'
  node -e '
    let backups;
    try {
      backups = JSON.parse(process.argv[1] || "[]") ?? [];
    } catch {
      process.stdout.write("300");
      process.exit(0);
    }
    const latest = Math.max(0, ...backups.map((one) => Date.parse(one.time)).filter(Number.isFinite));
    process.stdout.write(String(Math.max(0, Math.ceil((latest + process.argv[2] * 1000 - Date.now()) / 1000))));
  ' "$listing" "${BACKUP_EVERY:-86400}" || echo 300
}

back_up() {
  if as_postgres minhajna-wal-g backup-push "$PGDATA" && as_postgres minhajna-wal-g delete retain FULL 2 --confirm; then
    log 'backed up'
  else
    log 'backup failed; trying again in 5 minutes'
    sleep 240
  fi
}

new=no
rm -rf "$RESTORING"
mkdir -p "$PGDATA"
chown postgres:postgres "$PGDATA"
chmod 700 "$PGDATA"
if [ ! -s "$PGDATA/PG_VERSION" ]; then
  if archiving; then
    backups=$(timeout "${BUCKET_WAIT:-120}" gosu postgres minhajna-wal-g backup-list 2>&1) ||
      fatal 'cannot read the bucket; check WALG_S3_PREFIX, AWS_ENDPOINT and the credentials'
  fi
  if archiving && grep -q 'base_' <<<"$backups"; then
    log 'restoring the latest backup'
    install -d -o postgres -g postgres -m 700 "$RESTORING"
    timeout "${RESTORE_WAIT:-1800}" gosu postgres minhajna-wal-g backup-fetch "$RESTORING" LATEST ||
      fatal 'cannot restore the latest backup'
    as_postgres touch "$RESTORING/recovery.signal"
    rmdir "$PGDATA"
    mv "$RESTORING" "$PGDATA"
  else
    as_postgres initdb -D "$PGDATA" --username=postgres --auth-local=peer --auth-host=reject \
      --encoding=UTF8 --locale=C.UTF-8 >/dev/null
    new=yes
  fi
fi

TIME='[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9.]+( ?(UTC|[+-][0-9]{2}))?'
as_postgres postgres -D "$PGDATA" "${settings[@]}" 2> >(sed -uE "s/$TIME/(time not logged)/g" >&2) &
database=$!
until [ "$(as_postgres psql -qAtX -c 'SELECT NOT pg_is_in_recovery()' 2>/dev/null)" = t ]; do
  kill -0 "$database" 2>/dev/null || fatal 'PostgreSQL stopped while starting'
  sleep 0.5
done
if [ -z "$(as_postgres psql -qAtX -c "SELECT 1 FROM pg_roles WHERE rolname = '$DATABASE'")" ]; then
  as_postgres createuser "$DATABASE"
fi
if [ -z "$(as_postgres psql -qAtX -c "SELECT 1 FROM pg_database WHERE datname = '$DATABASE'")" ]; then
  as_postgres createdb -O "$DATABASE" "$DATABASE"
fi
if archiving && [ "$new" = yes ]; then
  log 'backing up the new database'
  as_postgres minhajna-wal-g backup-push "$PGDATA"
fi

backups_loop=''
if archiving; then
  (
    while sleep "$(backup_due_in)"; do
      back_up
      sleep 60
    done
    log 'backups stopped'
  ) &
  backups_loop=$!
fi

gosu "$DATABASE" env -i PATH="$PATH" NODE_ENV="$NODE_ENV" HOST="$HOST" PORT="$PORT" \
  TRUST_PROXY="${TRUST_PROXY:-}" DATABASE_URL="postgresql://$DATABASE@/$DATABASE?host=$SOCKET" \
  node dist/src/main.js &
server=$!

stop() {
  trap - TERM INT
  kill -TERM "$server" 2>/dev/null && wait "$server" || true
  [ -n "$backups_loop" ] && kill "$backups_loop" 2>/dev/null || true
  if archiving; then as_postgres psql -qAtX -c 'SELECT pg_switch_wal()' >/dev/null || true; fi
  as_postgres pg_ctl stop -D "$PGDATA" -m fast -w -t 120 >/dev/null || true
  log 'stopped'
  exit "$1"
}
trap 'stop 0' TERM INT
wait -n "$database" "$server" || true
log 'the server or PostgreSQL stopped on its own'
stop 1
