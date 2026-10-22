// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A timetabled «معالجة» or «دعم» session on Today (#230, P-Today, answer
// 376): its class's list, the items not yet finished paired in order with
// the day's and the coming sessions that take it, «اليوم», «الحصة القادمة»
// and «بعدها», and a line saying the main plan does not move. As the focus
// card, «تمّت كما هو مقترح» records the session with its item finished, and
// «نتيجة أخرى» held with the item not finished, or not held, which leaves
// the item for the next session.

import {
  compareDays,
  listKey,
  listOfType,
  listPairs,
  pairedItem,
  type Choice,
  type Context,
  type Details,
  type ListKind,
  type SessionRecord,
  type State,
  type TodaySession,
} from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View, type ViewInstance } from 'react-native';
import { Badge } from '../components/Badge';
import { BottomSheet } from '../components/BottomSheet';
import { Button } from '../components/Button';
import { DueStrip, type DueStripProps } from '../components/DueStrip';
import { OptionRow } from '../components/OptionRow';
import { MetaLine, type SessionMeta } from '../components/SessionCard';
import { controlIcon } from '../design/Icon';
import { colors, radius, shadows, spacing, typography } from '../design/tokens';
import { localized } from '../setup/names';
import { useAppData } from '../storage/AppData';
import { useText } from '../text/i18n';
import { isolate } from '../week/grid-labels';

const PLACES = ['today', 'next', 'after'] as const;

export type ListCardProps = {
  readonly testID: string;
  readonly meta: SessionMeta;
  readonly item: TodaySession;
  readonly kind: ListKind;
  readonly context: Context;
  readonly focus: boolean;
  readonly due: readonly DueStripProps[];
  /** Records the session: done or not held, with the item it took. */
  readonly onRecord: (choice: Choice | undefined, details: Details | undefined) => void;
  readonly onDetails: () => void;
};

