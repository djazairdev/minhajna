#!/bin/bash
# SPDX-FileCopyrightText: 2026 The Minhajna contributors
# SPDX-License-Identifier: AGPL-3.0-or-later

# Installs the dev container's packages (#634) once it is made: every
# lockfile with `npm ci`, as CI does, then Prisma's command line and the
# server's generated client. Each node_modules folder is a volume of the
# container's own, so the computer's installs are left alone.
set -euo pipefail
npm ci --no-audit
npm ci --no-audit --prefix apps/android
npm ci --no-audit --prefix apps/web
npm ci --no-audit --prefix apps/server
npm run tools --prefix apps/server
npm run generate --prefix apps/server
