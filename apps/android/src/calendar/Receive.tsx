// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  CalendarNoticeError,
  calendarImpact,
  receiveCalendarNotice,
  type CalendarEntry,
  type CalendarImpact,
  type CalendarNotice,
  type ReceivedNotice,
  type State,
} from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useRef, useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { CheckRow } from '../components/CheckRow';
import { ChipGroup } from '../components/Chip';
import { Notice } from '../components/Notice';
import { controlIcon } from '../design/Icon';
import { spacing } from '../design/tokens';
import { settingsStyles as styles } from '../settings/styles';
import { coreContext } from '../storage/core-context';
import { useAppData } from '../storage/AppData';
import { useText } from '../text/i18n';
import { Impact } from './Impact';
import { ReceiveNotice } from './ReceiveNotice';
import { SaveProblem } from './SaveProblem';
import { useCalendarSave } from './useCalendarSave';
import { useNoticeInput } from './useNoticeInput';

type Prepared = { result: ReceivedNotice; impact: CalendarImpact | null; state: State; schoolId: string };

/** File and QR use one preview gate; no input or ignored notice writes history, and a duplicate never appends twice. */
export function Receive({
  schoolId: initial,
  onSaved,
  onIgnore,
}: {
  schoolId: string;
  onSaved: (entry: CalendarEntry, schoolId: string) => void;
  onIgnore: () => void;
}) {
  const data = useAppData();
  const t = useText();
  const { direction } = useLocale();
  const insets = useSafeAreaInsets();
  const writer = useCalendarSave();
  const [schoolId, setSchool] = useState(initial);
  const [notice, setNotice] = useState<CalendarNotice | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [problem, setProblem] = useState<'invalid' | 'scope' | 'conflict' | 'acknowledge' | null>(null);
  const [shown, setShown] = useState<Prepared | null>(null);
  const prepared = useRef<Prepared | null>(null);
  const invalidate = () => {
    prepared.current = null;
    setShown(null);
    setProblem(null);
  };
  const input = useNoticeInput((next) => {
    invalidate();
    setAcknowledged(false);
    setNotice(next);
  });
  const busy = input.busy || writer.busy;
  const read = (mode: 'file' | 'qr') => {
    if (input.isBusy() || writer.isBusy()) return;
    void input.read(mode);
  };
  const change = (work: () => void) => {
    if (input.isBusy() || writer.isBusy()) return;
    invalidate();
    work();
  };
  const preview = () => {
    if (input.isBusy() || writer.isBusy() || notice === null) return;
    try {
      const context = coreContext(data);
      const result = receiveCalendarNotice(context, notice, schoolId, acknowledged);
      const next = {
        result,
        impact: result.status === 'new' ? calendarImpact(context, result.event, data.today()) : null,
        state: data.state,
        schoolId,
      };
      prepared.current = next;
      setShown(next);
      setProblem(null);
    } catch (error) {
      invalidate();
      setProblem(
        error instanceof CalendarNoticeError && ['scope', 'conflict', 'acknowledge'].includes(error.problem)
          ? (error.problem as 'scope' | 'conflict' | 'acknowledge')
          : 'invalid',
      );
    }
  };
  const save = async () => {
    const next = prepared.current;
    if (next?.result.status === 'new' && (await writer.save(next.result.event, next.state)))
      onSaved(next.result.entry, next.schoolId);
  };
  const align = { writingDirection: direction, textAlign: 'start' } as const;
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
      <Notice icon={controlIcon('info')} message={t('calendarView.receive.notice')} />
      <Button
        testID="calendar-receive-file"
        label={t('calendarView.receive.file')}
        disabled={busy}
        onPress={() => read('file')}
      />
      <Button
        testID="calendar-receive-qr"
        variant="line"
        label={t('calendarView.receive.qr')}
        disabled={busy}
        onPress={() => read('qr')}
      />
      {input.problem !== null && (
        <Notice
          testID="calendar-input-problem"
          icon={controlIcon('info')}
          message={t(`calendarView.receive.problems.${input.problem}`)}
        />
      )}
      {notice !== null && (
        <>
          <ReceiveNotice notice={notice} />
          <ChipGroup
            testID="calendar-receive-school"
            label={t('calendarView.school')}
            selected={schoolId}
            choices={[...data.state.schools.values()].map((one) => ({ value: one.id, label: one.name }))}
            onSelect={(next) =>
              change(() => {
                setSchool(next);
                setAcknowledged(false);
              })
            }
          />
          <Text style={[styles.body, align]}>{t('calendarView.receive.scopeHint')}</Text>
          <CheckRow
            testID="calendar-receive-acknowledge"
            label={t('calendarView.receive.acknowledge')}
            checked={acknowledged}
            disabled={busy}
            onCheckedChange={(next) => change(() => setAcknowledged(next))}
          />
          <Button
            testID="calendar-receive-preview"
            label={t('calendarView.edit.previewButton')}
            disabled={busy}
            onPress={preview}
          />
        </>
      )}
      {problem !== null && (
        <Notice
          testID="calendar-receive-problem"
          icon={controlIcon('info')}
          message={t(`calendarView.receive.problems.${problem}`)}
        />
      )}
      {shown?.impact !== null && shown?.impact !== undefined && <Impact impact={shown.impact} />}
      {shown?.result.status === 'duplicate' && (
        <Notice
          testID="calendar-receive-duplicate"
          icon={controlIcon('info')}
          message={t('calendarView.receive.duplicate')}
        />
      )}
      <SaveProblem testID="calendar-receive-failed" problem={writer.problem} />
      {shown?.result.status === 'new' && (
        <Button testID="calendar-receive-save" label={t('calendarView.receive.add')} disabled={busy} onPress={save} />
      )}
      <Button
        testID="calendar-receive-ignore"
        variant="line"
        label={t('calendarView.receive.ignore')}
        disabled={busy}
        onPress={onIgnore}
      />
    </ScrollView>
  );
}
