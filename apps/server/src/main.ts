// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Starts the server. It listens on this computer only unless HOST says
// otherwise, as the container does; PORT defaults to 3000 and must be a
// port number.

import { createApp } from './app.js';

const host = process.env['HOST'] ?? '127.0.0.1';
const port = Number(process.env['PORT'] ?? 3000);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  process.stderr.write('fatal PORT must be a whole number from 1 to 65535\n');
  process.exit(1);
}

const app = await createApp();
await app.listen(port, host);
