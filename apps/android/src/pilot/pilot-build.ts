// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Whether this build is a pilot build (#220, choice P7). From 0.2.0, the
// preview app is the pilot's, wave by wave (#252), so it times its own
// confirmations and shows «توقيتاتي». The public build turns this off.

/** True in a pilot build, which times confirmations on the phone. */
export const PILOT_BUILD = true;
