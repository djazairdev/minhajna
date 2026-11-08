// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The side panel that adds or edits a level's option (answer 804): one
// subject, or two as one option outside the primary, each a select of the
// level's subjects. A subject that already has its own option is not offered
// again, and an option that exists says so. An edited option keeps its code,
// which the schools' teachers hold.

import type { CountryProfile, DirectoryLevel, DirectoryOption, ReferenceDraft } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../../android/src/components/Button';
import { controlIcon } from '../../android/src/design/Icon';
import { colors, spacing, typography } from '../../android/src/design/tokens';
import { localized } from '../../android/src/setup/names';
import { useDashboardText } from './text';
import { PickField } from './PickField';
import { freeSubjects, levelSubjects, makeOption, optionExists, withOption } from './reference-rules';

export type OptionFormProps = {
  readonly profile: CountryProfile;
  readonly level: DirectoryLevel;
  readonly pair: boolean;
  readonly editing?: DirectoryOption;
  /** The level in the published list, whose option codes a new option must not take for other subjects. */
  readonly published?: DirectoryLevel;
  /** The change to the draft, or null for none. */
  readonly onDone: (step: ((draft: ReferenceDraft) => ReferenceDraft) | null) => void;
};

/** One option's subjects. */
export function OptionForm({ profile, level, pair, editing, published, onDone }: OptionFormProps) {
  const t = useDashboardText();
  const { direction } = useLocale();
  const [first, setFirst] = useState<string | null>(editing?.subjects[0] ?? null);
  const [second, setSecond] = useState<string | null>(editing?.subjects[1] ?? null);
  const subjects = (pair ? levelSubjects(profile, level.code) : freeSubjects(profile, level, editing)).map(
    (subject) => ({ value: subject.code, label: localized(subject.name) }),
  );
  const chosen = [first, second].slice(0, pair ? 2 : 1);
  const whole = chosen.every((one) => one !== null) && (!pair || first !== second);
  const codes = chosen.filter((one) => one !== null);
  const exists = whole && optionExists(level, codes, editing);
  const title = editing !== undefined ? 'edit' : pair ? 'addPair' : 'add';
  return (
    <View testID="option-form" style={styles.form}>
      <Text accessibilityRole="header" style={[styles.title, { writingDirection: direction, textAlign: 'start' }]}>
        {t(`dashboard.levels.${title}`)}
      </Text>
      <PickField
        testID="option-first"
        label={t(pair ? 'dashboard.levels.first' : 'dashboard.levels.subject')}
        choices={subjects}
        value={first}
        onChange={setFirst}
      />
      {pair && (
        <PickField
          testID="option-second"
          label={t('dashboard.levels.second')}
          choices={subjects.filter((subject) => subject.value !== first)}
          value={second}
          onChange={setSecond}
        />
      )}
      {exists && (
        <Text accessibilityRole="alert" style={[styles.warn, { writingDirection: direction, textAlign: 'start' }]}>
          {t('dashboard.levels.exists')}
        </Text>
      )}
      <View style={styles.buttons}>
        <Button
          testID="option-save"
          icon={controlIcon('check')}
          label={t('dashboard.save')}
          disabled={!whole || exists}
          onPress={() =>
            onDone((draft) =>
              withOption(
                draft,
                level.code,
                { ...makeOption(codes), code: editing?.code ?? makeOption(codes).code },
                editing,
                published,
              ),
            )
          }
        />
        <Button
          testID="option-cancel"
          variant="line"
          icon={controlIcon('cross')}
          label={t('dashboard.cancel')}
          onPress={() => onDone(null)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing['space-14'] },
  title: { ...typography.h3, color: colors.ink },
  warn: { ...typography.label, color: colors['notice-ink'] },
  buttons: { gap: spacing['space-8'] },
});
