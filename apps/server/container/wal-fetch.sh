#!/bin/bash
# SPDX-FileCopyrightText: 2026 The Minhajna contributors
# SPDX-License-Identifier: AGPL-3.0-or-later

# PostgreSQL's restore_command. PostgreSQL ends recovery at the first WAL
# file the command says is missing, so only WAL-G's own answer for a file
# that is not in the bucket (74) says so. Any other failure, such as the
# bucket out of reach, is tried 5 times, then answered with 255, which
# makes PostgreSQL stop recovering rather than open a database that lacks
# the files it could not fetch; the next container tries again.
set -uo pipefail
for wait in 1 2 4 8 16; do
  minhajna-wal-g wal-fetch "$1" "$2"
  case $? in
    0) exit 0 ;;
    74) exit 1 ;;
  esac
  sleep "$wait"
done
exit 255
