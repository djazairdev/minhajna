// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A school-space panel, not a preview route. Its host must supply the
// authenticated, school-bound book and readable staff/timetable labels.
// Permissions are enforced again by the book, not by these controls.

import {
  canonicalJson,
  formatDay,
  type CoverChoice,
  type CoverSession,
  type CoverSheetRow,
  type Day,
  type SchoolCoverBook,
} from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { ChipGroup } from '../components/Chip';
import { Notice } from '../components/Notice';
import { controlIcon } from '../design/Icon';
import { settingsStyles as styles } from '../settings/styles';
import { useText } from '../text/i18n';

const kinds: readonly CoverChoice['kind'][] = [
  'supervision',
  'study-room',
  'colleague',
  'merge',
  'swap',
  'move',
  'release',
];

/** Principal/deputy cover choices from the school timetable, with durable success and explicit cancellation. */
export function CoverBoard({
  book,
  day,
  staffName,
  sessionName,
}: {
  book: SchoolCoverBook;
  day: Day;
  staffName: (id: string) => string;
  sessionName: (id: string) => string;
}) {
  const t = useText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const [selected, select] = useState<string | null>(null);
  const [kind, setKind] = useState<CoverChoice['kind']>('supervision');
  const [choice, choose] = useState<string | null>(null);
  const [said, say] = useState<'saved' | 'failed' | null>(null);
  const [cancel, setCancel] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [, redraw] = useState(0);
  const saving = useRef(false);
  let sessions: readonly CoverSession[];
  let sheet: readonly CoverSheetRow[];
  let offered: readonly CoverChoice[];
  try {
    sessions = book.sessions(day);
    sheet = book.dailySheet(day);
    offered = selected !== null && sessions.some((one) => one.id === selected) ? book.choices(selected, kind) : [];
  } catch {
    return <Notice testID="school-cover-denied" icon={controlIcon('info')} message={t('schoolCover.board.denied')} />;
  }
  const options = offered.map((one) => ({
    value: canonicalJson(one),
    label:
      'teacherId' in one && one.teacherId !== undefined
        ? [
            staffName(one.teacherId),
            ...(one.kind === 'merge'
              ? [sessions.find((session) => session.classId === one.classId)?.className ?? one.classId]
              : []),
          ].join(' · ')
        : 'sessionId' in one
          ? sessionName(one.sessionId)
          : t(`schoolCover.cover.kinds.${one.kind}`),
  }));
  const picked =
    offered.find((one) => canonicalJson(one) === choice) ?? (offered.length === 1 ? offered[0] : undefined);
  const work = async (action: () => Promise<void>) => {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    say(null);
    try {
      await action();
      say('saved');
      setCancel(null);
    } catch {
      say('failed');
    } finally {
      saving.current = false;
      setBusy(false);
      redraw((value) => value + 1);
    }
  };
  return (
    <ScrollView contentContainerStyle={[styles.content, { direction }]}>
      <Text accessibilityRole="header" style={[styles.title, align]}>
        {t('schoolCover.board.title')} · {formatDay(day)}
      </Text>
      <Text style={[styles.body, align]}>{t('schoolCover.board.notice')}</Text>
      <ChipGroup
        testID="school-cover-session"
        label={t('schoolCover.board.session')}
        choices={sessions.map((one) => ({
          value: one.id,
          label: `${one.className} · ${t('schoolCover.cover.slot', {
            half: t(`calendarView.periods.${one.slot.half}`),
            index: one.slot.index,
          })}`,
        }))}
        selected={selected}
        onSelect={(id) => {
          if (saving.current) return;
          select(id);
          choose(null);
          say(null);
        }}
      />
      <ChipGroup
        testID="school-cover-kind"
        label={t('schoolCover.board.kind')}
        choices={kinds.map((value) => ({ value, label: t(`schoolCover.cover.kinds.${value}`) }))}
        selected={kind}
        onSelect={(value) => {
          if (saving.current) return;
          setKind(value);
          choose(null);
          say(null);
        }}
      />
      {options.length > 0 && (
        <ChipGroup
          testID="school-cover-choice"
          label={t('schoolCover.board.arrangement')}
          choices={options}
          selected={picked === undefined ? null : canonicalJson(picked)}
          onSelect={(value) => {
            if (!saving.current) choose(value);
          }}
        />
      )}
      <Button
        testID="school-cover-save"
        label={t('schoolCover.board.save')}
        disabled={busy || picked === undefined}
        onPress={() => {
          if (selected === null || picked === undefined) return;
          void work(async () => {
            await book.need(selected, day);
            await book.assign(selected, picked, day);
          });
        }}
      />
      {said !== null && (
        <Notice testID="school-cover-result" icon={controlIcon('info')} message={t(`schoolCover.board.${said}`)} />
      )}
      {sheet.map((row) => (
        <View key={row.session.id} style={styles.card}>
          <Text style={[styles.body, align]}>
            {row.session.className} · {t(`schoolCover.cover.kinds.${row.choice.kind}`)}
          </Text>
          {'teacherId' in row.choice && row.choice.teacherId !== undefined && (
            <Text style={[styles.body, align]}>{staffName(row.choice.teacherId)}</Text>
          )}
          <Text style={[styles.sub, align]}>
            {t(`schoolCover.cover.${row.completed ? 'completed' : row.assigned ? 'assigned' : 'needed'}`)}
          </Text>
          {!row.completed && (
            <Button
              testID={`school-cover-cancel-${row.session.id}`}
              variant="line"
              label={t('schoolCover.board.cancel')}
              disabled={busy}
              onPress={() => setCancel(row.session.id)}
            />
          )}
        </View>
      ))}
      {cancel !== null && (
        <View style={styles.card}>
          <Text style={[styles.body, align]}>{t('schoolCover.board.cancelNotice')}</Text>
          <Button
            testID="school-cover-confirm-cancel"
            variant="danger"
            label={t('schoolCover.board.confirmCancel')}
            disabled={busy}
            onPress={() => void work(() => book.cancel(cancel, day))}
          />
          <Button
            testID="school-cover-keep"
            variant="line"
            label={t('schoolCover.board.keep')}
            disabled={busy}
            onPress={() => setCancel(null)}
          />
        </View>
      )}
    </ScrollView>
  );
}
