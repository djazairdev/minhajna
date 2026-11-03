// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A grant's spot-check sheet on I-Grant (#594, R-7.2-06, answer 622). Before it
// is opened it says that the days are drawn at random the first time, so they
// are not known before the visit, and that opening it opens every class of the
// grant, which their teachers see in their access log, with a button to open
// it; while opening it says so, and a problem is said as an alert with a way to
// try again. Once open, each drawn day with its held signed sessions, each by
// its class, its group when it has one, its subject and its timetable slot,
// said held in the signed record, beside a field named for that session for
// what the pupils' exercise books show, or that the day no longer has one; or,
// with no day drawn, that alone; then the notes kept for sessions no longer
// held in the signed record, each by what its key names, kept on every saving;
// then the inspector's notes, as kept, and a button to save them on the phone,
// which says it is saving, then announces that it saved, said until the notes
// change again, or says the problem as an alert, announced on the phone. A
// grant that has ended opens no sheet: it shows the days and notes the phone
// kept for it, read only (KeptSheet.tsx), each note by its class's number in
// the grant, its group, day and start, in the order of day and start, and the
// inspector's notes under their label. The foot says the sheet stays on the
// phone, is sent nowhere, and is not printed in a demo world, since a sheet
// printed from it could pass for a real one.

import { SPOT_NOTE_MOST, type Day, type SpotRow, type SpotSheet as Sheet } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useEffect, useEffectEvent, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { TextField } from '../components/TextField';
import { colors, radius, spacing, typography } from '../design/tokens';
import { onPc, useDeviceText } from '../text/device-text';
import { spanText } from '../timetable/grid-text';
import { isolate } from '../week/grid-labels';
import { useSaid } from '../week/useSaid';
import type { SheetState } from './grant-state';
import { KeptSheet, keptRow, lesson, type Names } from './KeptSheet';

export type SpotSheetProps = {
  readonly testID: string;
  readonly state: SheetState | undefined;
  readonly ended: boolean;
  /** The sheet the phone kept for an ended grant, or null. */
  readonly kept: Sheet | null;
  /** The grant's courses in the order it first names them, which name an ended grant's classes by number. */
  readonly courses: readonly string[];
  readonly dayText: (day: Day) => string;
  readonly onOpen: () => void;
  readonly onSave: (sheet: Sheet) => void;
};

type Open = Extract<SheetState, { state: 'open' }>;

const sameBooks = (a: Sheet['books'], b: Sheet['books']) =>
  a.length === b.length && a.every((one) => b.some((other) => other.row === one.row && other.note === one.note));

