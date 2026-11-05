// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A joined teacher's page of the plans their world has published: which of
// their classes may move to a new release (WorldPackMoves.tsx, #617, answer
// 771), the classes read from the timetable in force that the school sent; and
// for each plan, or the plan a class starts on, a report of a plan error
// (WorldReportForm.tsx, #616, answer 770). A world whose date moved on is read
// as it stands.

import { packReleaseKey, partOn, readJoinCode, type Day, type DemoSchool, type SchoolJoined } from '@minhajna/core';
import { useEffect, useMemo, useState } from 'react';
import { useLocale } from '@react-navigation/native';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { DemoBand } from '../demo/DemoBand';
import type { OpenWorld } from '../demo/world-mode';
import type { Send, WorldKit } from '../demo/world-session';
import type { TermReference } from '../director/seeded-fill';
import { colors, spacing, typography } from '../design/tokens';
import { editorStyles as s } from '../editor/editor-styles';
import { readPackEditor, type PackEditor } from '../editor/pack-release-session';
import { onPc, useDeviceText } from '../text/device-text';
import { firstToCome, sessionsOf } from '../timetable/teacher-session';
import { isolate } from '../week/grid-labels';
import { readSignChannel } from '../week/week-sign-session';
import { WorldPackMoves } from './WorldPackMoves';
import { WorldReportForm } from './WorldReportForm';
import { coursesFrom, type WorldCourse } from './world-pack-rules';

export function WorldPacks(props: {
  readonly world: Pick<OpenWorld, 'world' | 'date' | 'book'>;
  readonly join: SchoolJoined;
  readonly school?: DemoSchool | null;
  readonly held: PackEditor['held'];
  readonly reference: TermReference;
  readonly date: string;
  readonly dayText: (day: Day) => string;
  /** What the page says aloud on a PC, in its hidden live region. */
  readonly said: string;
  readonly kit: WorldKit;
  readonly send?: Send;
  readonly onClose: () => void;
}) {
  const t = useDeviceText();
  const { held, reference, date, dayText, said, kit, send, onClose, join, school } = props;
  const { direction } = useLocale();
  const insets = useSafeAreaInsets();
  const { profile } = reference;
  const { world: id, date: day } = props.world;
  const world = useMemo(() => ({ world: id, date: day, kind: 'national' as const }), [id, day]);
  const [read, setRead] = useState<Awaited<ReturnType<typeof readPackEditor>> | null>(null);
  const [courses, setCourses] = useState<readonly WorldCourse[] | null>(null);
  const [noChannel, setNoChannel] = useState(false);
  const [problem, setProblem] = useState(false);
  const [opened, setOpened] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    readPackEditor({ world, held, profile, kit }, send)
      .then((found) => {
        if (live) setRead(found);
      })
      .catch(() => {
        if (live) setProblem(true);
      });
    return () => {
      live = false;
    };
  }, [world, held, profile, kit, send]);
  useEffect(() => {
    let live = true;
    readSignChannel(world, join, kit, send)
      .then(({ parts }) => {
        const part = partOn(parts, world.date)?.part ?? firstToCome({ parts });
        const sessions = part === null ? [] : sessionsOf(part);
        const scope = readJoinCode(join.code)?.school ?? '';
        if (live) setCourses(coursesFrom(scope, sessions, school, profile.subjects));
      })
      .catch((error: unknown) => {
        if (!live) return;
        if ((error as { code?: unknown } | null)?.code === 'E_TIMETABLE_UNJOINED') setCourses([]);
        else setNoChannel(true);
      });
    return () => {
      live = false;
    };
  }, [world, join, school, profile, kit, send]);
  const records = read?.records ?? null;
  const packs = useMemo(() => {
    if (records === null) return null;
    const published = [...records.values()].filter((one) => one.stage === 'published').map((one) => one.pack);
    const started = (courses ?? []).flatMap((course) => (course.start === null ? [] : [course.start]));
    const held = reference.packs.filter((pack) =>
      started.some((pin) => pin.id === pack.id && pin.release === pack.release),
    );
    const seen = new Set(published.map((pack) => packReleaseKey(pack.id, pack.release)));
    return [...published, ...held.filter((pack) => !seen.has(packReleaseKey(pack.id, pack.release)))];
  }, [records, courses, reference.packs]);
  const pack = packs?.find((one) => packReleaseKey(one.id, one.release) === opened);
  return (
    <View testID="world-packs" style={[styles.screen, { direction }]}>
      <DemoBand date={date} />
      {onPc() && (
        <Text testID="world-packs-said" accessibilityLiveRegion="polite" style={styles.hidden}>
          {said}
        </Text>
      )}
      <View
        style={[
          styles.bar,
          { paddingLeft: insets.left + spacing['space-16'], paddingRight: insets.right + spacing['space-16'] },
        ]}
      >
        <Button testID="world-packs-back" variant="plain" label={t('demo.entry.back')} onPress={onClose} />
        <Text accessibilityRole="header" style={[styles.title, { flexShrink: 1 }]}>
          {t('editorDesk.teacher.title')}
        </Text>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing['space-16'] }]}>
        <View style={styles.column}>
          {problem && (
            <Text accessibilityRole="alert" style={s.error}>
              {t('editorDesk.teacher.readProblem')}
            </Text>
          )}
          {packs === null && !problem && (
            <Text accessibilityLiveRegion="polite" style={s.body}>
              {t('editorDesk.loading')}
            </Text>
          )}
          {noChannel && (
            <Text testID="world-no-channel" accessibilityRole="alert" style={s.error}>
              {t('editorDesk.teacher.noChannel')}
            </Text>
          )}
          {packs !== null && packs.length === 0 && (
            <Text testID="world-packs-empty" style={s.body}>
              {t('editorDesk.teacher.none')}
            </Text>
          )}
          {read !== null && courses !== null && (
            <WorldPackMoves
              open={props.world}
              today={read.date}
              dayText={dayText}
              damaged={read.damaged}
              courses={courses}
              records={read.records}
              bundled={reference.packs}
            />
          )}
          {(packs ?? []).map((one) => {
            const key = packReleaseKey(one.id, one.release);
            return (
              <View key={key} testID={`world-pack-${one.release}`} style={s.card}>
                <Text style={s.body}>
                  {isolate(one.id)} · {isolate(one.release)}
                </Text>
                <Button
                  testID={`report-open-${one.release}`}
                  label={t('planError.title')}
                  variant="plain"
                  onPress={() => setOpened(key)}
                />
              </View>
            );
          })}
          {pack !== undefined && (
            <WorldReportForm key={opened} pack={pack} editor={{ world, held, profile, kit }} send={send} />
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  bar: { flexDirection: 'row', alignItems: 'center', gap: spacing['space-8'], paddingVertical: spacing['space-8'] },
  title: { ...typography['bar-title'], color: colors.ink },
  content: {
    flexGrow: 1,
    paddingTop: spacing['space-12'],
    paddingHorizontal: spacing['space-16'],
    alignItems: 'center',
  },
  column: { width: '100%', maxWidth: 640, gap: spacing['space-12'] },
  hidden: { position: 'absolute', width: 1, height: 1, overflow: 'hidden' },
});
