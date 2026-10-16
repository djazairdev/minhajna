// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { ColorValue, TextStyle, ViewStyle } from 'react-native';
import { fontFamilyForWeight } from './fonts';

// Native counterpart of docs/design/system/tokens.json. Keep the canvas's names;
// __tests__/tokens.test.ts checks every key and value against that export.
// Dimensions are density-independent numbers, not CSS px or physical pixels.
// The raw palette preserves the canvas's gaps. Components use colorRoles below
// for contrast fixes; accessibility.md also documents target-size gaps.
export const colors = {
  paper: '#FAF7F1',
  sheet: '#FFFEFB',
  ink: '#1D2225',
  ink2: '#4B5358',
  pencil: '#5F676C',
  line: '#E6E0D5',
  rule: '#CFC7B8',
  grid: '#C9C2B6',
  dots: '#ABA496',
  board: '#1F2E29',
  chalk: '#F6F3EA',
  hi: '#F2D98A',
  ar: '#5B4842',
  fr: '#2E7D4C',
  subject: '#5B4842',
  'on-subject': '#FFFFFF',
  soft: '#ECE6DA',
  'pill-on': '#E7E0D2',
  'alt-day': '#EFEEEA',
  due: '#F2EDE3',
  private: '#F1EDE4',
  ok: '#DDE7DF',
  'ok-ink': '#244232',
  'book-edge': '#8C8683',
  'fr-edge': '#5F9C73',
  'fr-head': '#2F6B45',
  'pencil-edge': '#B3AB9D',
  'late-edge': '#CDB05A',
  'head-ink': '#444444',
  signature: '#23367A',
  'sep-dot': '#ADA597',
  'page-ring': '#555555',
  'page-ink': '#333333',
  'link-row': '#F6F1E4',
  scrim: 'rgba(20,24,22,.45)',
  'chalk-dust': 'rgba(246,243,234,.05)',
  well: '#F7F4EE',
  'chalk-82': 'rgba(246,243,234,.82)',
  'chalk-80': 'rgba(246,243,234,.8)',
  'chalk-75': 'rgba(246,243,234,.75)',
  'chalk-70': 'rgba(246,243,234,.7)',
  'chalk-40': 'rgba(246,243,234,.4)',
  'chalk-35': 'rgba(246,243,234,.35)',
  'chalk-22': 'rgba(246,243,234,.22)',
  'chalk-14': 'rgba(246,243,234,.14)',
  notice: '#FFF8E6',
  'notice-edge': '#C9A24A',
  'notice-ink': '#6B4E0E',
  'notice-strong': '#FFF1CC',
  'notice-line': '#8C6A1E',
  'warn-ink': '#7A5A12',
  threshold: '#A07C1C',
  'threshold-card': '#FBF4DC',
  hatch: '#9A9286',
  'hatch-ground': '#F4F1EA',
  'band-1': '#E3E9E2',
  'band-2': '#C9D6CC',
  'band-pale': '#EDF1EC',
  track: '#EFEBE3',
  'map-dots': '#D8D2C6',
  'map-edge': '#A39E93',
  'map-label': '#8C877D',
  'map-label-ground': 'rgba(255,254,251,.85)',
  'map-group': 'rgba(31,46,41,.045)',
  'map-group-quiet': 'rgba(31,46,41,.035)',
  'node-gone': '#F2EFE8',
  'node-changed': '#FFFDF6',
  hover: 'rgba(31,46,41,.05)',
  'hidden-hatch': 'rgba(140,134,131,.08)',
  'idle-hatch': 'rgba(95,103,108,.16)',
  'pending-hatch': '#EAE4D8',
  danger: '#8A2B22',
  'error-ink': '#8A3B12',
  blocked: '#8A3B2E',
  'tile-on': '#EEF1EC',
  en: '#2F5D86',
  'kept-ink': '#2E6B45',
  'qr-ground': '#FFFFFF',
  'a4-line': '#D9D3C7',
  'print-grid': '#DDD6CA',
  'print-weekend': '#E2DED6',
  'print-before': '#F1EEE8',
  'desk-edge': '#BDB5A6',
  focus: '#1D2225',
  'focus-on-board': '#F6F3EA',
} as const satisfies Record<string, ColorValue>;

