// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Browser-only source processing for the curator. The nullable lookup
// keeps the PDF library and its worker outside the Android application.

import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  pick(): Promise<{ token: string; pages: number } | null>;
  page(
    token: string,
    page: number,
    scale: number,
  ): Promise<{
    uri: string;
    width: number;
    height: number;
    rows: readonly string[];
  }>;
  drop(token: string): void;
  cancelPick(): void;
}

export default TurboModuleRegistry.get<Spec>('MinhajnaPdfSource');
