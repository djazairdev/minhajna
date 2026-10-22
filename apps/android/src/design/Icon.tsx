// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useLocale } from '@react-navigation/native';
import { Image } from 'react-native';
import type { ControlIcon } from '../components/control';

/** The design's line icons, bundled as Android vector drawables (res/drawable/icon_*.xml); nothing is downloaded. */
export const ICONS = [
  'no_account',
  'offline',
  'phone',
  'lock',
  'never',
  'no_tracking',
  'publisher',
  'rights',
  'globe',
  'chevron',
  'school',
  'info',
  'check',
  'cross',
  'pupils',
  'homework',
  'plus',
  'tune',
  'print',
  'pencil',
] as const;
export type IconName = (typeof ICONS)[number];

/** Decorative only: the text beside an icon carries its meaning, so TalkBack skips it. */
export function Icon({ name, size, color }: { name: IconName; size: number; color: string }) {
  const { direction } = useLocale();
  const mirrored = name === 'chevron' && direction === 'ltr';
  return (
    <Image
      testID={`icon-${name}`}
      source={{ uri: `icon_${name}` }}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size, tintColor: color, transform: mirrored ? [{ scaleX: -1 }] : [] }}
    />
  );
}

/** The same icon in the shape that controls and notices take. */
export function controlIcon(name: IconName): ControlIcon {
  return ({ size, color }) => <Icon name={name} size={size} color={color} />;
}