// Components use these roles for the contrast gaps in the design's
// accessibility.md. The raw canvas palette above stays exact for parity.
export const colorRoles = {
  // Control outlines: rule on sheet is below the 3:1 non-text minimum.
  controlBorder: colors['book-edge'],
  // Map connection lines: map-edge on sheet is below 3:1.
  mapLink: colors['book-edge'],
  // Map attribution: map-label on map-label-ground is below 4.5:1 for text.
  mapAttribution: colors.ink2,
  // Sidebar outline controls: chalk-35 on board is just below 3:1.
  boardControlBorder: colors['chalk-40'],
} as const satisfies Record<string, ColorValue>;

// Design family names, not CSS fallback stacks. textStyle selects the bundled
// face for each weight; native registration happens before React Native starts.
export const fontFamilies = {
  display: 'Aref Ruqaa',
  arabic: 'Noto Naskh Arabic',
  latin: 'Noto Sans',
  print: 'Amiri',
} as const;

export type TypographyStyle = Readonly<
  Required<Pick<TextStyle, 'fontFamily' | 'fontSize' | 'lineHeight' | 'fontWeight'>>
>;

function textStyle(
  fontFamily: (typeof fontFamilies)[keyof typeof fontFamilies],
  fontSize: number,
  lineHeight: number,
  fontWeight: TypographyStyle['fontWeight'],
): TypographyStyle {
  return { fontFamily: fontFamilyForWeight(fontFamily, fontWeight), fontSize, lineHeight, fontWeight };
}

// Native lineHeight is absolute, unlike the canvas's unitless multipliers.
// Keep the multiplication explicit; values exported as px are already absolute.
export const typography = {
  brand: textStyle(fontFamilies.display, 60, 60 * 1.15, '700'),
  day: textStyle(fontFamilies.display, 36, 36 * 1.2, '700'),
  'web-heading': textStyle(fontFamilies.display, 26, 26 * 1.25, '700'),
  'subject-tab': textStyle(fontFamilies.display, 15, 15 * 1, '700'),
  'book-head': textStyle(fontFamilies.display, 14, 14 * 1.25, '700'),
  'month-head': textStyle(fontFamilies.display, 13, 13 * 1.2, '700'),
  h2: textStyle(fontFamilies.arabic, 22, 22 * 1.35, '700'),
  tagline: textStyle(fontFamilies.arabic, 17, 17 * 1.7, '400'),
  h3: textStyle(fontFamilies.arabic, 17, 17 * 1.4, '700'),
  'bar-title': textStyle(fontFamilies.arabic, 16, 16 * 1.3, '700'),
  body: textStyle(fontFamilies.arabic, 15, 15 * 1.6, '400'),
  'card-text': textStyle(fontFamilies.arabic, 15, 15 * 1.5, '400'),
  'class-chip': textStyle(fontFamilies.arabic, 15, 15 * 1, '700'),
  button: textStyle(fontFamilies.arabic, 15, 15 * 1.2, '600'),
  'button-primary': textStyle(fontFamilies.arabic, 16.5, 16.5 * 1.2, '600'),
  fact: textStyle(fontFamilies.arabic, 14, 14 * 1.5, '400'),
  chip: textStyle(fontFamilies.arabic, 14, 14 * 1.3, '500'),
  segment: textStyle(fontFamilies.arabic, 14, 14 * 1.2, '600'),
  caption: textStyle(fontFamilies.arabic, 13.5, 13.5 * 1.5, '400'),
  label: textStyle(fontFamilies.arabic, 13.5, 13.5 * 1.5, '600'),
  toggle: textStyle(fontFamilies.arabic, 13.5, 13.5 * 1, '600'),
  'bar-subtitle': textStyle(fontFamilies.arabic, 13, 13 * 1.3, '400'),
  tag: textStyle(fontFamilies.arabic, 12.5, 12.5 * 1.7, '600'),
  small: textStyle(fontFamilies.arabic, 12.5, 12.5 * 1.55, '400'),
  nav: textStyle(fontFamilies.arabic, 12.5, 12.5 * 1.3, '400'),
  badge: textStyle(fontFamilies.arabic, 12, 12 * 1.6, '400'),
  'body-latin': textStyle(fontFamilies.latin, 14.5, 14.5 * 1.6, '400'),
  stepper: textStyle(fontFamilies.latin, 22, 22 * 1, '600'),
  stat: textStyle(fontFamilies.latin, 19, 19 * 1.5, '700'),
  'grid-figure': textStyle(fontFamilies.latin, 15, 28, '700'),
  date: textStyle(fontFamilies.latin, 12, 28, '500'),
  'roll-number': textStyle(fontFamilies.latin, 12.5, 12.5 * 1, '500'),
  'grid-head': textStyle(fontFamilies.latin, 11.5, 11.5 * 1.35, '600'),
  'page-number': textStyle(fontFamilies.latin, 10.5, 10.5 * 1, '600'),
  entry: textStyle(fontFamilies.arabic, 15, 28, '400'),
  'entry-time': textStyle(fontFamilies.arabic, 13, 28, '500'),
  'entry-latin': textStyle(fontFamilies.latin, 13.5, 28, '400'),
  'homework-small': textStyle(fontFamilies.arabic, 11.5, 11.5 * 1.4, '600'),
  'side-note': textStyle(fontFamilies.arabic, 12, 12 * 1.5, '400'),
} as const;

