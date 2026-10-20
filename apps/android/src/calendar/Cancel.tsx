// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  calendarImpact,
  cancelCalendarEntry,
  cancellableCalendarEntry,
  type CalendarImpact,
  type CalendarMutation,
  type State,
} from '@minhajna/core';
import { useRef, useState } from 'react';
import { View } from 'react-native';
import { Button } from '../components/Button';
import { Notice } from '../components/Notice';
import { controlIcon } from '../design/Icon';
import { settingsStyles as styles } from '../settings/styles';
import { coreContext } from '../storage/core-context';
import { useAppData } from '../storage/AppData';
import { useText } from '../text/i18n';
import { Impact } from './Impact';
import { SaveProblem } from './SaveProblem';
import { useCalendarSave } from './useCalendarSave';
import { schoolEntries } from './view';

/** Cancellation requires an explicit preview and confirmation; it never claims to erase the history. */
export function CancelEntry({ id, schoolId, onCancelled }: { id: string; schoolId: string; onCancelled: () => void }) {
  const t = useText();
  const data = useAppData();
  const writer = useCalendarSave();
  const [shown, setShown] = useState<{ event: CalendarMutation; impact: CalendarImpact; state: State } | null>(null);
  const currentPreview = useRef(shown);
  const context = coreContext(data);
  const inScope = schoolEntries(data, schoolId).some((row) => row.origin === 'local' && row.entry.id === id);
  if (!inScope || cancellableCalendarEntry(context, id) === null) return null;
  const open = () => {
    if (writer.isBusy()) return;
    try {
      const event = cancelCalendarEntry(context, id);
      const next = { event, impact: calendarImpact(context, event, data.today()), state: data.state };
      currentPreview.current = next;
      setShown(next);
    } catch {
      setShown(null);
      currentPreview.current = null;
    }
  };
  const confirm = async () => {
    const next = currentPreview.current;
    if (next !== null && (await writer.save(next.event, next.state))) onCancelled();
  };
  return (
    <View style={styles.group}>
      {shown === null ? (
        <Button testID="calendar-cancel" variant="line" label={t('calendarView.edit.cancel')} onPress={open} />
      ) : (
        <>
          <Notice icon={controlIcon('info')} message={t('calendarView.edit.cancelNotice')} />
          <Impact impact={shown.impact} />
          <Button
            testID="calendar-confirm-cancel"
            variant="danger"
            label={t('calendarView.edit.confirmCancel')}
            onPress={confirm}
            disabled={writer.busy}
          />
          <Button
            testID="calendar-keep"
            variant="line"
            label={t('calendarView.edit.keep')}
            disabled={writer.busy}
            onPress={() => {
              if (writer.isBusy()) return;
              currentPreview.current = null;
              setShown(null);
            }}
          />
        </>
      )}
      <SaveProblem testID="calendar-cancel-failed" problem={writer.problem} />
    </View>
  );
}
