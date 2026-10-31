// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The school key as a device of a demo world holds it (#570, #571): the record
// its store keeps, the keyring opened, and the device's crypto, which D-Issue
// issues from and D-Keys changes; and the size of the world kit's public keys.
// It stands apart so the sessions that hold, follow and change the key import
// it without importing one another back.

import type { KeyCrypto, OpenedKeyring, SchoolHeld } from '@minhajna/core';

/** A P-256 point, uncompressed, as the world kit's agreement gives it. */
export const PUBLIC_KEY_BYTES = 65;

/** The school key as this device holds it: the record kept, the keyring opened, and the device's crypto. */
export interface IssueDesk {
  readonly held: SchoolHeld;
  readonly opened: OpenedKeyring;
  readonly crypto: KeyCrypto;
}
