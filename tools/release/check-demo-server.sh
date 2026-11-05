#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 The Minhajna contributors
# SPDX-License-Identifier: AGPL-3.0-or-later

# Checks a deployed demo server with apps/server/host/check.ts, run by the
# workflows that deploy it from the repository's root, with the address and the
# version it must answer. It tries for about 20 minutes: a first deploy waits
# for its address's record and certificate, and each deploy for a rollout and
# the container's first start. The runner's DNS cache would keep a first miss,
# so it is emptied before each try.

set -euo pipefail

for attempt in $(seq 1 40); do
  sudo resolvectl flush-caches || true
  if node apps/server/host/check.ts "$1" "$2"; then
    echo "The host check passed on try $attempt."
    exit 0
  fi
  sleep 30
done
exit 1