/** The sheet's days and fields, its notes kept as typed until saved. */
function SheetForm(props: { testID: string; open: Open } & Pick<SpotSheetProps, 'dayText' | 'onSave'>) {
  const { testID, open, dayText, onSave } = props;
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const { sheet, rows, classes } = open.opened;
  const [notes, setNotes] = useState(sheet.notes);
  const [books, setBooks] = useState(() => new Map(sheet.books.map((one) => [one.row, one.note])));
  const { say, region } = useSaid('', `${testID}-said`);
  const saved = useEffectEvent(() => say(t('demo.inspectorGrant.sheetSaved')));
  const failed = useEffectEvent(() => {
    if (open.problem !== null && !onPc()) say(t(open.problem));
  });
  useEffect(() => {
    if (open.saved > 0) saved();
  }, [open.saved]);
  useEffect(() => {
    failed();
  }, [open.problem]);
  const names: Names = new Map(
    [...classes].flatMap(([course, read]) => (read === null ? [] : [[course, read.delivery] as const])),
  );
  const shown = new Set(rows.map((one) => one.key));
  const gone = sheet.books.filter((one) => !shown.has(one.row));
  const draft: Sheet = {
    ...sheet,
    notes,
    books: [
      ...gone,
      ...rows.flatMap((row) => {
        const note = books.get(row.key) ?? '';
        return note === '' ? [] : [{ row: row.key, note }];
      }),
    ],
  };
  const edited = notes !== sheet.notes || !sameBooks(draft.books, sheet.books);
  const line = (row: SpotRow) =>
    t('demo.inspectorGrant.sheetRow', {
      class: lesson(row),
      subject: isolate(row.subject),
      slot: isolate(spanText(row.start, row.end)),
    });
  return (
    <>
      <Text accessibilityRole="header" style={[styles.label, align]}>
        {t('demo.inspectorGrant.sheetTitle')}
      </Text>
      {sheet.days.length === 0 ? (
        <Text style={[styles.body, align]}>{t('demo.inspectorGrant.sheetNoDays')}</Text>
      ) : (
        sheet.days.map((day) => (
          <View key={day} testID={`${testID}-day-${day}`} style={styles.day}>
            <Text accessibilityRole="header" style={[styles.head, align]}>
              {dayText(day)}
            </Text>
            {rows.every((row) => row.day !== day) && (
              <Text style={[styles.small, align]}>{t('demo.inspectorGrant.sheetDayNone')}</Text>
            )}
            {rows.map((row, at) =>
              row.day !== day ? null : (
                <View key={row.key} style={styles.row}>
                  <Text style={[styles.body, align]}>{line(row)}</Text>
                  <Text style={[styles.small, align]}>{t('demo.inspectorGrant.sheetSigned')}</Text>
                  <TextField
                    testID={`${testID}-row-${at}`}
                    label={t('demo.inspectorGrant.sheetBooksFor', { row: line(row) })}
                    placeholder={t('demo.inspectorGrant.sheetBooksHint')}
                    value={books.get(row.key) ?? ''}
                    onChangeText={(note) => setBooks((before) => new Map(before).set(row.key, note))}
                    maxLength={SPOT_NOTE_MOST}
                  />
                </View>
              ),
            )}
          </View>
        ))
      )}
      {gone.length > 0 && (
        <View testID={`${testID}-gone`} style={styles.day}>
          <Text accessibilityRole="header" style={[styles.head, align]}>
            {t('demo.inspectorGrant.sheetGone')}
          </Text>
          {gone.map((one) => (
            <Text key={one.row} style={[styles.body, align]}>
              {t('demo.inspectorGrant.sheetKept', { row: keptRow(one.row, names, dayText), note: one.note })}
            </Text>
          ))}
        </View>
      )}
      <TextField
        testID={`${testID}-notes`}
        label={t('demo.inspectorGrant.sheetNotes')}
        placeholder={t('demo.inspectorGrant.sheetNotesHint')}
        value={notes}
        onChangeText={setNotes}
        multiline
        maxLength={SPOT_NOTE_MOST}
      />
      <Button
        testID={`${testID}-save`}
        label={t(open.saving ? 'demo.inspectorGrant.sheetSaving' : 'demo.inspectorGrant.sheetSave')}
        onPress={() => onSave(draft)}
      />
      {open.problem !== null && (
        <Text accessibilityRole="alert" style={[styles.problem, align]}>
          {t(open.problem)}
        </Text>
      )}
      {open.saved > 0 && !open.saving && open.problem === null && !edited && (
        <Text testID={`${testID}-saved`} style={[styles.small, align]}>
          {t('demo.inspectorGrant.sheetSaved')}
        </Text>
      )}
      {region}
    </>
  );
}

/** A grant's spot-check sheet, opened on demand, kept on the phone. */
export function SpotSheet({ testID, state, ended, kept, courses, dayText, onOpen, onSave }: SpotSheetProps) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const closed =
    kept === null ? (
      <Text style={[styles.body, align]}>{t('demo.inspectorGrant.sheetEnded')}</Text>
    ) : (
      <KeptSheet testID={testID} kept={kept} courses={courses} dayText={dayText} />
    );
  const unopened = (
    <>
      <Text style={[styles.body, align]}>{t('demo.inspectorGrant.sheetIntro')}</Text>
      {state?.state === 'opening' && <Text style={[styles.small, align]}>{t('demo.inspectorGrant.sheetOpening')}</Text>}
      {state?.state === 'problem' && (
        <Text accessibilityRole="alert" style={[styles.problem, align]}>
          {t(state.words)}
        </Text>
      )}
      {state?.state !== 'opening' && (
        <>
          <Button
            testID={`${testID}-open`}
            label={t(state === undefined ? 'demo.inspectorGrant.sheetOpen' : 'demo.inspectorGrant.again')}
            onPress={onOpen}
          />
          <Text style={[styles.small, align]}>{t('demo.inspectorGrant.sheetOpenLine')}</Text>
        </>
      )}
    </>
  );
  return (
    <View testID={testID} style={styles.card}>
      {ended ? (
        closed
      ) : state?.state === 'open' ? (
        <SheetForm
          key={state.opened.sheet.days.join()}
          testID={testID}
          open={state}
          dayText={dayText}
          onSave={onSave}
        />
      ) : (
        unopened
      )}
      <Text style={[styles.small, align]}>{t('demo.inspectorGrant.sheetFoot')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.paper,
    padding: spacing['space-12'],
    gap: spacing['space-8'],
  },
  day: { gap: spacing['space-8'] },
  row: { gap: spacing['space-4'] },
  head: { ...typography.label, color: colors.ink },
  label: { ...typography.label, color: colors.ink2 },
  body: { ...typography.body, color: colors.ink },
  small: { ...typography.small, color: colors.ink2 },
  problem: { ...typography.body, color: colors['error-ink'] },
});
