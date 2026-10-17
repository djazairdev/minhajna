// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «تفاصيل الحصة» (#34, Entry): one entry per session. The row the texts book
// will take, then the session's type, the stages covered, content from
// outside the plan, the homework and its due day, a test given, a factual
// line for the book and statements, and a private note that never leaves
// the teacher's devices, with a warning against pupils' health or
// discipline. «تأكيد الحصة» records it all in one step; nothing is recorded
// before (PRD §2.3, §3.3). «تغيير الدرس» takes another lesson from the plan,
// or content from outside it (Entry-lesson). A recorded session is corrected
// on its own screen.

import {
  carryTo,
  confirmSessions,
  courseSetup,
  formatDay,
  formatTextsBookDay,
  todayView,
  weekday,
  type Day,
} from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, type ViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { CheckRow } from '../components/CheckRow';
import { ChipGroup } from '../components/Chip';
import { TextField } from '../components/TextField';
import { Icon, controlIcon } from '../design/Icon';
import { colors, radius, sizes, spacing, typography } from '../design/tokens';
import { localized } from '../setup/names';
import { coreContext } from '../storage/core-context';
import { useAppData } from '../storage/AppData';
import { useText } from '../text/i18n';
import { span } from '../times/TimeTable';
import { sessionTime } from '../times/times-rules';
import { shortDay } from '../today/outcome-rules';
import { BookRow } from './BookRow';
import { bookLines } from './book-lines';
import { confirmationOf, dueDays, previewOf, startDraft, stagesShown, type EntryDraft } from './entry-rules';
import { LessonSheet } from './LessonSheet';
import { lessonGroups, type Lesson } from './lesson-rules';

