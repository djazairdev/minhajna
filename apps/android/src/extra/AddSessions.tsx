// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Add/edit make-up, support or revision days (#219, #222, PRD §4.5).
// Preview sessions and capacity; save and undo preserve durable history.

import {
  addSessionsDay,
  addedEntry,
  busySlots,
  cancelCalendarEntry,
  closuresBefore,
  editableCalendarEntry,
  followedEntries,
  setCalendarEntry,
  slotKey,
  type AddedDay,
  type AddedKind,
  type Day,
  type Weekday,
  type CalendarEntry,
} from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useMemo, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { ChipGroup } from '../components/Chip';
import { Notice } from '../components/Notice';
import { SegmentedControl } from '../components/SegmentedControl';
import { Snackbar } from '../components/Snackbar';
import { controlIcon } from '../design/Icon';
import { spacing } from '../design/tokens';
import { coreContext } from '../storage/core-context';
import { useAppData } from '../storage/AppData';
import { currentLanguage, useText } from '../text/i18n';
import { dayName } from '../today/DayMark';
import { addedName, closureWeekday, firstChoice, firstOffer, taughtSchools } from './add-sessions-rules';
import { AddSessionsChanges, sessionLabel } from './AddSessionsChanges';
import { monthOf } from './extra-rules';
import { MonthDays } from './MonthDays';
import { SourceConfidence } from './SourceConfidence';
import { useCalendarSave } from '../calendar/useCalendarSave';
import { SaveProblem } from '../calendar/SaveProblem';
import { addSessionsStyles as styles } from './add-sessions-styles';
import { closureChoices } from './closure-choices';

const KINDS = ['make-up', 'support', 'revision'] as const;

type Said = { readonly id: string } | 'failed' | null;