export const spacing = {
  'space-2': 2,
  'space-3': 3,
  'space-4': 4,
  'space-6': 6,
  'space-8': 8,
  'space-10': 10,
  'space-12': 12,
  'space-14': 14,
  'space-16': 16,
  'space-20': 20,
  'space-24': 24,
} as const;

export const radius = {
  'radius-tag': 6,
  'radius-class': 8,
  'radius-badge': 10,
  'radius-control': 12,
  'radius-button': 14,
  'radius-pill': 15,
  'radius-card': 18,
  'radius-chip': 22,
  'radius-icon-button': 24,
  'radius-hero': 28,
  'radius-app-icon': 112,
} as const;

// boxShadow accepts the design's CSS syntax. Outset shadows require Android 9+;
// components must not rely on a shadow as their only boundary on Android 8.
export const shadows = {
  'shadow-focus-card': '0 1px 2px rgba(60,40,10,.06), 0 10px 28px rgba(60,40,10,.09)',
  'shadow-snack': '0 8px 24px rgba(0,0,0,.18)',
  'shadow-sheet': '0 -8px 30px rgba(0,0,0,.2)',
  'shadow-tooltip': '0 4px 14px rgba(40,30,10,.14)',
  'shadow-thumb': '0 2px 8px rgba(60,40,10,.12)',
  'shadow-node': '0 1px 2px rgba(60,40,10,.07)',
  'shadow-controls': '0 1px 3px rgba(0,0,0,.08)',
  'shadow-note': '0 1px 3px rgba(0,0,0,.06)',
} as const satisfies Record<string, ViewStyle['boxShadow']>;

export const sizes = {
  target: 48,
  'button-primary': 56,
  bar: 56,
  nav: 64,
  // Visual height only: the touch target must still be at least sizes.target.
  'chip-height': 44,
  icon: 22,
  'icon-small': 18,
  'book-line': 28,
  phone: 360,
  'web-sidebar': 232,
  'web-detail': 340,
} as const;

export type ColorToken = keyof typeof colors;
export type ColorRole = keyof typeof colorRoles;
export type FontFamilyToken = keyof typeof fontFamilies;
export type TypographyToken = keyof typeof typography;
export type SpacingToken = keyof typeof spacing;
export type RadiusToken = keyof typeof radius;
export type ShadowToken = keyof typeof shadows;
export type SizeToken = keyof typeof sizes;
