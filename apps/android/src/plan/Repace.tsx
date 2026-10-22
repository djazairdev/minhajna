// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «مسودة توزيع بقية الفصل» (#229, Repace, R-4.7-29 to R-4.7-34, answers
// 363 to 370): the counts, the merges and leave-outs proposed with the
// draft as ticks the teacher can take off while re-pacing is offered, what
// changes against the current distribution, and the weeks. A tick follows
// its choice, not its place in the list. «اعتماد التوزيع» records it with
// its ticked decisions, and «تراجع» takes all of it back at once. The
// draft can be printed (answer 371), signed with the drawn signature
// unless «فارغة» is chosen while it is in use (#236, answer 414). In
// primary the director approves it first, so it waits for the printed
// draft, shown with the choices printed on it, and its approval date
// (RepaceApproval). Nothing applies before the teacher confirms.

import {
  choiceKey,
  confirmRepace,
  printedTicks,
  removeRepace,
  repaceDocument,
  repaceDraft,
  repaceOffered,
  repacePrinted,
  repacesOf,
  type Context,
  type Day,
  type RecordEvent,
  type RepaceDraft,
} from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { CheckRow } from '../components/CheckRow';
import { Notice } from '../components/Notice';
import { Snackbar } from '../components/Snackbar';
import { controlIcon } from '../design/Icon';
import { colors, radius, spacing, typography } from '../design/tokens';
import { courseLabel, termName } from '../exams/course-label';
import { useOutputRun } from '../documents/output-run';
import { repaceHeader, repaceHtml } from '../documents/repace-html';
import { useSheetSignature } from '../documents/sheet-signature';
import { coreContext } from '../storage/core-context';
import { useAppData } from '../storage/AppData';
import { currentLanguage, useText } from '../text/i18n';
import { dayName } from '../today/DayMark';
import { isolate } from '../week/grid-labels';
import { RepaceApproval } from './RepaceApproval';
import { changeLines, choiceWords, countLines, rangeWords } from './repace-rules';
import { RepaceWeeks } from './RepaceWeeks';

type Said = { readonly undo: (now: Context) => readonly RecordEvent[]; readonly message: string } | null;