export function AddSessions({
  entryId,
  schoolId: startSchool,
  onDone,
}: {
  entryId?: string;
  schoolId?: string;
  onDone?: (entry: CalendarEntry) => void;
} = {}) {
  const t = useText();
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  const data = useAppData();
  const { state, profile, year, calendar, packs, today, newId, unsaved } = data;
  const [initial] = useState(() =>
    entryId === undefined ? undefined : state.calendar.find((entry) => entry.id === entryId),
  );
  const writer = useCalendarSave();
  const context = useMemo(
    () => coreContext({ profile, year, calendar, packs, state }),
    [profile, year, calendar, packs, state],
  );
  const schools = taughtSchools(state);
  const [kind, setKind] = useState<AddedKind>(initial?.adds ?? 'make-up');
  const [schoolId, setSchoolId] = useState(initial?.schoolId ?? startSchool ?? schools[0]?.id ?? '');
  const [day, setDay] = useState<Day>(() => initial?.from ?? firstOffer(year, today(), profile));
  const [month, setMonth] = useState(monthOf(day));
  const closures = kind === 'make-up' ? closuresBefore(context, schoolId, day) : [];
  const [replaces, setReplaces] = useState<string>(
    initial === undefined ? (closures[0]?.id ?? 'none') : (initial.replaces ?? 'none'),
  );
  const closure = closures.find((one) => one.id === replaces);
  const [follows, setFollows] = useState<Weekday>(
    initial?.follows ?? (closure && closureWeekday(closure, profile)) ?? profile.workingDays[0] ?? 0,
  );
  const [picked, setPicked] = useState<string[] | null>(initial?.takes === undefined ? null : [...initial.takes]);
  const [source, setSource] = useState(initial?.source ?? t('addSessions.sourceDefault'));
  const [confidence, setConfidence] = useState<'announced' | 'expected'>(
    initial?.confidence === 'expected' ? 'expected' : 'announced',
  );
  const [tried, setTried] = useState(false);
  const [said, setSaid] = useState<Said>(null);
  const savedFrom = useRef<typeof state | null>(null);
  const undone = useRef<string | null>(null);

  const followed = followedEntries(context, schoolId, day, follows);
  const taken = busySlots(context, day, initial?.id);
  const chosen = picked ?? firstChoice(followed, taken);
  const slots = followed.filter((one) => chosen.includes(one.take)).map((one) => slotKey(one.entry.slot));
  const clash = new Set(slots).size !== slots.length || slots.some((slot) => taken.has(slot));
  const align = { writingDirection: direction, textAlign: 'start' } as const;

  if (
    schools.length === 0 ||
    (entryId !== undefined && (initial === undefined || editableCalendarEntry(context, entryId) === null))
  ) {
    return (
      <View style={[styles.screen, styles.content]}>
        <Notice testID="add-closed" icon={controlIcon('info')} message={t('addSessions.noClass')} />
      </View>
    );
  }

  const added: AddedDay = {
    id: initial?.id ?? 'preview',
    schoolId,
    day,
    adds: kind,
    follows,
    takes: chosen,
    ...(closure !== undefined && { replaces: closure.id }),
    name: initial !== undefined && kind === initial.adds ? initial.name : addedName(kind),
    source,
    confidence,
  };
  const reset = (change: () => void) => {
    if (writer.isBusy()) return;
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

  const save = async () => {
    if (writer.isBusy() || (savedFrom.current === state && !unsaved)) return;
    setTried(true);
    if (chosen.length === 0 || clash || source.trim() === '') return;
    const id = initial?.id ?? newId();
    try {
      const raw = addSessionsDay(context, { ...added, id });
      if (raw.kind !== 'calendar.set') return;
      const event = setCalendarEntry(context, { ...initial, ...raw.entry });
      savedFrom.current = state;
      if (!(await writer.save(event, state))) return;
      undone.current = null;
      if (onDone !== undefined) {
        onDone(raw.entry);
        return;
      }
    } catch (error: unknown) {
      if (__DEV__) console.warn('A day adding sessions was refused', error);
      setSaid('failed');
      return;
    }
    setPicked(null);
    setTried(false);
    setSaid({ id });
  };

  const undo = async () => {
    if (said === null || said === 'failed' || undone.current === said.id) return;
    undone.current = said.id;
    const event = initial === undefined ? cancelCalendarEntry(context, said.id) : setCalendarEntry(context, initial);
    if (await writer.save(event, state)) setSaid(null);
    else undone.current = null;
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
          disabled={writer.busy}
          onSelect={(next) => reset(() => setKind(next))}
        />
        <Text style={[styles.body, align]}>{t(`addSessions.intros.${kind}`)}</Text>
        {schools.length > 1 && initial === undefined && (
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
            choices={closureChoices(t, profile, closures)}
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
            onSelect={(next) => {
              if (!writer.isBusy()) setPicked(next);
            }}
          />
        )}
        <SourceConfidence
          testID="add"
          source={source}
          confidence={confidence}
          busy={writer.busy}
          onSource={(next) => {
            if (!writer.isBusy()) setSource(next);
          }}
          onConfidence={(next) => {
            if (!writer.isBusy()) setConfidence(next);
          }}
        />
        {chosen.length > 0 && !clash && <AddSessionsChanges context={context} entry={addedEntry(added)} />}
        {clash && <Notice testID="add-clash" icon={controlIcon('info')} message={t('addSessions.clash')} />}
        {tried && !clash && (chosen.length === 0 || source.trim() === '') && (
          <Notice testID="add-choose" icon={controlIcon('info')} message={t('addSessions.choose')} />
        )}
        {said === 'failed' && (
          <Notice testID="add-failed" icon={controlIcon('info')} message={t('addSessions.failed')} />
        )}
        <SaveProblem testID="add-write-failed" problem={writer.problem} />
        <Button
          testID="add-save"
          label={t(initial === undefined ? 'addSessions.save' : 'calendarView.edit.save')}
          onPress={save}
          disabled={writer.busy}
        />
      </ScrollView>
      {said !== null && said !== 'failed' && (
        <Snackbar
          testID="add-snack"
          message={t('addSessions.saved')}
          undoLabel={t('addSessions.undo')}
          bottomOffset={insets.bottom}
          onUndo={() => {
            void undo();
          }}
        />
      )}
    </View>
  );
}