export function ListCard({ testID, meta, item, kind, context, focus, due, onRecord, onDetails }: ListCardProps) {
  const t = useText();
  const { profile } = useAppData();
  const { direction } = useLocale();
  const [open, setOpen] = useState(false);
  const other = useRef<ViewInstance>(null);
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const { session } = item;
  const pairs = useMemo(
    () => listPairs(context, session.courseId, kind, session.day),
    [context, session.courseId, session.day, kind],
  );
  const taken = pairs.find((pair) => pair.session?.key === session.key)?.item ?? null;
  const rows = pairs
    .filter((pair) => pair.item !== null && compareDays(pair.day, session.day) >= 0)
    .slice(0, PLACES.length)
    .map((pair, index, all) => {
      const later = all.slice(0, index).filter((one) => one.day !== session.day).length;
      const place = pair.day === session.day ? 'today' : (PLACES[later + 1] ?? 'after');
      return { title: pair.item?.title ?? '', place };
    });
  const type = profile.sessionTypes.find((one) => one.code === session.sessionType);
  const head = { ...meta, subject: [type && localized(type.name), meta.subject].filter(Boolean).join(' · ') };
  const quoted = taken === null ? '' : t('tests.quoted', { title: isolate(taken.title) });
  const record = (choice: Choice | undefined, finished: boolean | null) => {
    setOpen(false);
    onRecord(choice, taken === null || finished === null ? undefined : { listItem: { id: taken.id, finished } });
  };
  return (
    <View testID={testID} style={[styles.card, focus && styles.focus, { direction }]}>
      <MetaLine meta={head} />
      <Text accessibilityRole="header" style={[styles.label, align]}>
        {t(`listToday.heading.${kind}`)}
      </Text>
      {rows.length === 0 && <Text style={[styles.body, align]}>{t(`listToday.empty.${kind}`)}</Text>}
      {rows.map((row, index) => (
        <View
          key={index}
          testID={`${testID}-row-${index}`}
          accessible
          accessibilityLabel={t('listToday.row', {
            n: index + 1,
            title: isolate(row.title),
            place: t(`listToday.${row.place}`),
          })}
          style={styles.row}
        >
          <Text style={styles.number}>{index + 1}</Text>
          <Text style={[styles.body, styles.title, align]}>{row.title}</Text>
          <Badge label={t(`listToday.${row.place}`)} variant={row.place === 'today' ? 'done' : 'default'} />
        </View>
      ))}
      <Text style={[styles.note, align]}>{t(`listToday.note.${kind}`, { subject: meta.subject ?? '' })}</Text>
      {due.map((strip, index) => (
        <DueStrip key={index} {...strip} />
      ))}
      {focus && (
        <Button
          testID={`${testID}-confirm`}
          label={t('today.confirm')}
          icon={controlIcon('check')}
          onPress={() => record(undefined, true)}
        />
      )}
      <View style={styles.buttons}>
        {focus && (
          <View style={styles.half}>
            <Button
              ref={other}
              testID={`${testID}-other`}
              variant="line"
              label={t('outcome.other')}
              onPress={() => setOpen(true)}
            />
          </View>
        )}
        <View style={styles.half}>
          <Button testID={`${testID}-details`} variant="line" label={t('entry.open')} onPress={onDetails} />
        </View>
      </View>
      <BottomSheet
        testID={`${testID}-sheet`}
        visible={open}
        title={t('outcome.title')}
        context={[head.className, head.slot, taken?.title].filter(Boolean).join(' · ')}
        reassurance={t('outcome.reassurance')}
        returnFocusRef={other}
        onClose={() => setOpen(false)}
      >
        {taken !== null && (
          <OptionRow
            testID={`${testID}-open`}
            label={t('listToday.heldOpen')}
            sub={t('listToday.heldOpenSub', { item: quoted })}
            onPress={() => record({ outcome: 'done' }, false)}
          />
        )}
        <OptionRow
          testID={`${testID}-not-held`}
          label={t('outcome.notHeld')}
          {...(taken !== null && { sub: t('listToday.notHeldSub', { item: quoted }) })}
          onPress={() => record({ outcome: 'not-held' }, null)}
        />
      </BottomSheet>
    </View>
  );
}

/** The details that record a session as proposed: for a list session, its paired item, finished. */
export function listDetails(context: Context): (item: TodaySession) => Details | undefined {
  return (item) => {
    const taken = pairedItem(context, item.session);
    return taken === null ? undefined : { listItem: { id: taken.id, finished: true } };
  };
}

/** The list a session awaiting confirmation takes, or null for one of the main plan. */
export function listOfSession(item: TodaySession): ListKind | null {
  return item.status === 'awaiting' ? listOfType(item.session.sessionType) : null;
}

/** What a recorded list session wrote: its item, and whether it was finished; null for any other. */
export function listWritten(t: ReturnType<typeof useText>, state: State, record: SessionRecord): string | null {
  const taken = record.listItem;
  const kind = listOfType(record.sessionType);
  if (taken === undefined || kind === null) return null;
  const found = state.supportQueues
    .get(listKey(record.session.courseId, kind))
    ?.items.find((one) => one.id === taken.id);
  const title = found === undefined ? t('listToday.removed') : t('tests.quoted', { title: isolate(found.title) });
  return taken.finished ? title : t('listToday.writtenOpen', { title });
}

const styles = StyleSheet.create({
  card: {
    gap: spacing['space-10'],
    paddingVertical: spacing['space-12'],
    paddingHorizontal: spacing['space-14'],
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
  },
  focus: { borderColor: colors.rule, boxShadow: shadows['shadow-focus-card'] },
  label: { ...typography.label, color: colors.ink },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing['space-8'] },
  number: { ...typography.label, color: colors.ink2, minWidth: 16 },
  title: { flex: 1 },
  body: { ...typography.body, color: colors.ink },
  note: { ...typography.caption, color: colors.ink2 },
  buttons: { flexDirection: 'row', gap: spacing['space-8'] },
  half: { flex: 1 },
});