export function Repace({ courseId, onSignature }: { readonly courseId: string; readonly onSignature?: () => void }) {
  const t = useText();
  const data = useAppData();
  const { state, profile, record, recordAll, newId, today } = data;
  const { direction } = useLocale();
  const insets = useSafeAreaInsets();
  const language = currentLanguage();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const day = today();
  const context = useMemo(() => coreContext(data), [data]);
  const [ticks, setTicks] = useState<readonly string[] | null>(null);
  const [editing, setEditing] = useState(false);
  const printed = useMemo(() => repacePrinted(state, courseId), [state, courseId]);
  const suggested = useMemo(() => repaceDraft(context, courseId, day), [context, courseId, day]);
  const onPaper = useMemo(
    () => (suggested?.primary === true && printed !== null ? printedTicks(suggested, printed) : null),
    [suggested, printed],
  );
  const waiting = onPaper !== null && !editing;
  const status = printed === null ? 'draft' : waiting ? 'printed' : onPaper === null ? 'changed' : 'editing';
  const draft = useMemo(() => {
    if (suggested === null) return null;
    if (waiting) return repaceDraft(context, courseId, day, onPaper);
    if (ticks === null) return suggested;
    const picked = suggested.choices.flatMap((choice, index) => (ticks.includes(choiceKey(choice)) ? [index] : []));
    return repaceDraft(context, courseId, day, picked);
  }, [context, courseId, day, suggested, waiting, onPaper, ticks]);
  const offered = useMemo(() => repaceOffered(context, courseId, day), [context, courseId, day]);
  const newest = repacesOf(state, courseId).at(-1);
  const [said, setSaid] = useState<Said>(null);
  const [failed, setFailed] = useState(false);
  const output = useOutputRun();
  const signing = useSheetSignature('repace-signature', output, onSignature);
  const appliedFrom = useRef<typeof state | null>(null);
  const className = courseLabel(t, state, profile, courseId);
  const once = (events: readonly RecordEvent[], next: Said) => {
    if (appliedFrom.current === state) return;
    appliedFrom.current = state;
    recordAll([...events]);
    setSaid(next);
    setFailed(false);
  };
  const confirm = (approved?: Day) => {
    if (draft === null) return;
    const ids = { repace: newId(), decisions: draft.ticked.map(() => newId()) };
    let events: RecordEvent[];
    try {
      events = confirmRepace(
        context,
        { courseId, ticked: draft.ticked, ids, ...(approved !== undefined && { approved }) },
        day,
      );
    } catch {
      setFailed(true);
      return;
    }
    const message =
      approved === undefined
        ? t('repace.confirmed')
        : t('repace.approvedDone', { day: dayName(t, approved, language, profile) });
    once(events, { undo: (now) => removeRepace(now, ids.repace, true), message });
    setTicks(null);
  };
  const print = (shown: RepaceDraft) => {
    const choices = shown.ticked.flatMap((index) => shown.choices[index] ?? []).map(choiceKey);
    const header = repaceHeader(t, context, profile, courseId, day);
    const kept = () => {
      const documents = [{ id: repaceDocument(courseId), from: shown.from, to: shown.to, choices }];
      record({ kind: 'print.recorded', print: { id: newId(), documents } });
      setEditing(false);
      setTicks(null);
    };
    output.print(
      () => repaceHtml(t, shown, header, language, profile, direction, signing.mark),
      t('repace.sheet.title', { term: termName(t, shown.term) }),
      false,
      shown.primary ? kept : undefined,
    );
  };
  const undo = () => {
    if (said === null || appliedFrom.current === state) return;
    let events: readonly RecordEvent[];
    try {
      events = said.undo(context);
    } catch {
      setSaid(null);
      return;
    }
    once(events, null);
    setTicks(null);
  };
  const toggle = (key: string, on: boolean) => {
    const current = (draft?.ticked ?? []).flatMap((index) => {
      const choice = draft?.choices[index];
      return choice === undefined ? [] : [choiceKey(choice)];
    });
    setTicks(on ? [...current, key] : current.filter((one) => one !== key));
  };

  if (draft === null) {
    return (
      <View style={styles.screen}>
        <Text style={[styles.body, align, { padding: spacing['space-16'] }]}>{t('repace.none')}</Text>
      </View>
    );
  }
  const bullet = (line: string, index: number) => (
    <View key={index} style={styles.bullet}>
      <View style={styles.dot} />
      <Text style={[styles.body, styles.grow, align]}>{line}</Text>
    </View>
  );
  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[
          styles.content,
          {
            direction,
            paddingLeft: insets.left + spacing['space-16'],
            paddingRight: insets.right + spacing['space-16'],
            paddingBottom: insets.bottom + (said === null ? spacing['space-24'] : 96),
          },
        ]}
      >
        <Text accessibilityRole="header" style={[styles.title, align]}>
          {t('repace.heading', { class: isolate(className) })}
        </Text>
        <Text style={[styles.sub, align]}>{rangeWords(t, draft, language, profile)}</Text>
        <View testID="repace-counts" style={styles.card}>
          {countLines(t, draft).map((line, index) => (
            <Text key={index} style={[styles.body, align]}>
              {line}
            </Text>
          ))}
        </View>
        {offered && !waiting && draft.choices.length > 0 && (
          <View style={styles.group}>
            <Text accessibilityRole="header" style={[styles.label, align]}>
              {t('repace.choices')}
            </Text>
            <Text style={[styles.sub, align]}>{t('repace.choicesLine')}</Text>
            {draft.choices.map((choice, index) => (
              <CheckRow
                key={index}
                testID={`repace-choice-${index}`}
                label={choiceWords(t, choice)}
                checked={draft.ticked.includes(index)}
                onCheckedChange={(on) => toggle(choiceKey(choice), on)}
              />
            ))}
          </View>
        )}
        <View testID="repace-changes" style={styles.group}>
          <Text accessibilityRole="header" style={[styles.label, align]}>
            {t('repace.changed')}
          </Text>
          {changeLines(t, draft).map(bullet)}
        </View>
        <RepaceWeeks draft={draft} language={language} profile={profile} />
        {newest !== undefined && (
          <Notice
            testID="repace-applied"
            icon={controlIcon('info')}
            message={
              newest.approved === undefined
                ? t('repace.applied', { day: dayName(t, newest.on, language, profile) })
                : t('repace.appliedApproved', {
                    day: dayName(t, newest.on, language, profile),
                    approved: dayName(t, newest.approved, language, profile),
                  })
            }
          />
        )}
        {failed && <Notice testID="repace-failed" icon={controlIcon('info')} message={t('repace.failed')} />}
        {output.said === 'failed' && (
          <Notice testID="repace-print-failed" icon={controlIcon('info')} message={t('documents.output.failed')} />
        )}
        {offered && signing.choice}
        {!offered ? (
          <Notice testID="repace-not-offered" icon={controlIcon('info')} message={t('repace.notOffered')} />
        ) : draft.primary ? (
          <RepaceApproval
            status={status}
            printed={printed?.day ?? null}
            today={day}
            busy={output.busy}
            profile={profile}
            onPrint={() => print(draft)}
            onRecord={confirm}
            onEdit={() => {
              setEditing(true);
              setTicks(printed?.choices ?? null);
            }}
          />
        ) : (
          <View style={styles.group}>
            <Button testID="repace-confirm" label={t('repace.confirm')} onPress={() => confirm()} />
            <Button
              testID="repace-print"
              variant="line"
              label={t('repace.print')}
              disabled={output.busy}
              onPress={() => print(draft)}
            />
          </View>
        )}
      </ScrollView>
      {said !== null && (
        <Snackbar
          testID="repace-done"
          message={said.message}
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
  content: { gap: spacing['space-16'], paddingTop: spacing['space-16'] },
  card: {
    gap: spacing['space-6'],
    padding: spacing['space-14'],
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
  },
  group: { gap: spacing['space-8'] },
  bullet: { flexDirection: 'row', gap: spacing['space-8'] },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.ink2, marginTop: 9 },
  grow: { flex: 1 },
  title: { ...typography.label, color: colors.ink },
  label: { ...typography.label, color: colors.ink },
  body: { ...typography.body, color: colors.ink },
  sub: { ...typography.caption, color: colors.ink2 },
});
