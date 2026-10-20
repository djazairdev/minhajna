// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { assignRotationGroups, type ClassGroup, type SchoolClass } from '@minhajna/core';
import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Button } from '../components/Button';
import { ChipGroup } from '../components/Chip';
import { Notice } from '../components/Notice';
import { controlIcon } from '../design/Icon';
import { settingsStyles as styles } from '../settings/styles';
import { useAppData } from '../storage/AppData';
import { coreContext } from '../storage/core-context';
import { useText } from '../text/i18n';
import { SaveProblem } from './SaveProblem';
import { useCalendarSave } from './useCalendarSave';

/** A proposed split is never saved or used for roll call without the teacher's explicit confirmation. */
export function GroupSplit({
  schoolClass,
  onEdited,
  onConfirmed,
  disabled = false,
}: {
  schoolClass: SchoolClass;
  onEdited: () => void;
  onConfirmed: () => void;
  disabled?: boolean;
}) {
  const data = useAppData();
  const t = useText();
  const writer = useCalendarSave();
  const [halves] = useState<readonly [ClassGroup, ClassGroup]>(() => {
    const old = schoolClass.groups.filter((one) => one.kind === 'half');
    return [
      old[0] ?? { id: data.newId(), kind: 'half', name: t('calendarView.groups.first') },
      old[1] ?? { id: data.newId(), kind: 'half', name: t('calendarView.groups.second') },
    ];
  });
  const pupils = [...data.state.pupils.values()].filter((one) => one.classId === schoolClass.id);
  const [assignments, setAssignments] = useState(
    () =>
      new Map(
        pupils.map((pupil, index) => {
          const known = halves.filter((one) => pupil.groups.includes(one.id));
          return [pupil.id, known.length === 1 ? known[0].id : halves[index < Math.ceil(pupils.length / 2) ? 0 : 1].id];
        }),
      ),
  );
  const chosen = useRef(assignments);
  const [invalid, setInvalid] = useState(false);
  const save = async () => {
    if (disabled || writer.isBusy()) return;
    try {
      const events = assignRotationGroups(coreContext(data), schoolClass.id, halves, chosen.current);
      setInvalid(false);
      if (await writer.save(events, data.state)) onConfirmed();
    } catch {
      setInvalid(true);
    }
  };
  return (
    <View style={styles.card}>
      <Text accessibilityRole="header" style={styles.title}>
        {t('calendarView.groups.split')}
      </Text>
      <Text style={styles.body}>{t('calendarView.groups.splitNotice')}</Text>
      {pupils.map((pupil) => (
        <ChipGroup
          key={pupil.id}
          testID={`rotation-pupil-${pupil.id}`}
          label={pupil.name}
          selected={assignments.get(pupil.id) ?? ''}
          choices={halves.map((one) => ({ value: one.id, label: one.name }))}
          onSelect={(groupId) => {
            if (disabled || writer.isBusy()) return;
            const next = new Map(chosen.current).set(pupil.id, groupId);
            chosen.current = next;
            setAssignments(next);
            onEdited();
          }}
        />
      ))}
      {invalid && <Notice icon={controlIcon('info')} message={t('calendarView.groups.invalid')} />}
      <SaveProblem testID="rotation-split-failed" problem={writer.problem} />
      <Button
        testID="rotation-confirm-split"
        label={t('calendarView.groups.confirmSplit')}
        disabled={disabled || writer.busy}
        onPress={save}
      />
    </View>
  );
}
