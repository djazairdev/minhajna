// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Serves the dashboard's dist/ on this computer only, at port 4181 beside the
// PC web app's 4180, as its host serves it (the web app's scripts/serve.ts).

import { serveApp } from '../../web/scripts/serve.ts';

serveApp(new URL('../', import.meta.url), 4181, 'Minhajna dashboard');
