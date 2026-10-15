// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Each alias is registered against one local font in MainApplication.kt. Naming
// the weight explicitly avoids React Native's 500/600 -> normal fallback on
// Android 8. No font loader, download or asynchronous first frame is needed.
export const fontFaces = {
  'Aref Ruqaa': { '700': 'Aref Ruqaa' },
  'Noto Naskh Arabic': {
    '400': 'Noto Naskh Arabic',
    '500': 'Noto Naskh Arabic Medium',
    '600': 'Noto Naskh Arabic SemiBold',
    '700': 'Noto Naskh Arabic Bold',
  },
  'Noto Sans': {
    '400': 'Noto Sans',
    '500': 'Noto Sans Medium',
    '600': 'Noto Sans SemiBold',
    '700': 'Noto Sans Bold',
  },
} as const;

export function fontFamilyForWeight(family: string, weight: string | number): string {
  const faces: Readonly<Record<string, Readonly<Record<string, string>>>> = fontFaces;
  return faces[family]?.[String(weight)] ?? family;
}