/** The session's details; `onDone` goes back once it is recorded. */
export function Entry({ sessionKey, day, onDone }: { sessionKey: string; day: Day; onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  const t = useText();
  const { state, profile, year, calendar, packs, bells, recordAll } = useAppData();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const context = useMemo(
    () => coreContext({ profile, year, calendar, packs, state }),
    [profile, year, calendar, packs, state],
  );
  const item = useMemo(
    () => todayView(context, day).sessions.find((one) => one.session.key === sessionKey),
    [context, day, sessionKey],
  );
  const days = useMemo(() => (item === undefined ? [] : dueDays(context, item.session)), [context, item]);
  const [draft, setDraft] = useState<EntryDraft | null>(() =>
    item === undefined ? null : startDraft(item.session, item.proposal, days[0] ?? null),
  );
  const [allDays, setAllDays] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const change = useRef<ViewInstance>(null);

  if (item === undefined || draft === null || item.status !== 'awaiting') {
    return (
      <View style={[styles.screen, { direction }]}>
        <Text style={[styles.body, styles.pad, align]}>{t('entry.unavailable')}</Text>
      </View>
    );
  }
  const { session, proposal } = item;
  const set = (change: Partial<EntryDraft>) => setDraft({ ...draft, ...change });
  const pack = courseSetup(context, session.courseId).pack;
  const schoolClass = state.classes.get(session.classId);
  const school = schoolClass && state.schools.get(schoolClass.schoolId);
  const time = sessionTime({ bells, calendar, state }, school, session.slot, session.day);
  const timeText = time === null ? null : span(time.from, time.to, direction);
  const confirmation = confirmationOf(profile, session, proposal, draft);
  const preview = previewOf(context, confirmation);
  const shownDays = allDays ? days : days.slice(0, 3);
  const choose = (lesson: Lesson) =>
    set({ lesson, ...(lesson.kind === 'unplanned' && draft.unplanned === null && { unplanned: '' }) });
  const next = carryTo(context, session).next;
  const missing = draft.lesson.kind === 'unplanned' && (draft.unplanned ?? '').trim() === '';

  return (
    <View style={[styles.screen, { direction }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingLeft: insets.left + spacing['space-16'], paddingRight: insets.right + spacing['space-16'] },
        ]}
      >
        <Text style={[styles.note, align]}>
          {[schoolClass?.name, `${t(`week.days.${weekday(session.day)}`)} ${formatDay(session.day)}`, timeText]
            .filter(Boolean)
            .join(' · ')}
        </Text>
        <View style={styles.bookHead}>
          <Text style={[styles.label, styles.grow, align]}>{t('entry.book')}</Text>
          {proposal !== null && pack !== null && (
            <Button
              ref={change}
              testID="entry-change"
              variant="plain"
              label={t('lesson.change')}
              onPress={() => setChoosing(true)}
            />
          )}
        </View>
        {preview !== null && (
          <BookRow
            testID="entry-book"
            date={formatTextsBookDay(session.day)}
            time={timeText}
            lines={bookLines(t, pack, preview, (due) => shortDay(t, due))}
          />
        )}
        <ChipGroup
          testID="entry-type"
          label={t('entry.type')}
          choices={profile.sessionTypes.map((type) => ({ value: type.code, label: localized(type.name) }))}
          selected={draft.sessionType}
          onSelect={(sessionType) => set({ sessionType })}
        />
        {stagesShown(profile, session, proposal, draft) && proposal !== null && (
          <View style={styles.group}>
            <Text style={[styles.label, align]}>{t('entry.stages')}</Text>
            {proposal.stageNames.slice(proposal.from).map((name, index) => {
              const stage = proposal.from + index;
              return (
                <CheckRow
                  key={stage}
                  testID={`entry-stage-${stage + 1}`}
                  label={name}
                  checked={stage < draft.reached}
                  onCheckedChange={(checked) => set({ reached: checked ? stage + 1 : stage })}
                />
              );
            })}
          </View>
        )}
        {draft.unplanned === null ? (
          <Button
            testID="entry-unplanned-open"
            variant="line"
            label={t('entry.addUnplanned')}
            onPress={() => set({ unplanned: '' })}
          />
        ) : (
          <TextField
            testID="entry-unplanned"
            label={t('entry.unplanned')}
            placeholder={t('entry.unplannedPlaceholder')}
            value={draft.unplanned}
            onChangeText={(unplanned) => set({ unplanned })}
            multiline
          />
        )}
        <TextField
          testID="entry-homework"
          label={t('entry.homework')}
          placeholder={t('entry.homeworkPlaceholder')}
          value={draft.homework}
          onChangeText={(homework) => set({ homework })}
        />
        {draft.homework.trim() !== '' && shownDays.length > 0 && (
          <ChipGroup
            testID="entry-due"
            label={t('entry.due')}
            choices={shownDays.map((one) => ({ value: one, label: shortDay(t, one) }))}
            selected={draft.due}
            onSelect={(due) => set({ due })}
            {...(!allDays &&
              days.length > 3 && { more: { label: t('entry.dueOther'), onPress: () => setAllDays(true) } })}
          />
        )}
        <CheckRow
          testID="entry-test"
          label={t('entry.test')}
          checked={draft.test}
          onCheckedChange={(test) => set({ test })}
        />
        <TextField
          testID="entry-factual"
          label={t('entry.factual')}
          optionalLabel={t('entry.optional')}
          placeholder={t('entry.factualPlaceholder')}
          value={draft.factual}
          onChangeText={(factual) => set({ factual })}
          multiline
        />
        <View testID="entry-private" style={styles.private}>
          <View style={styles.privateHead}>
            <Icon name="lock" size={sizes['icon-small']} color={colors.ink2} />
            <Text style={[styles.label, styles.privateTitle, align]}>{t('entry.note')}</Text>
          </View>
          <TextField
            testID="entry-note"
            label={t('entry.noteLabel')}
            placeholder={t('entry.notePlaceholder')}
            value={draft.note}
            onChangeText={(note) => set({ note })}
            multiline
          />
          <Text style={[styles.note, align]}>{t('entry.noteWarning')}</Text>
        </View>
      </ScrollView>
      <View style={[styles.foot, { paddingBottom: insets.bottom + spacing['space-16'] }]}>
        <Button
          testID="entry-confirm"
          label={t('entry.confirm')}
          icon={controlIcon('check')}
          disabled={missing}
          onPress={() => {
            recordAll(confirmSessions(context, [confirmation]));
            onDone();
          }}
        />
      </View>
      {proposal !== null && pack !== null && (
        <LessonSheet
          visible={choosing}
          context={[schoolClass?.name, timeText, t('lesson.context', { item: proposal.item.title })]
            .filter(Boolean)
            .join(' · ')}
          className={schoolClass?.name ?? ''}
          proposal={proposal}
          lesson={draft.lesson}
          groups={(query) => lessonGroups(context, profile, pack, session, proposal, query)}
          dayName={(one) => shortDay(t, one)}
          nextDay={next === null ? null : shortDay(t, next.day)}
          onChoose={choose}
          onClose={() => setChoosing(false)}
          returnFocusRef={change}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { gap: spacing['space-16'], padding: spacing['space-16'] },
  pad: { padding: spacing['space-16'] },
  group: { gap: spacing['space-4'] },
  body: { ...typography.body, color: colors.ink },
  label: { ...typography.label, color: colors.ink },
  note: { ...typography.caption, color: colors.ink2 },
  private: {
    gap: spacing['space-8'],
    padding: spacing['space-12'],
    borderRadius: radius['radius-card'],
    backgroundColor: colors.private,
  },
  privateHead: { flexDirection: 'row', alignItems: 'center', gap: spacing['space-8'] },
  privateTitle: { flex: 1 },
  bookHead: { flexDirection: 'row', alignItems: 'center', gap: spacing['space-8'] },
  grow: { flex: 1 },
  foot: { paddingHorizontal: spacing['space-16'], paddingTop: spacing['space-12'], backgroundColor: colors.paper },
});
