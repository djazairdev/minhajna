// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The debug storage check's module (#19): absent on the web, as in a
// release build of the phone app.

import type { Spec } from '../../../android/src/native/NativeMinhajnaStorageCheck';

const StorageCheck: Spec | null = null;

export default StorageCheck;
