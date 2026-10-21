// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «قائمة الدعم» (#228, Support-queue, R-4.7-08, answers 359 and 360): the
// class's own list of support items, in order. Each support or «تدارك»
// session logged for the class takes the first item it has not finished;
// each item shows the dates of the sessions that took it, finished ones say
// so, and the next one is marked. Items left come first, then finished ones
// under «أُنجز», with the queue's own counts on top. An item is selected to
// move it up or down within its group or delete it, «تراجع» undoing a
// delete; a new one is typed at the end, on one plain line. Every change is
// saved at once. The queue never moves the main plan.

import { SUPPORT_TITLE_MAX, saveSupportQueue, supportQueueRows, type SupportItem } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { OptionRow } from '../components/OptionRow';
import { Snackbar } from '../components/Snackbar';
import { TextField } from '../components/TextField';
import { colors, spacing, typography } from '../design/tokens';
import { courseLabel } from '../exams/course-label';
import { useAppData } from '../storage/AppData';
import { currentLanguage, useText } from '../text/i18n';
import { dayName } from '../today/DayMark';
import { isolate } from '../week/grid-labels';
import { plain } from './error-report';

export type SupportQueueProps = { readonly courseId: string; readonly onLog?: () => void };

/** The text with each control character, line breaks included, made a space. */
function oneLine(text: string): string {
  return [...text].map((char) => ((char.codePointAt(0) ?? 32) < 32 || char === '\u007f' ? ' ' : char)).join('');
}

