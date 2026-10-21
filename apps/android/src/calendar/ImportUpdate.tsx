// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Importing a signed calendar update or plan pack without a network (#223,
// R-4.8-03 to R-4.8-05, R-4.5-15), from Calendar, Settings or the pack list
// (answers 309 and 326). A checked file shows what it holds and what it
// changes before it is applied; a refused one shows why, and nothing in the
// record, the calendar or the plans changes. A pack, once added, opens the
// pack list for its grade and subject (answer 331).

import {
  addPack,
  applyCalendarUpdate,
  formatDay,
  packAddStatus,
  parsePackId,
  teacherChanges,
  updateImpact,
  updateStatus,
  type CalendarImpact,
  type State,
  type UpdateChange,
  type UpdateStatus,
} from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useMemo, useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { Notice } from '../components/Notice';
import { controlIcon } from '../design/Icon';
import { spacing } from '../design/tokens';
import { settingsStyles as styles } from '../settings/styles';
import { coreContext } from '../storage/core-context';
import { useAppData } from '../storage/AppData';
import { useText } from '../text/i18n';
import { Impact } from './Impact';
import { PackDetails } from './PackDetails';
import { SaveProblem } from './SaveProblem';
import { UpdateDetails } from './UpdateDetails';
import { UpdateRefused } from './UpdateRefused';
import { useCalendarSave } from './useCalendarSave';
import { useUpdateInput } from './useUpdateInput';

interface Prepared {
  readonly status: UpdateStatus;
  readonly mine: readonly UpdateChange[];
  readonly others: number;
  readonly impact: CalendarImpact | null;
  readonly state: State;
}

export function ImportUpdate({
  onApplied,
  onAdded,
  onReport,
  onPlan,
}: {
  onApplied: (release: string) => void;
  onAdded: (grade: string, subject: string) => void;
  onReport: () => void;
  onPlan?: (courseId: string) => void;
}) {
  const data = useAppData();
  const t = useText();
  const { direction } = useLocale();
  const insets = useSafeAreaInsets();
  const input = useUpdateInput();
  const writer = useCalendarSave();
  const [stale, setStale] = useState(false);
  const busy = input.busy || writer.busy;
  const opened = input.opened;
  const prepared = useMemo((): Prepared | null => {
    if (opened?.read.ok !== true || opened.read.kind !== 'calendar') return null;
    const context = coreContext(data);
    const status = updateStatus(context, opened.read.update);
    const { mine, others } = teacherChanges(context, opened.read.update);
    const impact = status === 'new' ? updateImpact(context, opened.read.update, data.today()) : null;
    return { status, mine, others, impact, state: data.state };
  }, [opened, data]);
  const packStatus = useMemo(
    () =>
      opened?.read.ok === true && opened.read.kind === 'packs'
        ? { status: packAddStatus(coreContext(data), opened.read.pack.pack), state: data.state }
        : null,
    [opened, data],
  );
  const read = (via: 'file' | 'qr') => {
    if (input.isBusy() || writer.isBusy()) return;
    setStale(false);
    void input.read(via);
  };
  const add = async () => {
    if (opened?.read.ok !== true || opened.read.kind !== 'packs' || packStatus?.status !== 'new') return;
    if (input.isBusy() || writer.isBusy()) return;
    const { pack: update, key, file } = opened.read;
    const parts = parsePackId(update.pack.id);
    setStale(false);
    let event;
    try {
      event = addPack(coreContext(data), update, key.id, file);
    } catch {
      setStale(true);
      return;
    }
    if ((await writer.save(event, packStatus.state)) && parts !== null) onAdded(parts.grade, parts.subject);
  };
  const apply = async () => {
    if (opened?.read.ok !== true || opened.read.kind !== 'calendar' || prepared?.status !== 'new') return;
    if (input.isBusy() || writer.isBusy()) return;
    const { update, key, file } = opened.read;
    setStale(false);
    let event;
    try {
      event = applyCalendarUpdate(coreContext(data), update, key.id, file);
    } catch {
      setStale(true);
      return;
    }
    if (await writer.save(event, prepared.state)) onApplied(update.release);
  };
  const via = opened === null ? '' : t(`calendarView.update.via.${opened.via}`, { day: formatDay(opened.day) });
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
      <Text style={[styles.sub, { writingDirection: direction, textAlign: 'start' }]}>
        {t('calendarView.update.lead')}
      </Text>
      <Notice icon={controlIcon('info')} message={t('calendarView.update.hint')} />
      <Button testID="update-qr" label={t('calendarView.receive.qr')} disabled={busy} onPress={() => read('qr')} />
      <Button
        testID="update-file"
        variant="line"
        label={opened?.read.ok === false ? t('calendarView.update.another') : t('calendarView.receive.file')}
        disabled={busy}
        onPress={() => read('file')}
      />
      {input.unreadable && (
        <Notice
          testID="update-unreadable"
          icon={controlIcon('info')}
          message={t('calendarView.receive.problems.input')}
        />
      )}
      {opened?.read.ok === false && (
        <UpdateRefused problem={opened.read.problem} signer={opened.read.key} via={via} onReport={onReport} />
      )}
      {opened?.read.ok === true && opened.read.kind === 'packs' && packStatus !== null && (
        <PackDetails update={opened.read.pack} signer={opened.read.key} status={packStatus.status} via={via} />
      )}
      {opened?.read.ok === true && opened.read.kind === 'calendar' && prepared !== null && (
        <UpdateDetails
          update={opened.read.update}
          signer={opened.read.key}
          status={prepared.status}
          via={via}
          mine={prepared.mine}
          others={prepared.others}
        />
      )}
      {prepared?.impact != null && prepared.mine.length > 0 && (
        <Impact impact={prepared.impact} {...(onPlan !== undefined && { onPlan })} />
      )}
      <SaveProblem testID="update-save-failed" problem={writer.problem ?? (stale ? 'changed' : null)} />
      {prepared?.status === 'new' && (
        <Button testID="update-apply" label={t('calendarView.update.apply')} disabled={busy} onPress={apply} />
      )}
      {opened?.read.ok === true && opened.read.kind === 'packs' && packStatus?.status === 'new' && (
        <Button
          testID="update-apply"
          label={t('calendarView.update.pack.apply', { release: opened.read.pack.pack.release })}
          disabled={busy}
          onPress={add}
        />
      )}
    </ScrollView>
  );
}
