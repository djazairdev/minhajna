// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What a calendar update changed (Calendar-update board, R-4.5-15): the
// update, when it was applied and who signed it, the entries that concern
// the teacher, with the others counted, and the sessions it still takes or
// gives back from today on (answer 314); for one the bundled calendar now
// holds, only that it does. Opened after applying (answer 312), from
// Today's card (answer 311) and from the Calendar's footnote (answer 313).

import { formatDay } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { ScrollView, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { Notice } from '../components/Notice';
import { controlIcon } from '../design/Icon';
import { spacing } from '../design/tokens';
import { localized } from '../setup/names';
import { settingsStyles as styles } from '../settings/styles';
import { useAppData } from '../storage/AppData';
import { useText } from '../text/i18n';
import { isolate } from '../week/grid-labels';
import { Impact } from './Impact';
import { UpdateChangeList } from './UpdateChangeList';
import { useAppliedChanges } from './useAppliedChanges';

/** Who holds a key, as the app's key list names them, or its ID for a key no longer listed. */
export function holderOf(keys: ReturnType<typeof useAppData>['keys'], id: string): string {
  const key = keys.find((one) => one.id === id);
  return isolate(key === undefined ? id : localized(key.holder));
}

export function UpdateChanges({
  release,
  onCalendar,
  onPlan,
}: {
  release: string;
  onCalendar: () => void;
  onPlan?: (courseId: string) => void;
}) {
  const data = useAppData();
  const t = useText();
  const { direction } = useLocale();
  const insets = useSafeAreaInsets();
  const changes = useAppliedChanges(data, release);
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const on = data.state.calendarUpdatedOn.get(release);
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        {
          direction,
          paddingLeft: insets.left + spacing['space-16'],
          paddingRight: insets.right + spacing['space-16'],
          paddingBottom: insets.bottom + spacing['space-24'],
        },
      ]}
    >
      {changes === null ? (
        <Text style={[styles.body, align]}>{t('calendarView.missing')}</Text>
      ) : (
        <>
          <Text accessibilityRole="header" style={[styles.title, align]}>
            {t('calendarView.update.changed.title')}
          </Text>
          <Text style={[styles.body, align]}>
            {t('calendarView.update.changed.of', {
              day: formatDay(changes.applied.update.published),
              release: isolate(release),
            })}
          </Text>
          {on !== undefined && (
            <Text testID="update-applied-on" style={[styles.body, align]}>
              {t('calendarView.update.changed.applied', {
                day: formatDay(on),
                holder: holderOf(data.keys, changes.applied.key),
              })}
            </Text>
          )}
          {!changes.laid && (
            <Notice
              testID="update-bundled"
              icon={controlIcon('info')}
              message={t('calendarView.update.changed.bundled')}
            />
          )}
          {changes.laid && (
            <>
              <Text accessibilityRole="header" style={[styles.title, align]}>
                {t('calendarView.update.changes')}
              </Text>
              <UpdateChangeList
                mine={changes.mine}
                others={changes.others}
                published={changes.applied.update.published}
              />
              {changes.mine.length > 0 && changes.impact.changes.length > 0 && (
                <Impact
                  impact={changes.impact}
                  heading={t('calendarView.update.changed.sessions')}
                  {...(onPlan !== undefined && { onPlan })}
                />
              )}
            </>
          )}
          <Text style={[styles.sub, align]}>{t('calendarView.update.changed.recorded')}</Text>
        </>
      )}
      <Button testID="update-to-calendar" label={t('calendarView.update.changed.toCalendar')} onPress={onCalendar} />
    </ScrollView>
  );
}
