#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 The Minhajna contributors
# SPDX-License-Identifier: AGPL-3.0-or-later

# Stops a hosted test before it deploys anything unless the demo-host
# environment gave it the bucket's keys. An environment that doesn't exist yet
# comes with no reviewer and no secrets, so this also stops a run that nobody
# approved. Prints no value, only which name is missing or malformed.

set -euo pipefail

for name in DEMO_R2_ACCESS_KEY_ID DEMO_R2_SECRET_ACCESS_KEY DEMO_ARCHIVE_KEY; do
  if [[ -z "${!name:-}" ]]; then
    echo "::error title=Hosted test::demo-host has no $name (docs/demo-host.md)"
    exit 1
  fi
done
if [[ ! "$DEMO_ARCHIVE_KEY" =~ ^[0-9a-f]{64}$ ]]; then
  echo "::error title=Hosted test::DEMO_ARCHIVE_KEY is not 32 bytes in hex (docs/demo-host.md)"
  exit 1
fi
