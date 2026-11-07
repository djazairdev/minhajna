// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The school selects (answers 802 to 809), in setup's first step and in
// Settings: level, then option, wilaya, commune and school, each offered only
// once the one before is chosen, and each emptied when an earlier one changes.
// No subtitles or helper texts. While the list loads, while the server wakes,
// with no network, with nothing published or with a list the app refuses, a
// line says so, with a retry.

import type { CountryProfile, ReferenceList } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { Select } from '../components/Select';
import { controlIcon } from '../design/Icon';
import { colors, spacing, typography } from '../design/tokens';
import { useText } from '../text/i18n';
import {
  choose,
  communeOptions,
  levelOptions,
  optionOptions,
  schoolOptions,
  wilayaOptions,
  type Choice,
} from './school-choice';
import type { ReferenceLoad } from './useReference';

/** What the list's load says, for every state but a list ready. */
const LINES = {
  none: 'setup.directory.none',
  offline: 'setup.directory.offline',
  busy: 'setup.directory.busy',
  refused: 'setup.directory.refused',
} as const;

/** The line and retry shown while no list is ready, or null once it is. */
export function ReferenceState({ load, onRetry }: { load: ReferenceLoad; onRetry: () => void }) {
  const { direction } = useLocale();
  const t = useText();
  if (load.kind === 'ready') return null;
  const line =
    load.kind === 'loading'
      ? t(load.waking ? 'setup.directory.waking' : 'setup.directory.loading')
      : t(LINES[load.kind]);
  return (
    <View testID="directory-state" style={styles.state}>
      <Text accessibilityLiveRegion="polite" style={[styles.line, { writingDirection: direction, textAlign: 'start' }]}>
        {line}
      </Text>
      {load.kind !== 'loading' && (
        <Button
          testID="directory-retry"
          variant="line"
          icon={controlIcon('globe')}
          label={t('setup.directory.retry')}
          onPress={onRetry}
        />
      )}
    </View>
  );
}

/** The five selects over a ready list. */
export function SchoolChoice({
  profile,
  list,
  choice,
  onChoice,
  held = [],
  testID = 'choice',
}: {
  profile: CountryProfile;
  list: ReferenceList;
  choice: Choice;
  onChoice: (choice: Choice) => void;
  /** The directory schools the teacher holds as other schools, left out of the last select. */
  held?: readonly string[];
  testID?: string;
}) {
  const t = useText();
  const set = (field: keyof Choice) => (value: string) => onChoice(choose(choice, field, value));
  return (
    <View style={styles.fields}>
      <Select
        testID={`${testID}-level`}
        label={t('setup.level')}
        options={levelOptions(t, profile, list)}
        value={choice.level}
        onChange={set('level')}
      />
      {choice.level !== null && (
        <Select
          testID={`${testID}-option`}
          label={t('setup.subject')}
          options={optionOptions(t, profile, list, choice.level)}
          value={choice.option}
          onChange={set('option')}
        />
      )}
      {choice.option !== null && (
        <Select
          testID={`${testID}-wilaya`}
          label={t('setup.wilaya')}
          options={wilayaOptions(profile, list, choice.level)}
          value={choice.wilaya}
          onChange={set('wilaya')}
        />
      )}
      {choice.wilaya !== null && (
        <Select
          testID={`${testID}-commune`}
          label={t('setup.commune')}
          options={communeOptions(list, choice.level, choice.wilaya, held)}
          value={choice.commune}
          onChange={set('commune')}
        />
      )}
      {choice.commune !== null && (
        <Select
          testID={`${testID}-school`}
          label={t('setup.school')}
          options={schoolOptions(list, choice, held)}
          value={choice.school}
          onChange={set('school')}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fields: { gap: spacing['space-16'] },
  state: { gap: spacing['space-12'] },
  line: { ...typography.body, color: colors.ink },
});
