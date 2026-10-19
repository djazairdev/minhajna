// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «تصحيحات دفتر النصوص» (Book-fixes, #218, answer 266): a month of the
// school year up to today and «الكل» or one class, the promise that nothing
// is deleted, then each correction as a card: the class, the day and time,
// what changed with «كان» struck through and «أصبح», the day and reason,
// and the note when the page was printed before the change. A month without
// corrections says so and still prints. «طباعة» or «حفظ PDF» make the
// director's pages. It opens from the Documents tab, on this month and
// every class, or from the texts book, on its month and class.

import { useLocale } from '@react-navigation/native';
import { compareDays, parseDay, type Day } from '@minhajna/core';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { ChipGroup } from '../components/Chip';
import { Notice } from '../components/Notice';
import { controlIcon } from '../design/Icon';
import { colors, radius, spacing, typography } from '../design/tokens';
import { bookFixes, type FixItem } from '../documents/book-fixes';
import { bookFixesHtml } from '../documents/book-fixes-html';
import { monthLabel } from '../documents/document-data';
import { useOutputRun } from '../documents/output-run';
import { useDocumentData } from '../documents/useDocumentData';
import { useText } from '../text/i18n';

export type BookFixesProps = {
  /** A month written YYYY-MM; today's when not given. */
  readonly month?: string;
  /** A class to open on; every class when not given. */
  readonly classId?: string;
};

const ALL = 'all';

export function BookFixes(props: BookFixesProps) {
  const t = useText();
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  const data = useDocumentData();
  const months = useMemo(() => {
    const last = compareDays(data.day, data.year.to) < 0 ? data.day : data.year.to;
    const found: string[] = [];
    for (let day = parseDay(`${data.year.from.slice(0, 7)}-01`); compareDays(day, last) <= 0;) {
      found.push(day.slice(0, 7));
      const [year, month] = [Number(day.slice(0, 4)), Number(day.slice(5, 7))];
      day = parseDay(month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`);
    }
    return found;
  }, [data.day, data.year]);
  const classes = useMemo(() => {
    const taught = new Set([...data.state.courses.values()].map((course) => course.classId));
    return [...data.state.classes.values()].filter((one) => taught.has(one.id));
  }, [data.state]);
  const [month, setMonth] = useState(
    props.month !== undefined && months.includes(props.month) ? props.month : (months.at(-1) ?? data.day.slice(0, 7)),
  );
  const [chosen, setChosen] = useState(
    props.classId !== undefined && classes.some((one) => one.id === props.classId) ? props.classId : ALL,
  );
  const { busy, said, print, save, clear } = useOutputRun();
  const classId = chosen === ALL ? null : chosen;
  const items = useMemo(() => bookFixes(data, t, month, classId), [data, t, month, classId]);
  const named = monthLabel(data, `${month}-01` as Day);
  const title =
    classId === null
      ? t('bookFixes.allTitle')
      : t('bookFixes.classTitle', { name: classes.find((one) => one.id === classId)?.name ?? '' });
  const html = () => bookFixesHtml(data, t, items, { month: named, title });
  const file = `${t('bookFixes.title')} ${month}${classId === null ? '' : ` ${title}`}.pdf`.replace(
    /[\\/:*?"<>|]/g,
    '-',
  );
  const change =
    <T,>(set: (value: T) => void) =>
    (value: T) => {
      set(value);
      clear();
    };
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        {
          direction,
          paddingBottom: insets.bottom + spacing['space-24'],
          paddingLeft: insets.left + spacing['space-16'],
          paddingRight: insets.right + spacing['space-16'],
        },
      ]}
    >
      <Text style={styles.scope}>{t('bookFixes.scope', { month: named })}</Text>
      <ChipGroup
        testID="fixes-month"
        label={t('bookFixes.months')}
        selected={month}
        onSelect={change(setMonth)}
        choices={months.map((one) => ({ value: one, label: monthLabel(data, `${one}-01` as Day) }))}
      />
      {classes.length > 1 && (
        <ChipGroup
          testID="fixes-class"
          label={t('bookFixes.classes')}
          selected={chosen}
          onSelect={change(setChosen)}
          choices={[
            { value: ALL, label: t('bookFixes.all') },
            ...classes.map((one) => ({ value: one.id, label: one.name })),
          ]}
        />
      )}
      <View style={styles.card}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.note}>{t('bookFixes.promise')}</Text>
      </View>
      {items.length === 0 ? (
        <Notice testID="fixes-none" icon={controlIcon('info')} message={t('bookFixes.none')} />
      ) : (
        items.map((item) => <FixCard key={item.key} item={item} />)
      )}
      {said !== null && (
        <Notice
          testID="fixes-said"
          icon={controlIcon(said === 'saved' ? 'check' : 'info')}
          message={t(said === 'saved' ? 'documents.output.saved' : 'documents.output.failed')}
        />
      )}
      <View style={styles.actions}>
        <Button
          testID="fixes-print"
          label={t('documents.output.print')}
          disabled={busy}
          onPress={() => print(html, t('bookFixes.title'), false)}
        />
        <Button
          testID="fixes-save"
          variant="line"
          label={t('documents.output.save')}
          disabled={busy}
          onPress={() => save(html, `book-fixes-${month}`, file, false)}
        />
        <Text style={styles.note}>{t('bookFixes.foot')}</Text>
      </View>
    </ScrollView>
  );
}

function FixCard({ item }: { item: FixItem }) {
  const t = useText();
  return (
    <View testID={`fixes-item-${item.key}`} style={styles.card}>
      <Text style={styles.head}>
        <Text style={styles.className}>{item.className}</Text>
        {`  ${item.when}`}
      </Text>
      {item.changes.map((change, index) => (
        <View key={index} style={styles.change}>
          <Text style={styles.label}>{change.label}</Text>
          <View style={styles.pair}>
            <Text style={styles.side}>{t('bookFixes.before')}</Text>
            <Text style={[styles.text, styles.was]}>{change.before}</Text>
          </View>
          <View style={styles.pair}>
            <Text style={styles.side}>{t('bookFixes.after')}</Text>
            <Text style={[styles.text, styles.now]}>{change.after}</Text>
          </View>
        </View>
      ))}
      <Text style={styles.note}>{item.foot}</Text>
      {item.paper && <Text style={styles.note}>{t('bookFixes.paper')}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { gap: spacing['space-16'], paddingTop: spacing['space-16'] },
  scope: { ...typography.body, color: colors.pencil },
  card: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
    padding: spacing['space-16'],
    gap: spacing['space-8'],
  },
  title: { ...typography.h3, color: colors.ink },
  head: { ...typography.body, color: colors.ink2 },
  className: { ...typography.h3, color: colors.ink },
  change: { gap: spacing['space-4'] },
  label: { ...typography.body, color: colors.ink },
  pair: { flexDirection: 'row', gap: spacing['space-16'] },
  side: { ...typography.caption, color: colors.pencil, minWidth: 48 },
  text: { ...typography.body, flex: 1 },
  was: { color: colors.pencil, textDecorationLine: 'line-through' },
  now: { color: colors.ink, fontWeight: '700' },
  note: { ...typography.caption, color: colors.ink2 },
  actions: { gap: spacing['space-10'], paddingTop: spacing['space-8'] },
});
