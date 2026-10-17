// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// One entry per component, in the order of the design system. To add a
// component, build it in src/components/<Name>.tsx, then add its entry here:
// its name as in docs/design/system/components, its design page, and each of
// its states with made-up content from samples.ts. The gallery's test then
// renders it both ways and checks its labels and touch targets.

import type { NativeStackHeaderProps } from '@react-navigation/native-stack';
import type { ReactNode } from 'react';
import { TopBar } from '../navigation/NavigationChrome';
import { ButtonSamples, IconButtonSamples } from './button-samples';
import { NoticeSamples, SnackbarSamples } from './feedback-samples';
import { TabsSample } from './navigation-sample';
import type { Sample } from './samples';

export type GalleryEntry = {
  /** The component's name in the design system. */
  readonly name: string;
  /** Its design page, from the repository's root. */
  readonly design: string;
  /** Each of its states, with made-up content. */
  readonly render: (sample: Sample) => ReactNode;
};

/** The header's props with a title, as the native stack would give them, and a Back that stays on the gallery. */
function header(title: string): NativeStackHeaderProps {
  return {
    navigation: { goBack: () => undefined },
    options: { title },
    route: { key: 'gallery', name: 'Gallery' },
  } as unknown as NativeStackHeaderProps;
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
    name: 'Notice',
    design: 'docs/design/system/components/Notice/README.md',
    render: (sample) => <NoticeSamples sample={sample} />,
  },
  {
    name: 'Snackbar',
    design: 'docs/design/system/components/Snackbar/README.md',
    render: (sample) => <SnackbarSamples key={sample.title} sample={sample} />,
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
