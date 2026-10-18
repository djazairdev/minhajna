// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «إضافة حصص» (#219, Calendar-add-sessions): a make-up, support or revision
// day the school sets, on the timetable of a chosen weekday (R-4.5-08). The
// kind, the school when there are several, the day on a month's grid, the
// closure it makes up for, the weekday, and that weekday's sessions, the
// day's A or B week chosen first. What changes shows before saving: the
// sessions, where they go, and each class's spare sessions before the exams.
// Make-up sessions move the plan; support and revision sessions do not. Two
// sessions never share a slot. A second tap waits until the screen shows
// the first save. «تراجع» takes the day back.

import {
  addSessionsDay,
  addedEntry,
  busySlots,
  closuresBefore,
  followedEntries,
  slotKey,
  type AddedDay,
  type AddedKind,
  type Day,
  type Weekday,
} from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { ChipGroup } from '../components/Chip';
import { Notice } from '../components/Notice';
import { SegmentedControl } from '../components/SegmentedControl';
import { Snackbar } from '../components/Snackbar';
import { TextField } from '../components/TextField';
import { controlIcon } from '../design/Icon';
import { colors, spacing, typography } from '../design/tokens';
import { coreContext } from '../storage/core-context';
import { useAppData } from '../storage/AppData';
import { currentLanguage, useText } from '../text/i18n';
import { dayName } from '../today/DayMark';
import { addedName, closureWeekday, firstChoice, firstOffer, taughtSchools } from './add-sessions-rules';
import { AddSessionsChanges, sessionLabel } from './AddSessionsChanges';
import { monthOf } from './extra-rules';
import { MonthDays } from './MonthDays';

const KINDS = ['make-up', 'support', 'revision'] as const;

type Said = { readonly id: string } | 'failed' | null;

