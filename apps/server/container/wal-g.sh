#!/bin/bash
# SPDX-FileCopyrightText: 2026 The Minhajna contributors
# SPDX-License-Identifier: AGPL-3.0-or-later

# Runs WAL-G with the date and time cut from the start of its log lines, so
# the logs never show when the demo was used (§6.5, §6.7). With pipefail,
# it answers WAL-G's exit code.
set -uo pipefail
{ wal-g "$@" 2>&1 1>&3 3>&- | sed -uE 's#^(INFO|WARNING|ERROR): [0-9/]+ [0-9:.]+ #\1: #' >&2; } 3>&1
