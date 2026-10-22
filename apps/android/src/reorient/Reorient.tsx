// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «إعادة تشكيل الأقسام» (#231, Reorient, R-4.7-39, answer 391): from a lycée
// class's settings, the teacher reshapes its level's classes after
// reorientation, on the day the new class lists come, from that day: the old
// classes, archived from it; the new classes, each with the old class whose
// history it takes and a preview of where its plan and lists stand; where each
// pupil goes; and what stays with the old classes. Nothing changes before
// «تطبيق إعادة التشكيل» is confirmed, naming the classes archived, the day and
// the pupils who leave them; it is refused, with the reason, while the
// reshaping does not hold.

import {
  addDays,
  reorient,
  reorientRefusal,
  type Day,
  type Reorientation,
  type ReorientRefusal,
  type SchoolClass,
} from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { ChipGroup } from '../components/Chip';
import { SectionHeader } from '../components/SectionHeader';
import { controlIcon } from '../design/Icon';
import { colors, spacing, typography } from '../design/tokens';
import { frontDate } from '../documents/front-tables';
import { coreContext } from '../storage/core-context';
import { useAppData } from '../storage/AppData';
import { useText } from '../text/i18n';
import { isolate } from '../week/grid-labels';
import { ReorientClasses } from './ReorientClasses';
import { ReorientPupils } from './ReorientPupils';
import { pupilMoves, previews, reshapedWith, startPlan, toggleOld } from './reorient-rules';

export function Reorient({ classId, onDone }: { classId: string; onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  const t = useText();
  const { state, profile, year, calendar, calendarRelease, packs, today, recordAll, newId } = useAppData();
  const context = useMemo(
    () => coreContext({ profile, year, calendar, calendarRelease, packs, state }),
    [profile, year, calendar, calendarRelease, packs, state],
  );
  const [plan, setPlan] = useState<Reorientation>(() => startPlan(context, classId, today()));
  const [done, setDone] = useState<Day | null>(null);
  const candidates = useMemo(() => reshapedWith(context, classId), [context, classId]);
  const shown = useMemo(() => previews(context, plan), [context, plan]);
  const moves = useMemo(() => pupilMoves(context, plan), [context, plan]);
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const date = (day: Day) => isolate(frontDate(day));
  const padding = {
    paddingLeft: insets.left + spacing['space-16'],
    paddingRight: insets.right + spacing['space-16'],
    paddingBottom: insets.bottom + spacing['space-16'],
  };

  if (done !== null) {
    return (
      <View style={[styles.screen, styles.content, padding, { direction }]}>
        <Text testID="reorient-done" style={[styles.body, align]}>
          {t('reorient.done', { day: date(done) })}
        </Text>
        <Button testID="reorient-back" label={t('reorient.back')} onPress={onDone} />
      </View>
    );
  }
  if (candidates.length === 0) return null;
  const refusal: ReorientRefusal | 'none' | null =
    plan.olds.length === 0 ? 'none' : reorientRefusal(context, plan, today());
  const before = date(addDays(plan.day, -1));
  const ask = t(plan.olds.length === 1 ? 'reorient.askOne' : 'reorient.ask', {
    olds: plan.olds.map((id) => isolate(state.classes.get(id)?.name ?? '')).join(t('reorient.andNames')),
    day: date(plan.day),
    pupils: t('setup.pupils', { count: moves.reduce((sum, one) => sum + one.pupils.length, 0) }),
  });
  const toggle = (ids: string[]) => {
    const changed = candidates.find((one) => ids.includes(one.id) !== plan.olds.includes(one.id));
    if (changed !== undefined) setPlan(toggleOld(plan, changed));
  };
  return (
    <View style={[styles.screen, { direction }]}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, padding]}>
        <Text style={[styles.note, align]}>{t('reorient.note')}</Text>
        <Text testID="reorient-day" style={[styles.body, align]}>
          {t('reorient.day', { day: date(plan.day) })}
        </Text>
        <ChipGroup
          testID="reorient-olds"
          label={t('reorient.olds')}
          multiple
          selected={plan.olds}
          onSelect={toggle}
          choices={candidates.map((one: SchoolClass) => ({ value: one.id, label: one.name }))}
        />
        <Text style={[styles.note, align]}>{t('reorient.oldsLine', { day: date(plan.day) })}</Text>
        <ReorientClasses context={context} plan={plan} previews={shown} onPlan={setPlan} />
        <ReorientPupils plan={plan} moves={moves} onPlan={setPlan} />
        <SectionHeader testID="reorient-stays" label={t('reorient.stays')} />
        {[
          t('reorient.staysBook', { day: before }),
          t('reorient.staysRoll', { day: before }),
          t('reorient.staysHomework', { day: date(plan.day) }),
          t('reorient.staysMarks'),
          t('reorient.staysArchive'),
        ].map((line) => (
          <Text key={line} style={[styles.body, align]}>
            {line}
          </Text>
        ))}
        {refusal !== null && (
          <Text testID="reorient-refused" style={[styles.refused, align]}>
            {t(`reorient.refused.${refusal}`)}
          </Text>
        )}
        <Button
          testID="reorient-apply"
          label={t('reorient.apply')}
          icon={controlIcon('check')}
          disabled={refusal !== null}
          onPress={() =>
            Alert.alert(t('reorient.apply'), ask, [
              { text: t('reorient.cancel'), style: 'cancel' },
              {
                text: t('reorient.confirm'),
                onPress: () => {
                  if (reorientRefusal(context, plan, today()) !== null) return;
                  recordAll(reorient(context, plan, today(), newId));
                  setDone(plan.day);
                },
              },
            ])
          }
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { gap: spacing['space-16'], paddingTop: spacing['space-16'] },
  note: { ...typography.caption, color: colors.ink2 },
  body: { ...typography.body, color: colors.ink },
  refused: { ...typography.body, color: colors.danger },
});
