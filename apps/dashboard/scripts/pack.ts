// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The dashboard as one file for its host and the release: dist/ packed into
// release/minhajna-dashboard-<version>.zip, the same bytes for the same
// build, as the web app's scripts/pack.ts packs its own.

import { packApp } from '../../web/scripts/pack.ts';

packApp(new URL('../', import.meta.url), 'minhajna-dashboard');
