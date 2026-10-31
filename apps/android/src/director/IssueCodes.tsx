// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// D-Issue, the director's joining codes and security keys in a national demo
// world (#570, §7.5, answers 596 to 598), as the design draws it, under the
// workspace's title: the world's date and how many teachers the school has; on
// the PC, printing every code still waiting to be scanned on one sheet; reading
// the joins again; chips for every teacher, by phone, by security key and the
// codes waiting; the teachers (IssueList.tsx); the chosen teacher's panel
// (IssuePanel.tsx), beside the list on the PC and under it on the phone; and,
// under them, how many are shown and in what order, that no password or reset
// passes through the director, and that nothing records when or where anyone
// signed in. Until the school key is held, the page says it is opening; codes
// issued again under a new epoch are counted, to print or show them again; a
// problem, a failed print as well, is said in the world's words and keeps what
// is shown.

import type { CountryProfile, Day, DemoSchool, IssueRow } from '@minhajna/core';
import { issueCounts } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { ChipGroup } from '../components/Chip';
import type { OpenWorld } from '../demo/world-mode';
import type { Send, WorldKit } from '../demo/world-session';
import { colors, spacing, typography } from '../design/tokens';
import { subjectName } from '../extra/extra-rules';
import qr from '../native/NativeMinhajnaCalendarInput';
import pdf from '../native/NativeMinhajnaPdf';
import { currentLanguage } from '../text/i18n';
import { onPc, useDeviceText } from '../text/device-text';
import { personName } from './dashboard-text';
import { IssueList } from './IssueList';
import { IssuePanel } from './IssuePanel';
import { codeText } from './issue-session';
import { issueSheetHtml, type SheetCode } from './issue-sheet';
import { useIssuePage } from './use-issue-page';

type Filter = 'all' | 'phone' | 'key' | 'waiting';

export type IssueCodesProps = {
  readonly world: Pick<OpenWorld, 'world' | 'book' | 'date'>;
  readonly school: DemoSchool;
  readonly profile: CountryProfile;
  readonly kit: WorldKit;
  readonly send?: Send;
  /** A day of the world, written out as the band writes it. */
  readonly dayText: (day: Day) => string;
};

const waitingCode = (row: IssueRow) =>
  row.status.kind === 'waiting' && row.status.until !== null && row.issue?.access === 'phone';

/** The director's codes and keys page. */
export function IssueCodes({ world, school, profile, kit, send, dayText }: IssueCodesProps) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const subject = (code: string) => subjectName(profile, code);
  const language = currentLanguage();
  const naming = useMemo(
    () => ({
      subject: (code: string) => subjectName(profile, code),
      person: personName,
      compare: new Intl.Collator(language).compare,
    }),
    [profile, language],
  );
  const page = useIssuePage(world, school.teachers, naming, kit, send);
  const [filter, setFilter] = useState<Filter>('all');
  const [chosen, setChosen] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  const counts = issueCounts(page.rows);
  const shown = page.rows.filter(
    (row) => filter === 'all' || (filter === 'waiting' ? waitingCode(row) : row.access === filter),
  );
  const row = page.rows.find((one) => one.teacher.id === chosen) ?? null;
  const waiting = page.rows.filter(waitingCode);

  const print = async (codes: readonly IssueRow[]) => {
    const desk = page.desk;
    if (desk === null || codes.length === 0) return;
    setPrinting(true);
    try {
      const sheet: SheetCode[] = [];
      for (const one of codes) {
        if (one.issue === null || one.status.kind !== 'waiting' || one.status.until === null) continue;
        const text = await codeText(world.world, desk, one.issue);
        sheet.push({
          teacher: personName(one.teacher),
          subject: subject(one.teacher.subject),
          until: dayText(one.status.until),
          rows: qr.qrRows(text),
        });
      }
      const html = issueSheetHtml(
        t,
        { school: personName(school), day: dayText(world.date), codes: sheet },
        currentLanguage(),
        direction,
      );
      await pdf.printHtml(html, t('demo.issue.sheet.title'), false);
    } catch (error) {
      page.fail(error);
    } finally {
      setPrinting(false);
    }
  };

  const panel = row !== null && page.desk !== null && (
    <View style={onPc() ? styles.side : undefined}>
      <IssuePanel
        world={world.world}
        desk={page.desk}
        row={row}
        subject={subject(row.teacher.subject)}
        busy={page.busy || page.issuing || printing}
        dayText={dayText}
        onIssue={(access) => void page.issue(row.teacher, access)}
        onPrint={() => void print([row])}
        onProblem={page.fail}
      />
    </View>
  );
  return (
    <View testID="issue-codes" style={styles.page}>
      <Text style={[styles.small, align]}>
        {t('demo.issue.lead', { date: dayText(world.date), number: school.teachers.length })}
      </Text>
      <View style={styles.actions}>
        {onPc() && (
          <Button
            testID="issue-print-waiting"
            label={t('demo.issue.print')}
            disabled={waiting.length === 0 || printing}
            onPress={() => void print(waiting)}
          />
        )}
        <Button
          testID="issue-refresh"
          variant="line"
          label={t('demo.issue.refresh')}
          disabled={page.desk === null || page.busy}
          onPress={page.refresh}
        />
      </View>
      <ChipGroup
        testID="issue-filter"
        label={t('demo.issue.filter')}
        choices={[
          { value: 'all', label: t('demo.issue.chip.all', { number: counts.all }) },
          { value: 'phone', label: t('demo.issue.chip.phone', { number: counts.phone }) },
          { value: 'key', label: t('demo.issue.chip.key', { number: counts.key }) },
          { value: 'waiting', label: t('demo.issue.chip.waiting') },
        ]}
        selected={filter}
        onSelect={setFilter}
      />
      <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={[styles.problem, align]}>
        {page.problem === null ? '' : t(page.problem as 'demo.problem.other')}
      </Text>
      {page.reissued > 0 && (
        <Text testID="issue-reissued" accessibilityLiveRegion="polite" style={[styles.problem, align]}>
          {t('demo.issue.reissued', { number: page.reissued })}
        </Text>
      )}
      {page.desk === null ? (
        <Text style={[styles.small, align]}>{page.busy ? t('demo.issue.opening') : ''}</Text>
      ) : (
        <View style={onPc() ? styles.columns : styles.page}>
          <View style={onPc() ? styles.main : undefined}>
            {shown.length === 0 ? (
              <Text style={[styles.small, align]}>{t('demo.issue.none')}</Text>
            ) : (
              <IssueList rows={shown} chosen={chosen} subject={subject} dayText={dayText} onChoose={setChosen} />
            )}
          </View>
          {panel}
        </View>
      )}
      <Text style={[styles.small, align]}>{t('demo.issue.order', { shown: shown.length, all: page.rows.length })}</Text>
      <Text style={[styles.small, align]}>{t('demo.issue.noPassword')}</Text>
      <Text style={[styles.small, align]}>{t('demo.issue.noSignIn')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: spacing['space-12'] },
  columns: { flexDirection: 'row', gap: spacing['space-16'], alignItems: 'flex-start' },
  main: { flex: 2, minWidth: 0 },
  side: { flex: 1, minWidth: 0 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing['space-8'] },
  small: { ...typography.small, color: colors.ink2 },
  problem: { ...typography.body, color: colors['error-ink'] },
});
