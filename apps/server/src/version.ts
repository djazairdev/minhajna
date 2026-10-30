// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The package's own version, read once from its package.json, which sits two
// folders above the built file (dist/src/version.js).

import { readFileSync } from 'node:fs';

const file = new URL('../../package.json', import.meta.url);
const parsed = JSON.parse(readFileSync(file, 'utf8')) as { version?: unknown };

export const VERSION: string = typeof parsed.version === 'string' ? parsed.version : '0.0.0';
