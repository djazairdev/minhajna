// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «ورقة تحقق» (#246, R-Spot, answers 489 and 491): from a statement kept, the
// class, subject and teacher, the day of the visit, the statement it comes
// from with its sender, its period, last resource and sessions not held, then
// three school days drawn at random from the period when the sheet opens,
// which the inspector compares in the texts book and the pupils' notebooks.
// Nothing is kept: leaving and coming back draws other days. The sheet prints
// or saves as a PDF, once the teacher's label is known, and stays on this
// phone. A statement of another school year, dated before its first day, or
// left out of the picture as misdated, has no days to draw.

import { inPicture, receivedStatements, spotDays, spotPeriod, teacherNames, weekday, type Day } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { Notice } from '../components/Notice';
import { controlIcon } from '../design/Icon';
import { spacing } from '../design/tokens';
import { frontDate } from '../documents/front-tables';
import { useOutputRun } from '../documents/output-run';
import { safeFileName } from '../marks/export-file-rules';
import { settingsStyles as styles } from '../settings/styles';
import { StatementFields } from '../sharing/StatementFields';
import { statementLines, subjectName } from '../sharing/statement-lines';
import { coreContext } from '../storage/core-context';
import { useAppData } from '../storage/AppData';
import { currentLanguage, useText } from '../text/i18n';
import { isolate } from '../week/grid-labels';
import { senderLine, teacherLabel } from './reader-words';
import { spotHtml } from './spot-page';
import { useFingerprints } from './useFingerprints';

export function ReaderSpot({ id }: { readonly id: string }) {
  const t = useText();
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  const data = useAppData();
  const { entries, profile, random, today } = data;
  const list = receivedStatements(entries());
  const one = list.find((candidate) => candidate.id === id);
  const context = coreContext(data);
  const [days] = useState(() => (one === undefined || !inPicture(one) ? [] : spotDays(context, one.statement, random)));
  const fingerprints = useFingerprints(one === undefined ? [] : [one.spki]);
  const output = useOutputRun();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  if (one === undefined) {
    return (
      <View style={[styles.screen, { padding: spacing['space-16'] }]}>
        <Text testID="reader-gone" style={[styles.body, align]}>
          {t('reader.gone')}
        </Text>
      </View>
    );
  }
  const { statement } = one;
  const named = (day: Day) => `${t(`week.days.${weekday(day)}`)} ${frontDate(day)}`;
  const teacher = teacherLabel(t, teacherNames(entries()), one.spki, fingerprints.get(one.spki) ?? null);
  const subject = subjectName(profile, statement.class.subject);
  const period = spotPeriod(context, statement);
  const none = !inPicture(one)
    ? 'reader.leftOut'
    : statement.class.year !== context.ref.year.id
      ? 'reader.spot.none'
      : period === null
        ? 'reader.spot.early'
        : 'reader.spot.noDays';
  const waiting = !teacherNames(entries()).has(one.spki) && !fingerprints.has(one.spki);
  const sheet = {
    today: named(today()),
    who: [isolate(statement.class.section), subject, teacher].join(' · '),
    statement: t('reader.spot.statement', { day: frontDate(statement.day) }),
    period: period === null ? '' : t('reader.spot.period', { from: frontDate(period.from), to: frontDate(period.to) }),
    days: days.map(named),
  };
  const lines = [
    { id: 'period' as const, label: t('reader.spot.periodLabel'), lines: [sheet.period] },
    ...statementLines(t, profile, statement).filter((line) => line.id === 'resource' || line.id === 'notHeld'),
  ];
  const html = () => spotHtml(t, sheet, currentLanguage(), direction);
  const file = safeFileName(
    `${t('reader.spot.title')} ${[...statement.class.section].slice(0, 30).join('')} ${subject} ${today()}`,
    'pdf',
  );
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
      <Text testID="spot-who" accessibilityRole="header" style={[styles.title, align]}>
        {sheet.who}
      </Text>
      <Text style={[styles.sub, align]}>{sheet.today}</Text>
      <View style={[styles.card, { gap: spacing['space-8'] }]}>
        <Text style={[styles.body, align]}>{sheet.statement}</Text>
        <Text style={[styles.sub, align]}>{senderLine(t, list, one)}</Text>
      </View>
      {period !== null && <StatementFields lines={lines} />}
      {days.length === 0 ? (
        <Text testID="spot-none" style={[styles.body, align]}>
          {t(none, { year: context.ref.year.id })}
        </Text>
      ) : (
        <>
          <Text accessibilityRole="header" style={[styles.title, align]}>
            {t('reader.spot.drawn', { count: days.length })}
          </Text>
          <Text style={[styles.sub, align]}>{t('reader.spot.why')}</Text>
          {sheet.days.map((day, at) => (
            <Text key={day} testID={`spot-day-${at}`} style={[styles.body, align]}>
              {day}
            </Text>
          ))}
          <View style={{ gap: spacing['space-8'] }}>
            <Button
              testID="spot-print"
              label={t('documents.output.print')}
              disabled={output.busy || waiting}
              onPress={() => output.print(html, t('reader.spot.title'), false)}
            />
            <Button
              testID="spot-pdf"
              variant="line"
              label={t('documents.output.save')}
              disabled={output.busy || waiting}
              onPress={() => output.save(html, 'spot', file, false)}
            />
          </View>
          {output.said !== null && (
            <Notice
              testID="spot-said"
              icon={controlIcon(output.said === 'saved' ? 'check' : 'info')}
              message={t(output.said === 'saved' ? 'documents.output.saved' : 'documents.output.failed')}
            />
          )}
        </>
      )}
      <Text style={[styles.sub, align]}>{t('reader.spot.onPhone')}</Text>
    </ScrollView>
  );
}