export function AddSessions() {
  const t = useText();
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  const data = useAppData();
  const { state, profile, year, calendar, packs, today, record, recordAll, newId, unsaved } = data;
  const context = useMemo(
    () => coreContext({ profile, year, calendar, packs, state }),
    [profile, year, calendar, packs, state],
  );
  const schools = taughtSchools(state);
  const [kind, setKind] = useState<AddedKind>('make-up');
  const [schoolId, setSchoolId] = useState(schools[0]?.id ?? '');
  const [day, setDay] = useState<Day>(() => firstOffer(year, today(), profile));
  const [month, setMonth] = useState(monthOf(day));
  const closures = kind === 'make-up' ? closuresBefore(context, schoolId, day) : [];
  const [replaces, setReplaces] = useState<string>(closures[0]?.id ?? 'none');
  const closure = closures.find((one) => one.id === replaces);
  const [follows, setFollows] = useState<Weekday>(
    (closure && closureWeekday(closure, profile)) ?? profile.workingDays[0] ?? 0,
  );
  const [picked, setPicked] = useState<string[] | null>(null);
  const [source, setSource] = useState(t('addSessions.sourceDefault'));
  const [confidence, setConfidence] = useState<'announced' | 'expected'>('announced');
  const [tried, setTried] = useState(false);
  const [said, setSaid] = useState<Said>(null);
  const savedFrom = useRef<typeof state | null>(null);
  const undone = useRef<string | null>(null);

  const followed = followedEntries(context, schoolId, day, follows);
  const taken = busySlots(context, day);
  const chosen = picked ?? firstChoice(followed, taken);
  const slots = followed.filter((one) => chosen.includes(one.take)).map((one) => slotKey(one.entry.slot));
  const clash = new Set(slots).size !== slots.length || slots.some((slot) => taken.has(slot));
  const align = { writingDirection: direction, textAlign: 'start' } as const;

  if (schools.length === 0) {
    return (
      <View style={[styles.screen, styles.content]}>
        <Notice testID="add-closed" icon={controlIcon('info')} message={t('addSessions.noClass')} />
      </View>
    );
  }

  const added: AddedDay = {
    id: 'preview',
    schoolId,
    day,
    adds: kind,
    follows,
    takes: chosen,
    ...(closure !== undefined && { replaces: closure.id }),
    name: addedName(kind),
    source,
    confidence,
  };
  const reset = (change: () => void) => {
    change();
    setPicked(null);
  };
  const chooseDay = (next: Day) => reset(() => setDay(next));
  const chooseClosure = (id: string) =>
    reset(() => {
      setReplaces(id);
      const found = closures.find((one) => one.id === id);
      const covered = found && closureWeekday(found, profile);
      if (covered != null) setFollows(covered);
    });

  const save = () => {
    if (savedFrom.current === state && !unsaved) return;
    setTried(true);
    if (chosen.length === 0 || clash || source.trim() === '') return;
    const id = newId();
    try {
      const event = addSessionsDay(context, { ...added, id });
      savedFrom.current = state;
      recordAll([event]);
    } catch (error: unknown) {
      if (__DEV__) console.warn('A day adding sessions was refused', error);
      setSaid('failed');
      return;
    }
    setPicked(null);
    setTried(false);
    setSaid({ id });
  };

  const undo = () => {
    if (said === null || said === 'failed' || undone.current === said.id) return;
    undone.current = said.id;
    setSaid(null);
    record({ kind: 'calendar.removed', id: said.id, layer: 'school' });
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          {
            direction,
            paddingBottom: insets.bottom + (said === null ? spacing['space-24'] : 96),
            paddingLeft: insets.left + spacing['space-16'],
            paddingRight: insets.right + spacing['space-16'],
          },
        ]}
      >
        <SegmentedControl
          testID="add-kind"
          label={t('addSessions.kind')}
          choices={[
            { value: KINDS[0], label: t(`addSessions.kinds.${KINDS[0]}`) },
            { value: KINDS[1], label: t(`addSessions.kinds.${KINDS[1]}`) },
            { value: KINDS[2], label: t(`addSessions.kinds.${KINDS[2]}`) },
          ]}
          selected={kind}
          onSelect={(next) => reset(() => setKind(next))}
        />
        <Text style={[styles.body, align]}>{t(`addSessions.intros.${kind}`)}</Text>
        {schools.length > 1 && (
          <ChipGroup
            testID="add-school"
            label={t('addSessions.school')}
            choices={schools.map((school) => ({ value: school.id, label: school.name }))}
            selected={schoolId}
            onSelect={(next) => reset(() => setSchoolId(next))}
          />
        )}
        <View style={styles.group}>
          <Text style={[styles.label, align]}>{t('addSessions.day')}</Text>
          <MonthDays
            month={month}
            selected={day}
            first={year.from}
            last={year.to}
            profile={profile}
            onMonth={setMonth}
            onSelect={chooseDay}
          />
          <Text testID="add-day" style={[styles.body, align]}>
            {dayName(t, day, currentLanguage(), profile)}
          </Text>
        </View>
        {closures.length > 0 && (
          <ChipGroup
            testID="add-replaces"
            label={t('addSessions.replaces')}
            choices={[
              ...closures.map((one) => ({ value: one.id, label: dayName(t, one.from, currentLanguage(), profile) })),
              { value: 'none', label: t('addSessions.noClosure') },
            ]}
            selected={closure?.id ?? 'none'}
            onSelect={chooseClosure}
          />
        )}
        <ChipGroup
          testID="add-follows"
          label={t('addSessions.follows')}
          choices={profile.workingDays.map((one) => ({ value: String(one), label: t(`week.days.${one}`) }))}
          selected={String(follows)}
          onSelect={(next) => reset(() => setFollows(Number(next) as Weekday))}
        />
        {followed.length === 0 ? (
          <Notice testID="add-none" icon={controlIcon('info')} message={t('addSessions.noSessions')} />
        ) : (
          <ChipGroup
            testID="add-sessions"
            label={t('addSessions.sessions')}
            hint={t('addSessions.sessionsHint')}
            multiple
            choices={followed.map((one) => ({ value: one.take, label: sessionLabel(t, data, one, day) }))}
            selected={chosen}
            onSelect={setPicked}
          />
        )}
        <TextField
          testID="add-source"
          label={t('addSessions.source')}
          placeholder={t('addSessions.sourceDefault')}
          value={source}
          onChangeText={setSource}
          maxLength={200}
        />
        <View style={styles.group}>
          <Text style={[styles.label, align]}>{t('addSessions.confidence')}</Text>
          <SegmentedControl
            testID="add-confidence"
            label={t('addSessions.confidence')}
            choices={[
              { value: 'announced', label: t('addSessions.confidences.announced') },
              { value: 'expected', label: t('addSessions.confidences.expected') },
            ]}
            selected={confidence}
            onSelect={setConfidence}
          />
        </View>
        {chosen.length > 0 && !clash && <AddSessionsChanges context={context} entry={addedEntry(added)} />}
        {clash && <Notice testID="add-clash" icon={controlIcon('info')} message={t('addSessions.clash')} />}
        {tried && !clash && (chosen.length === 0 || source.trim() === '') && (
          <Notice testID="add-choose" icon={controlIcon('info')} message={t('addSessions.choose')} />
        )}
        {said === 'failed' && (
          <Notice testID="add-failed" icon={controlIcon('info')} message={t('addSessions.failed')} />
        )}
        <Button testID="add-save" label={t('addSessions.save')} onPress={save} />
      </ScrollView>
      {said !== null && said !== 'failed' && (
        <Snackbar
          testID="add-snack"
          message={t('addSessions.saved')}
          undoLabel={t('addSessions.undo')}
          bottomOffset={insets.bottom}
          onUndo={undo}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { gap: spacing['space-16'], paddingTop: spacing['space-16'] },
  group: { gap: spacing['space-8'] },
  label: { ...typography.label, color: colors.ink2 },
  body: { ...typography.body, color: colors.ink },
});
