// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// One entry per component, in the order of the design system. To add a
// component, build it in src/components/<Name>.tsx, then add its entry here:
// its name as in docs/design/system/components, its design page, and each of
// its states with made-up content. Put the texts only its samples use in
// src/gallery/<name>-texts.ts, one record per interface language, beside its
// <name>-samples.tsx; samples.ts keeps the words every component shares. The
// gallery's test then renders it both ways and checks its labels and touch
// targets.

import type { NativeStackHeaderProps } from '@react-navigation/native-stack';
import type { ReactNode } from 'react';
import { TopBar } from '../navigation/NavigationChrome';
import { ButtonSamples, IconButtonSamples } from './button-samples';
import { ChipSamples, SetupStepsSamples } from './chip-samples';
import { PageHeadingSamples, SectionHeaderSamples } from './heading-samples';
import { NoticeSamples, SnackbarSamples } from './feedback-samples';
import { TabsSample } from './navigation-sample';
import { TextFieldSamples } from './text-field-samples';
import { CheckRowSamples, OptionRowSamples } from './choice-samples';
import { FactsSamples, WelcomeHeroSamples } from './welcome-samples';
import { WeekGridSamples } from './week-grid-samples';
import { DueStripSamples, ProposalSamples } from './proposal-samples';
import type { Language } from '../text/i18n';
import type { Sample } from './samples';

export type GalleryEntry = {
  /** The component's name in the design system. */
  readonly name: string;
  /** Its design page, from the repository's root. */
  readonly design: string;
  /** Each of its states, with made-up content. */
  readonly render: (sample: Sample, language: Language) => ReactNode;
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
    name: 'PageHeading',
    design: 'docs/design/system/components/PageHeading/README.md',
    render: (sample, language) => <PageHeadingSamples key={language} sample={sample} language={language} />,
  },
  {
    name: 'SectionHeader',
    design: 'docs/design/system/components/SectionHeader/README.md',
    render: (sample, language) => <SectionHeaderSamples key={language} sample={sample} language={language} />,
  },
  {
    name: 'Chip',
    design: 'docs/design/system/components/Chip/README.md',
    render: (sample, language) => <ChipSamples key={language} sample={sample} language={language} />,
  },
  {
    name: 'Facts',
    design: 'docs/design/system/components/Facts/README.md',
    render: () => <FactsSamples />,
  },
  {
    name: 'Notice',
    design: 'docs/design/system/components/Notice/README.md',
    render: (sample, language) => <NoticeSamples sample={sample} language={language} />,
  },
  {
    name: 'SetupSteps',
    design: 'docs/design/system/components/SetupSteps/README.md',
    render: (sample, language) => <SetupStepsSamples sample={sample} language={language} />,
  },
  {
    name: 'Snackbar',
    design: 'docs/design/system/components/Snackbar/README.md',
    render: (sample, language) => <SnackbarSamples key={language} sample={sample} language={language} />,
  },
  {
    name: 'TextField',
    design: 'docs/design/system/components/TextField/README.md',
    render: (sample, language) => <TextFieldSamples key={language} sample={sample} language={language} />,
  },
  {
    name: 'WeekGrid',
    design: 'docs/design/system/components/WeekGrid/README.md',
    render: (sample, language) => <WeekGridSamples key={language} sample={sample} language={language} />,
  },
  {
    name: 'Proposal',
    design: 'docs/design/system/components/Proposal/README.md',
    render: (sample, language) => <ProposalSamples key={language} sample={sample} language={language} />,
  },
  {
    name: 'DueStrip',
    design: 'docs/design/system/components/DueStrip/README.md',
    render: (sample, language) => <DueStripSamples key={language} sample={sample} language={language} />,
  },
  {
    name: 'CheckRow',
    design: 'docs/design/system/components/CheckRow/README.md',
    render: (sample, language) => <CheckRowSamples key={language} sample={sample} language={language} />,
  },
  {
    name: 'OptionRow',
    design: 'docs/design/system/components/OptionRow/README.md',
    render: (sample, language) => <OptionRowSamples key={language} sample={sample} language={language} />,
  },
  {
    name: 'WelcomeHero',
    design: 'docs/design/system/components/WelcomeHero/README.md',
    render: () => <WelcomeHeroSamples />,
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
