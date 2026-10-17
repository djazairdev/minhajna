// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// One entry per component, in the order of the design system. To add a
// component, build it in src/components/<Name>.tsx, then add its entry here:
// its name as in docs/design/system/components, its design page, and each of
// its states with made-up content from samples.ts. The gallery's test then
// renders it both ways and checks its labels and touch targets.

import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import type { NativeStackHeaderProps } from '@react-navigation/native-stack';
import { useState, type ReactNode } from 'react';
import { BottomNav, TopBar } from '../navigation/NavigationChrome';
import { ButtonSamples, IconButtonSamples } from './button-samples';
import { PageHeadingSamples, SectionHeaderSamples } from './heading-samples';
import type { Sample } from './samples';

export type GalleryEntry = {
  /** The component's name in the design system. */
  readonly name: string;
  /** Its design page, from the repository's root. */
  readonly design: string;
  /** Each of its states, with made-up content. */
  readonly render: (sample: Sample) => ReactNode;
};

const TAB_NAMES = ['Today', 'Classes', 'Documents'] as const;

/** The header's props with a title, as the native stack would give them, and a Back that stays on the gallery. */
function header(title: string): NativeStackHeaderProps {
  return {
    navigation: { goBack: () => undefined },
    options: { title },
    route: { key: 'gallery', name: 'Gallery' },
  } as unknown as NativeStackHeaderProps;
}

/** The bottom bar with three tabs, which a tap selects, as the tab navigator would. */
function TabsSample({ labels }: { labels: readonly string[] }) {
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

/** The components on the gallery, each with its states. */
export const entries: readonly GalleryEntry[] = [
  {
    name: 'Button',
    design: 'docs/design/system/components/Button/README.md',
    render: (sample) => <ButtonSamples sample={sample} />,
  },
  {
    name: 'IconButton',
    design: 'docs/design/system/components/IconButton/README.md',
    render: (sample) => <IconButtonSamples sample={sample} />,
  },
  {
    name: 'PageHeading',
    design: 'docs/design/system/components/PageHeading/README.md',
    render: (sample) => <PageHeadingSamples key={sample.title} sample={sample} />,
  },
  {
    name: 'SectionHeader',
    design: 'docs/design/system/components/SectionHeader/README.md',
    render: (sample) => <SectionHeaderSamples key={sample.title} sample={sample} />,
  },
  {
    name: 'TopBar',
    design: 'docs/design/system/components/TopBar/README.md',
    render: (sample) => (
      <>
        <TopBar {...header(sample.heading)} />
        <TopBar {...header(sample.longHeading)} />
      </>
    ),
  },
  {
    name: 'BottomNav',
    design: 'docs/design/system/components/BottomNav/README.md',
    render: (sample) => (
      <>
        <TabsSample labels={sample.tabs} />
        <TabsSample labels={sample.longTabs} />
      </>
    ),
  },
];
