// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «مسودة توزيع بقية الفصل» (#229, Repace, R-4.7-29 to R-4.7-34, answers
// 363 to 370): the counts, the merges and leave-outs proposed with the
// draft as ticks the teacher can take off while re-pacing is offered, what
// changes against the current distribution, and the weeks. A tick follows
// its choice, not its place in the list. «اعتماد التوزيع» records it with
// its ticked decisions, and «تراجع» takes all of it back at once. In
// primary the director approves it first, so it waits for the printed draft
// and its approval date. Nothing applies before the teacher confirms.

import {
  confirmRepace,
  removeRepace,
  repaceDraft,
  repaceOffered,
  repacesOf,
  type Context,
  type RecordEvent,
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
import { courseLabel } from '../exams/course-label';
import { coreContext } from '../storage/core-context';
import { useAppData } from '../storage/AppData';
import { currentLanguage, useText } from '../text/i18n';
import { dayName } from '../today/DayMark';
import { isolate } from '../week/grid-labels';
import { changeLines, choiceKey, choiceWords, countLines, rangeWords } from './repace-rules';
import { RepaceWeeks } from './RepaceWeeks';

type Said = { readonly undo: (now: Context) => readonly RecordEvent[]; readonly message: string } | null;

export function Repace({ courseId }: { readonly courseId: string }) {
  const t = useText();
  const data = useAppData();
  const { state, profile, recordAll, newId, today } = data;
  const { direction } = useLocale();
  const insets = useSafeAreaInsets();
  const language = currentLanguage();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const day = today();
  const context = useMemo(() => coreContext(data), [data]);
  const [ticks, setTicks] = useState<readonly string[] | null>(null);
  const draft = useMemo(() => {
    const suggested = repaceDraft(context, courseId, day);
    if (ticks === null || suggested === null) return suggested;
    const picked = suggested.choices.flatMap((choice, index) => (ticks.includes(choiceKey(choice)) ? [index] : []));
    return repaceDraft(context, courseId, day, picked);
  }, [context, courseId, day, ticks]);
  const offered = useMemo(() => repaceOffered(context, courseId, day), [context, courseId, day]);
  const newest = repacesOf(state, courseId).at(-1);
  const [said, setSaid] = useState<Said>(null);
  const [failed, setFailed] = useState(false);
  const appliedFrom = useRef<typeof state | null>(null);
  const className = courseLabel(t, state, profile, courseId);
  const once = (events: readonly RecordEvent[], next: Said) => {
    if (appliedFrom.current === state) return;
    appliedFrom.current = state;
    recordAll([...events]);
    setSaid(next);
    setFailed(false);
  };
  const confirm = () => {
    if (draft === null) return;
    const ids = { repace: newId(), decisions: draft.ticked.map(() => newId()) };
    let events: RecordEvent[];
    try {
      events = confirmRepace(context, { courseId, ticked: draft.ticked, ids }, day);
    } catch {
      setFailed(true);
      return;
    }
    once(events, { undo: (now) => removeRepace(now, ids.repace, true), message: t('repace.confirmed') });
    setTicks(null);
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
        {offered && draft.choices.length > 0 && (
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
            message={t('repace.applied', { day: dayName(t, newest.on, language, profile) })}
          />
        )}
        {failed && <Notice testID="repace-failed" icon={controlIcon('info')} message={t('repace.failed')} />}
        {draft.primary ? (
          <Notice testID="repace-primary" icon={controlIcon('info')} message={t('repace.primary')} />
        ) : offered ? (
          <Button testID="repace-confirm" label={t('repace.confirm')} onPress={confirm} />
        ) : (
          <Notice testID="repace-not-offered" icon={controlIcon('info')} message={t('repace.notOffered')} />
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
