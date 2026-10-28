// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The installed build on the web (#250, R-6.6-07): its version and the
// checksum of its files, from the build.json the offline worker installed
// with them, once it found them named the same in the build's notes.json,
// which the checksum covers. The bundle's checksum stands where the phone
// gives its APK's; a web app has no signing certificate.

import type { BuildFacts, Spec } from '../../../android/src/native/NativeMinhajnaBuild';

/** What build.json holds, as scripts/build.ts writes it. */
type WebBuild = { version: string; versionCode: number; sha256: string };

const Build: Spec = {
  async describe(): Promise<BuildFacts> {
    const response = await fetch('./build.json');
    if (!response.ok) throw new Error('No build.json');
    const build = (await response.json()) as WebBuild;
    return { version: build.version, versionCode: build.versionCode, apkSha256: build.sha256, signerSha256: null };
  },
};

export default Build;
