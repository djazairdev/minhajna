// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useState } from 'react';
import { BottomNav } from '../navigation/NavigationChrome';

const TAB_NAMES = ['Today', 'Classes', 'Documents'] as const;

/** The real bottom bar with local selection, shared by its gallery entry and overlay previews. */
export function TabsSample({ labels }: { labels: readonly string[] }) {
  const [index, setIndex] = useState(0);
  const routes = TAB_NAMES.map((name) => ({ key: `gallery-${name}`, name }));
  const props = {
    state: { index, routes },
    descriptors: Object.fromEntries(routes.map((route, at) => [route.key, { options: { title: labels[at] } }])),
    navigation: {
      emit: () => ({ defaultPrevented: false }),
      navigate: (name: string) => setIndex(TAB_NAMES.indexOf(name as (typeof TAB_NAMES)[number])),
    },
  } as unknown as BottomTabBarProps;
  return <BottomNav {...props} />;
}
