// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A teacher's statement inside a demo world (#630, answer 725), from their
// joined card: a chip for each course of the timetable, what the page does with
// what the teacher says, and the plan's items to say where the class has
// reached, done or started; with nothing said, none is reached. Signing, in one
// step, says it did and shows the statement's fields as the coordinator reads
// them, its QR code when it fits one, with a way to save or share the file
// otherwise and beside it, all under the line that it holds in this world
// alone. With no timetable, no class or pack, or no school's data, the page
// says so and nothing is signed. Reading, signing and filing are said apart; a
// problem is shown in the catalogue's words, reading's with a way to read
// again, and said except on a PC. The band, bar and column are WeekPage.tsx's.

import type { Day, DemoSchool, PackItem, SchoolJoined, Subject } from '@minhajna/core';
import { queueItems } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Button } from '../components/Button';
import { ChipGroup } from '../components/Chip';
import type { OpenWorld } from '../demo/world-mode';
import type { Send, WorldKit } from '../demo/world-session';
import { colors, radius, spacing, typography } from '../design/tokens';
import type { TermReference } from '../director/seeded-fill';
import { QrCode } from '../settings/QrCode';
import { statementLines } from '../sharing/statement-lines';
import { StatementFields } from '../sharing/StatementFields';
import { useDeviceText } from '../text/device-text';
import { isolate } from '../week/grid-labels';
import type { MineCalendar } from '../week/school-mine-session';
import { courseKey, courseLabel } from '../week/week-sign-session';
import { PAGE_COLUMN, WeekPage } from '../week/WeekPage';
import { useWorldStatement } from './useWorldStatement';

export type WorldStatementProps = {
  readonly world: Pick<OpenWorld, 'world' | 'date'>;
  readonly join: SchoolJoined;
  readonly kit: WorldKit;
  readonly send?: Send;
  /** The world's date, written out. */
  readonly dayText: (day: Day) => string;
  readonly onClose: () => void;
  /** The page's title, said as it opens. */
  readonly said: string;
  readonly subjects?: readonly Subject[];
  readonly mine?: MineCalendar;
  /** The world's school, rebuilt from the world's ID. */
  readonly school?: DemoSchool | null;
  /** The world's reference, which holds the packs and names the subjects. */
  readonly reference?: TermReference;
};

const NOTHING = 'nothing';
/** The code's modules without the four-module quiet zone that QrCode draws itself. */
const QUIET = 4;
/** What the band, the bar and the page's padding and insets take of its height, so the whole code shows at once. */
const BARS = 200;

/** Where the class has reached in its plan, said by the teacher. */
function ReachedFields({
  items,
  view,
}: {
  readonly items: readonly PackItem[];
  readonly view: ReturnType<typeof useWorldStatement>;
}) {
  const t = useDeviceText();
  const { reached } = view;
  const status = reached?.status ?? 'done';
  return (
    <>
      <ChipGroup
        testID="world-statement-item"
        label={t('demo.statement.reached')}
        choices={[
          { value: NOTHING, label: t('demo.statement.nothing') },
          ...items.map((one) => ({ value: one.id, label: one.title })),
        ]}
        selected={reached?.item ?? NOTHING}
        onSelect={(item) => view.reach(item === NOTHING ? null : { item, status })}
      />
      {reached !== null && (
        <ChipGroup
          testID="world-statement-status"
          label={t('demo.statement.status')}
          choices={[
            { value: 'done' as const, label: t('statement.done') },
            { value: 'started' as const, label: t('statement.started') },
          ]}
          selected={status}
          onSelect={(one) => view.reach({ item: reached.item, status: one })}
        />
      )}
    </>
  );
}

/** A statement of a class's progress for a coordinator, signed for this world. */
export function WorldStatement(props: WorldStatementProps) {
  const { world, dayText, onClose, reference } = props;
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const view = useWorldStatement(props);
  const { courses, course, step, problem, made, reason } = view;
  const subtitle = [
    ...(course === undefined ? [] : [isolate(course.class), isolate(course.subject)]),
    dayText(world.date),
  ].join(' · ');
  const { width, height } = useWindowDimensions();
  const rows = made?.qr?.rows.slice(QUIET, -QUIET).map((row) => row.slice(QUIET, -QUIET)) ?? null;
  const room = Math.min(width - 2 * spacing['space-16'], PAGE_COLUMN, height - BARS);
  const module = rows === null ? 0 : Math.max(2, Math.floor(room / (rows.length + 2 * QUIET)));
  const items = course?.pack === null || course === undefined ? [] : queueItems(course.pack, 'main');
  return (
    <WeekPage
      testID="world-statement"
      date={world.date}
      region={view.region}
      title={t('demo.statement.title')}
      subtitle={subtitle}
      onBack={onClose}
    >
      <Text style={[styles.small, align]}>{t('demo.statement.line')}</Text>
      <Text accessibilityLiveRegion="polite" style={[styles.small, align]}>
        {step === null ? '' : t(`demo.statement.steps.${step}`)}
      </Text>
      {problem !== null && (
        <View style={styles.card}>
          <Text accessibilityRole="alert" style={[styles.problem, align]}>
            {t(problem.words)}
          </Text>
          {problem.reading && (
            <Button
              testID="world-statement-again"
              variant="line"
              label={t('demo.statement.again')}
              onPress={view.reload}
            />
          )}
        </View>
      )}
      {courses.length > 0 && (
        <ChipGroup
          testID="world-statement-course"
          label={t('demo.statement.courses')}
          choices={courses.map((one) => ({ value: courseKey(one), label: courseLabel(courses, one) }))}
          selected={course === undefined ? null : courseKey(course)}
          onSelect={view.choose}
        />
      )}
      {reason !== null && <Text style={[styles.body, align]}>{t(reason)}</Text>}
      {reason === null && course !== undefined && <ReachedFields items={items} view={view} />}
      {reason === null && course !== undefined && (
        <Button
          testID="world-statement-sign"
          disabled={step !== null}
          label={t('demo.statement.sign')}
          onPress={view.sign}
        />
      )}
      {made !== null && reference !== undefined && (
        <View testID="world-statement-made" style={styles.made}>
          <Text style={[styles.head, align]}>{t('demo.statement.signed')}</Text>
          <Text style={[styles.small, align]}>{t('demo.statement.worldOnly')}</Text>
          <StatementFields lines={statementLines(t, reference.profile, made.statement)} />
          {rows !== null ? (
            <QrCode testID="world-statement-qr" rows={rows.join('\n')} label={t('demo.statement.qr')} module={module} />
          ) : (
            <Text style={[styles.small, align]}>{t('demo.statement.tooBig')}</Text>
          )}
          <Button
            testID="world-statement-file"
            variant="line"
            disabled={step !== null}
            label={t('demo.statement.file')}
            onPress={view.file}
          />
        </View>
      )}
    </WeekPage>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
    padding: spacing['space-16'],
    gap: spacing['space-8'],
  },
  made: { gap: spacing['space-12'] },
  head: { ...typography.label, color: colors.ink },
  body: { ...typography.body, color: colors.ink },
  small: { ...typography.small, color: colors.ink2 },
  problem: { ...typography.body, color: colors['error-ink'] },
});
