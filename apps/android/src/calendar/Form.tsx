// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  calendarImpact,
  setCalendarEntry,
  type CalendarEntry,
  type CalendarImpact,
  type CalendarMutation,
  type State,
} from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useRef, useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { ChipGroup } from '../components/Chip';
import { Notice } from '../components/Notice';
import { TextField } from '../components/TextField';
import { controlIcon } from '../design/Icon';
import { spacing } from '../design/tokens';
import { SourceConfidence } from '../extra/SourceConfidence';
import { settingsStyles as styles } from '../settings/styles';
import { coreContext } from '../storage/core-context';
import { useAppData } from '../storage/AppData';
import { currentLanguage, useText } from '../text/i18n';
import { calendarCatalogues } from './catalogues';
import { DateSpan } from './DateSpan';
import { draftEntry, initialCalendarDraft, offeredKinds, type CalendarDraft } from './edit-draft';
import { Impact } from './Impact';
import { SaveProblem } from './SaveProblem';
import { Period } from './Period';
import { useCalendarSave } from './useCalendarSave';

type Prepared = {
  readonly event: CalendarMutation;
  readonly entry: CalendarEntry;
  readonly impact: CalendarImpact;
  readonly state: State;
};

/** A form never writes a partial entry: its current preview must be confirmed against the same durable state. */
export function CalendarForm({
  schoolId,
  old,
  onSaved,
  onAddDay,
  onAddReset,
}: {
  schoolId: string;
  old?: CalendarEntry;
  onSaved: (entry: CalendarEntry) => void;
  onAddDay: (schoolId: string) => void;
  onAddReset?: (schoolId: string) => void;
}) {
  const t = useText();
  const { direction } = useLocale();
  const insets = useSafeAreaInsets();
  const data = useAppData();
  const writer = useCalendarSave();
  const [id] = useState(() => old?.id ?? data.newId());
  const [draft, setDraft] = useState(() => initialCalendarDraft(data, schoolId, old));
  const [invalid, setInvalid] = useState(false);
  const [shown, setShown] = useState<Prepared | null>(null);
  const prepared = useRef<Prepared | null>(null);
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const context = coreContext(data);
  const school = data.state.schools.get(draft.schoolId);
  const privateEntry = draft.kind === 'training' || draft.kind === 'duty';
  const change = (values: Partial<CalendarDraft>) => {
    if (writer.isBusy()) return;
    prepared.current = null;
    setShown(null);
    setInvalid(false);
    setDraft((previous) => ({ ...previous, ...values }));
  };
  const preview = () => {
    if (writer.isBusy()) return;
    try {
      const entry = draftEntry(data, id, draft, currentLanguage(), old);
      const event = setCalendarEntry(context, entry);
      const next = { entry, event, impact: calendarImpact(context, event, data.today()), state: data.state };
      prepared.current = next;
      setShown(next);
      setInvalid(false);
    } catch {
      prepared.current = null;
      setShown(null);
      setInvalid(true);
    }
  };
  const save = async () => {
    const next = prepared.current;
    if (next === null) return;
    if (await writer.save(next.event, next.state)) onSaved(next.entry);
  };
  return (
    <ScrollView
      style={styles.screen}
      keyboardShouldPersistTaps="handled"
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
      <ChipGroup
        testID="calendar-kind"
        label={t('calendarView.edit.kind')}
        selected={draft.kind}
        choices={offeredKinds(old).map((value) => ({ value, label: t(`calendarView.edit.kinds.${value}`) }))}
        onSelect={(kind) =>
          change({
            kind,
            ...(draft.title === calendarCatalogues[currentLanguage()].edit.kinds[draft.kind] && {
              title: calendarCatalogues[currentLanguage()].edit.kinds[kind],
            }),
          })
        }
      />
      {draft.kind === 'ab-reset' ? (
        <Button
          testID="calendar-add-reset"
          label={t('calendarView.abEdit.open')}
          onPress={() => onAddReset?.(draft.schoolId)}
          disabled={onAddReset === undefined}
        />
      ) : draft.kind === 'added-day' ? (
        <Button
          testID="calendar-add-sessions"
          label={t('calendarView.edit.addSessions')}
          onPress={() => onAddDay(draft.schoolId)}
        />
      ) : (
        <>
          <Notice icon={controlIcon('info')} message={t('calendarView.edit.wholeDay')} />
          {old === undefined && data.state.schools.size > 1 ? (
            <ChipGroup
              testID="calendar-edit-school"
              label={t('calendarView.school')}
              choices={[...data.state.schools.values()].map((one) => ({ value: one.id, label: one.name }))}
              selected={draft.schoolId}
              onSelect={(next) => change({ schoolId: next })}
            />
          ) : (
            <Text style={[styles.title, align]}>{school?.name ?? t('calendarView.noSchool')}</Text>
          )}
          {old !== undefined && <Text style={[styles.sub, align]}>{t('calendarView.edit.scopeFixed')}</Text>}
          {privateEntry && <Notice icon={controlIcon('lock')} message={t('calendarView.edit.private')} />}
          <TextField
            testID="calendar-title"
            label={t('calendarView.edit.title')}
            placeholder={t('calendarView.edit.titleExample')}
            value={draft.title}
            onChangeText={(title) => change({ title })}
            maxLength={160}
            editable={!writer.busy}
          />
          <DateSpan from={draft.from} to={draft.to} onChange={(from, to) => change({ from, to })} />
          <Period selected={draft.period} onSelect={(period) => change({ period })} />
          <SourceConfidence
            testID="calendar"
            source={draft.source}
            confidence={draft.confidence}
            busy={writer.busy}
            onSource={(source) => change({ source })}
            onConfidence={(confidence) => change({ confidence })}
          />
          {draft.kind === 'zone-closure' && school?.zone === undefined && (
            <Notice icon={controlIcon('info')} message={t('calendarView.edit.needZone')} />
          )}
          {invalid && (
            <Notice testID="calendar-invalid" icon={controlIcon('info')} message={t('calendarView.edit.invalid')} />
          )}
          <Button
            testID="calendar-preview"
            label={t('calendarView.edit.previewButton')}
            disabled={writer.busy}
            onPress={preview}
          />
          {shown !== null && <Impact impact={shown.impact} />}
          <SaveProblem testID="calendar-save-failed" problem={writer.problem} />
          {writer.busy && <Text style={[styles.sub, align]}>{t('calendarView.edit.saving')}</Text>}
          {shown !== null && (
            <Button testID="calendar-save" label={t('calendarView.edit.save')} disabled={writer.busy} onPress={save} />
          )}
        </>
      )}
    </ScrollView>
  );
}
