// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

/** A PDF made in the app's cache: its name, pages, size and the time it took. */
export type MadePdf = { name: string; pages: number; bytes: number; milliseconds: number };
/** The phone's web engine lays out the app's own HTML; only a file name crosses the bridge. */
export interface Spec extends TurboModule {
  makePdf(html: string, name: string, landscape: boolean): Promise<MadePdf>;
  sharePdf(name: string, title: string): Promise<void>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('MinhajnaPdf');
