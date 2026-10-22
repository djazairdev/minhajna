// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { maxDay, minDay, setCalendarEntry, type CalendarEntry, type SchoolClass } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChipGroup } from '../components/Chip';
import { Notice } from '../components/Notice';
import { controlIcon } from '../design/Icon';
import { spacing } from '../design/tokens';
import { SourceConfidence } from '../extra/SourceConfidence';
import { settingsStyles as styles } from '../settings/styles';
import { useAppData } from '../storage/AppData';
import { coreContext } from '../storage/core-context';
import { useText } from '../text/i18n';
import { calendarCatalogues } from './catalogues';
import { DateSpan } from './DateSpan';
import { GroupSplit } from './GroupSplit';
import { GroupPreview } from './GroupPreview';
import { PreviewActions } from './PreviewActions';
import { useCalendarPreview } from './useCalendarPreview';

/**
 * Local school rules for one class, with separately reviewed roster preparation. A class archived after a
 * reorientation is offered only for its own rotation already set (#231).
 */
export function Groups({
  schoolId,
  old,
  onSaved,
}: {
  schoolId: string;
  old?: CalendarEntry;
  onSaved: (entry: CalendarEntry) => void;
}) {
  const data = useAppData();
  const t = useText();
  const { direction } = useLocale();
  const insets = useSafeAreaInsets();
  const classes = [...data.state.classes.values()].filter(
    (one) => one.schoolId === schoolId && (one.archivedFrom === undefined || one.id === old?.rotation?.classId),
  );
  const [classId, setClass] = useState(old?.rotation?.classId ?? classes[0]?.id ?? '');
  const schoolClass = classes.find((one) => one.id === classId);
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
      <Text accessibilityRole="header" style={styles.title}>
        {t('calendarView.groups.open')}
      </Text>
      <Notice icon={controlIcon('info')} message={t('calendarView.groups.notice')} />
      {old === undefined && (
        <ChipGroup
          testID="rotation-class"
          label={t('calendarView.groups.class')}
          choices={classes.map((one) => ({ value: one.id, label: one.name }))}
          selected={classId}
          onSelect={setClass}
        />
      )}
      {schoolClass === undefined ? (
        <Text style={styles.body}>{t('calendarView.groups.noClass')}</Text>
      ) : (
        <GroupsEditor key={classId} schoolClass={schoolClass} old={old} onSaved={onSaved} />
      )}
    </ScrollView>
  );
}

function GroupsEditor({
  schoolClass,
  old,
  onSaved,
}: {
  schoolClass: SchoolClass;
  old?: CalendarEntry;
  onSaved: (entry: CalendarEntry) => void;
}) {
  const data = useAppData();
  const t = useText();
  const [id] = useState(() => old?.id ?? data.newId());
  const [from, setFrom] = useState(old?.from ?? minDay(maxDay(data.today(), data.year.from), data.year.to));
  const [to, setTo] = useState(old?.to ?? from);
  const [reverse, setReverse] = useState(false);
  const [source, setSource] = useState(old?.source ?? '');
  const [confidence, setConfidence] = useState<'announced' | 'expected'>(
    old?.confidence === 'expected' ? 'expected' : 'announced',
  );
  const [confirmed, setConfirmed] = useState(false);
  const draft = useCalendarPreview(() => {
    if (!confirmed) throw new RangeError('Confirm the split first');
    const ids = old?.rotation?.groups ?? schoolClass.groups.filter((one) => one.kind === 'half').map((one) => one.id);
    const groups: readonly [string, string] = reverse ? [ids[1], ids[0]] : [ids[0], ids[1]];
    return setCalendarEntry(coreContext(data), {
      id,
      layer: 'school',
      schoolId: schoolClass.schoolId,
      from,
      to,
      source,
      confidence,
      effect: 'rotating-groups',
      rotation: { classId: schoolClass.id, groups },
      name: Object.fromEntries(
        Object.entries(calendarCatalogues).map(([language, text]) => [language, text.groups.open]),
      ),
    });
  }, onSaved);
  return (
    <>
      <Text style={styles.title}>{schoolClass.name}</Text>
      <GroupSplit
        schoolClass={schoolClass}
        disabled={draft.busy}
        onEdited={() => draft.change(() => setConfirmed(false))}
        onConfirmed={() => draft.change(() => setConfirmed(true))}
      />
      {confirmed && (
        <Text testID="rotation-split-ready" style={styles.body}>
          {t('calendarView.groups.splitReady')}
        </Text>
      )}
      <DateSpan
        from={from}
        to={to}
        onChange={(a, b) =>
          draft.change(() => {
            setFrom(a);
            setTo(b);
          })
        }
      />
      <ChipGroup
        testID="rotation-order"
        label={t('calendarView.groups.order')}
        selected={reverse ? 'reverse' : 'keep'}
        choices={[
          { value: 'keep', label: t('calendarView.groups.keep') },
          { value: 'reverse', label: t('calendarView.groups.reverse') },
        ]}
        onSelect={(value) => draft.change(() => setReverse(value === 'reverse'))}
      />
      <SourceConfidence
        testID="calendar"
        source={source}
        confidence={confidence}
        busy={draft.busy}
        onSource={(value) => draft.change(() => setSource(value))}
        onConfidence={(value) => draft.change(() => setConfidence(value))}
      />
      <Text style={styles.body}>{t('calendarView.groups.rules')}</Text>
      {draft.shown !== null && <GroupPreview entry={draft.shown.entry} />}
      <PreviewActions draft={draft} />
    </>
  );
}
