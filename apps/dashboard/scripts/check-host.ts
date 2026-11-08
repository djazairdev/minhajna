// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Checks a host of the dashboard once a build is deployed, with the web app's
// rules (its scripts/check-host.ts): `node scripts/check-host.ts [address]
// [checksum]`, by default the dashboard's own address (answer 855).

import { checkHostCli } from '../../web/scripts/check-host.ts';

/** The address the dashboard is served at. */
const ADDRESS = 'https://minhajna-admin.djazair.dev/';

await checkHostCli(ADDRESS);
