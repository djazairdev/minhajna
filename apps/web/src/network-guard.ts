// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The PC's network guard (#559, answer 570), set as this module loads, so
// that the page, which imports it first, guards every connection before any
// other module of the app runs: the page's own files stay open, and only a
// demo world's client reaches the demo server.

import { installNetworkGuard } from '../../android/src/network/install';

installNetworkGuard(location.origin, false);
