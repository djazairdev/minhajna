// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «تقويم أثناء الحصة» (#239, Capture, R-3.5-07, R-3.8-24, answers 441, 449 and
// 450): the class and today's session with its time, a chip for each session
// when the class has several today, chips for the four items, the chosen
// item's hint, then a tile for each pupil of the session's group in class-list
// order, of the course's level only in a joint class. A tap is recorded at
// once: participation and behaviour count up, homework goes from nothing to
// «لم يُنجز», «بمساعدة الغير» and back, and the notebook toggles «غير مكتمل».
// «تراجع» takes back the last tap made here, back on its session and item,
// and «تم» goes back. Today's sessions are read once, when the screen opens,
// on the first not yet recorded, else the last; with none, the screen says
// so. Taps keep no detail. What was just tapped shows at once, before the
// history's write ends, so quick taps never count from a stale value.

import {
  CAPTURE_MAX,
  captureList,
  captureSession,
  captureSessions,
  sessionCaptures,
  setCapture,
  type CaptureItem,
  type SessionRef,
} from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { ChipGroup } from '../components/Chip';
import { colors, radius, sizes, spacing, typography } from '../design/tokens';
import { courseLabel } from '../exams/course-label';
import { coreContext } from '../storage/core-context';
import { useAppData } from '../storage/AppData';
import { useText } from '../text/i18n';
import { isolate } from '../week/grid-labels';
import { captureLine, captureValue, ITEMS, sessionChip } from './capture-rules';

export type CaptureProps = {
  readonly courseId: string;
  readonly onDone: () => void;
};

interface Tap {
  readonly session: SessionRef;
  readonly pupilId: string;
  readonly item: CaptureItem;
  readonly before: number;
}

export function Capture({ courseId, onDone }: CaptureProps) {
  const t = useText();
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  const data = useAppData();
  const { state, profile, year, calendar, calendarRelease, packs, record, today } = data;
  const context = useMemo(
    () => coreContext({ profile, year, calendar, calendarRelease, packs, state }),
    [profile, year, calendar, calendarRelease, packs, state],
  );
  const [opened] = useState(() => {
    const day = today();
    return { sessions: captureSessions(context, courseId, day), first: captureSession(context, courseId, day) };
  });
  const [chosen, setChosen] = useState(opened.first?.key ?? null);
  const session = opened.sessions.find((one) => one.key === chosen) ?? null;
  const listed = useMemo(() => (session === null ? [] : captureList(context, session)), [context, session]);
  const saved = useMemo(() => sessionCaptures(state, session?.key ?? ''), [state, session]);
  const [item, setItem] = useState<CaptureItem>('participation');
  const [typed, setTyped] = useState<ReadonlyMap<string, number>>(new Map());
  const [taps, setTaps] = useState<readonly Tap[]>([]);
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const valueOf = (pupilId: string, one: CaptureItem) =>
    typed.get(`${session?.key}/${pupilId}/${one}`) ?? saved.get(pupilId)?.[one] ?? 0;
  const put = (on: SessionRef, pupilId: string, one: CaptureItem, value: number) => {
    record(setCapture(on, pupilId, one, value));
    setTyped((before) => new Map(before).set(`${on.key}/${pupilId}/${one}`, value));
  };
  const tap = (on: SessionRef, pupilId: string) => {
    const before = valueOf(pupilId, item);
    const max = CAPTURE_MAX[item];
    put(on, pupilId, item, max === null ? before + 1 : (before + 1) % (max + 1));
    setTaps((done) => [...done, { session: on, pupilId, item, before }]);
  };
  const undo = () => {
    const last = taps.at(-1);
    if (last === undefined) return;
    put(last.session, last.pupilId, last.item, last.before);
    setChosen(last.session.key);
    setItem(last.item);
    setTaps((done) => done.slice(0, -1));
  };
  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            direction,
            paddingLeft: insets.left + spacing['space-16'],
            paddingRight: insets.right + spacing['space-16'],
          },
        ]}
      >
        <View accessible style={styles.head}>
          <Text testID="capture-class" style={[styles.title, align]}>
            {courseLabel(t, state, profile, courseId, true)}
          </Text>
          <Text testID="capture-session-line" style={[styles.note, align]}>
            {session === null ? t('marks.during.noSession') : captureLine(t, data, session)}
          </Text>
        </View>
        {opened.sessions.length > 1 && (
          <ChipGroup
            testID="capture-session"
            label={t('marks.during.sessions')}
            selected={chosen}
            onSelect={setChosen}
            choices={opened.sessions.map((one, index) => ({
              value: one.key,
              label: sessionChip(t, data, one, index + 1),
            }))}
          />
        )}
        {session !== null && (
          <>
            <ChipGroup
              testID="capture-item"
              label={t('marks.during.items')}
              selected={item}
              onSelect={setItem}
              choices={ITEMS.map((one) => ({ value: one, label: t(`marks.during.item.${one}`) }))}
            />
            <Text testID="capture-hint" style={[styles.note, align]}>
              {t(`marks.during.hint.${item}`)}
            </Text>
            <View style={styles.tiles}>
              {listed.map((pupilId, index) => {
                const name = state.pupils.get(pupilId)?.name ?? '';
                const value = valueOf(pupilId, item);
                const shown = captureValue(t, item, value);
                return (
                  <Pressable
                    key={pupilId}
                    testID={`capture-${pupilId}`}
                    accessibilityRole="button"
                    accessibilityLabel={t('marks.during.tile', {
                      n: index + 1,
                      name: isolate(name),
                      value: shown ?? t('marks.during.nothing'),
                    })}
                    accessibilityHint={t(`marks.during.hint.${item}`)}
                    onPress={() => tap(session, pupilId)}
                    style={({ pressed }) => [styles.tile, value > 0 && styles.on, pressed && styles.pressed]}
                  >
                    <Text style={[styles.number, align]}>{index + 1}</Text>
                    <Text style={[styles.name, align]} numberOfLines={2}>
                      {name}
                    </Text>
                    {shown !== null && <Text style={[styles.value, align]}>{shown}</Text>}
                  </Pressable>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>
      <View style={[styles.foot, { direction, paddingBottom: insets.bottom + spacing['space-12'] }]}>
        <Button
          testID="capture-undo"
          variant="line"
          label={t('marks.during.undo')}
          disabled={taps.length === 0}
          onPress={undo}
        />
        <View style={styles.grow}>
          <Button testID="capture-done" label={t('marks.during.done')} onPress={onDone} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { gap: spacing['space-12'], paddingTop: spacing['space-16'], paddingBottom: spacing['space-16'] },
  head: { gap: spacing['space-2'] },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing['space-8'] },
  tile: {
    flexBasis: '30%',
    flexGrow: 1,
    minWidth: sizes.target * 2,
    minHeight: sizes.target + 24,
    gap: spacing['space-2'],
    padding: spacing['space-8'],
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
  },
  on: { borderColor: colors.board, backgroundColor: colors.soft },
  pressed: { backgroundColor: colors.hover },
  number: { ...typography.small, color: colors.ink2 },
  name: { ...typography.body, color: colors.ink },
  value: { ...typography.label, color: colors.board },
  foot: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing['space-8'],
    paddingTop: spacing['space-12'],
    paddingHorizontal: spacing['space-16'],
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  grow: { flexGrow: 1, flexBasis: 160 },
  title: { ...typography.label, color: colors.ink },
  note: { ...typography.caption, color: colors.ink2 },
});
