// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The licences on the web (#250): the notices of every package in the
// bundle, which the build gathers into licences.json beside it.

import type { AppLicences, Spec } from '../../../android/src/native/NativeMinhajnaLicences';

const Licences: Spec = {
  async readNotices(): Promise<AppLicences> {
    const response = await fetch('./licences.json');
    if (!response.ok) throw new Error('No licences.json');
    return (await response.json()) as AppLicences;
  },
};

export default Licences;