export function SupportQueue({ courseId, onLog }: SupportQueueProps) {
  const t = useText();
  const { state, profile, record, newId } = useAppData();
  const { direction } = useLocale();
  const insets = useSafeAreaInsets();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const language = currentLanguage();
  const rows = useMemo(() => supportQueueRows(state, courseId), [state, courseId]);
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [tried, setTried] = useState(false);
  const [removed, setRemoved] = useState<readonly SupportItem[] | null>(null);
  const savedFrom = useRef<typeof state | null>(null);
  const items = rows.map((row) => row.item);
  const at = items.findIndex((item) => item.id === selected);
  const left = rows.filter((row) => !row.finished);
  const done = rows.filter((row) => row.finished);
  const next = left[0]?.item.id;
  const group = rows[at]?.finished === true ? done : left;
  const place = group.findIndex((row) => row.item.id === selected);
  const className = courseLabel(t, state, profile, courseId);
  const title = draft.trim();
  const tooLong = title.length > SUPPORT_TITLE_MAX;

  const save = (list: readonly SupportItem[]): boolean => {
    if (savedFrom.current === state) return false;
    try {
      record(saveSupportQueue(state, { courseId, items: list }));
    } catch (error: unknown) {
      if (__DEV__) console.warn('A support list was refused', error);
      return false;
    }
    savedFrom.current = state;
    return true;
  };
  const move = (by: -1 | 1) => {
    const other = group[place + by]?.item;
    const item = items[at];
    if (other === undefined || item === undefined) return;
    const list = items.map((one) => (one.id === item.id ? other : one.id === other.id ? item : one));
    if (save(list)) setRemoved(null);
  };
  const remove = () => {
    if (at < 0 || !save(items.filter((item) => item.id !== selected))) return;
    setRemoved(items);
    setSelected(null);
  };
  const undo = () => {
    if (removed !== null && save(removed)) setRemoved(null);
  };
  const add = () => {
    setTried(true);
    if (title === '' || tooLong || !save([...items, { id: newId(), title }])) return;
    setDraft('');
    setTried(false);
    setRemoved(null);
  };
  const status = (row: (typeof rows)[number]) => {
    const dates = row.sessions.map((one) => dayName(t, one.day, language, profile)).join(t('addSessions.separator'));
    if (row.finished) return t('supportQueue.finished', { dates });
    if (row.item.id === next) return dates === '' ? t('supportQueue.next') : t('supportQueue.nextTaken', { dates });
    return dates === '' ? t('supportQueue.notYet') : t('supportQueue.taken', { dates });
  };

  const option = (row: (typeof rows)[number]) => (
    <OptionRow
      key={row.item.id}
      testID={`support-item-${row.item.id}`}
      label={`${items.indexOf(row.item) + 1}. ${isolate(row.item.title)}`}
      sub={status(row)}
      selected={row.item.id === selected}
      onPress={() => setSelected(row.item.id === selected ? null : row.item.id)}
    />
  );

  return (
    <View style={styles.screen}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          {
            direction,
            paddingLeft: insets.left + spacing['space-16'],
            paddingRight: insets.right + spacing['space-16'],
            paddingBottom: insets.bottom + (removed === null ? spacing['space-24'] : 96),
          },
        ]}
      >
        <Text accessibilityRole="header" style={[styles.title, align]}>
          {t('supportQueue.heading', { class: isolate(className) })}
        </Text>
        <Text style={[styles.body, align]}>{t('supportQueue.intro')}</Text>
        <Text testID="support-count" style={[styles.sub, align]}>
          {rows.length === 0
            ? t('supportQueue.empty')
            : t('supportQueue.counts', {
                items: t('count.items', { count: rows.length }),
                done: done.length,
                left: left.length,
              })}
        </Text>
        {left.map(option)}
        {done.length > 0 && (
          <Text accessibilityRole="header" style={[styles.label, align]}>
            {t('supportQueue.done')}
          </Text>
        )}
        {done.map(option)}
        {rows.length > 0 && (
          <>
            <View style={styles.edit}>
              <View style={styles.grow}>
                <Button
                  testID="support-up"
                  variant="line"
                  label={t('supportQueue.up')}
                  disabled={place <= 0}
                  onPress={() => move(-1)}
                />
              </View>
              <View style={styles.grow}>
                <Button
                  testID="support-down"
                  variant="line"
                  label={t('supportQueue.down')}
                  disabled={place < 0 || place === group.length - 1}
                  onPress={() => move(1)}
                />
              </View>
              <View style={styles.grow}>
                <Button
                  testID="support-delete"
                  variant="line"
                  label={t('supportQueue.delete')}
                  disabled={at < 0}
                  onPress={remove}
                />
              </View>
            </View>
            <Text style={[styles.sub, align]}>{t('supportQueue.editLine')}</Text>
          </>
        )}
        <TextField
          testID="support-new"
          label={t('supportQueue.newItem')}
          placeholder={t('supportQueue.newPlaceholder')}
          value={draft}
          onChangeText={(value) => setDraft(oneLine(plain(value)))}
          {...(tooLong
            ? { error: t('supportQueue.tooLong', { max: SUPPORT_TITLE_MAX }) }
            : tried && title === '' && { error: t('supportQueue.missing') })}
        />
        <Text style={[styles.sub, align]}>{t('supportQueue.privacy')}</Text>
        <Button testID="support-add" variant="line" label={t('supportQueue.add')} onPress={add} />
        <Text style={[styles.sub, align]}>{t('supportQueue.page')}</Text>
        {onLog !== undefined && (
          <Button testID="support-log" variant="line" label={t('supportQueue.log')} onPress={onLog} />
        )}
      </ScrollView>
      {removed !== null && (
        <Snackbar
          testID="support-removed"
          message={t('supportQueue.removed')}
          undoLabel={t('planItem.undo')}
          onUndo={undo}
          bottomOffset={insets.bottom}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { gap: spacing['space-12'], paddingTop: spacing['space-16'] },
  edit: { flexDirection: 'row', gap: spacing['space-8'] },
  grow: { flex: 1 },
  title: { ...typography.label, color: colors.ink },
  label: { ...typography.label, color: colors.ink2 },
  body: { ...typography.body, color: colors.ink },
  sub: { ...typography.caption, color: colors.ink2 },
});
