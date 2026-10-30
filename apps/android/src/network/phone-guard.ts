// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The phone's network guard (install.ts, #559), set as this module loads, so
// that index.js, which imports it first, guards every connection before any
// other module of the app runs.

import { guardPhone } from './install';

guardPhone();
