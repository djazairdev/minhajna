// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The layers of a class's plan (#226, Plan-layers, R-4.2-15, R-4.2-16),
// from the top down: the class's own changes, the school layer, the
// district layer, then the pack. At each level the class has one layer on
// at most, switched on or off here, class by class (answers 338 and 339);
// switching another on replaces it. Taking a layer in is the import's job,
// and switches nothing on; a class with changes can share them as a school
// layer (answer 342). No layer is ever called official.

import { changesFor, courseDecisions, switchLayer, type LayerLevel } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useMemo } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { RowLink } from '../components/RowLink';
import { SectionHeader } from '../components/SectionHeader';
import { controlIcon } from '../design/Icon';
import { spacing } from '../design/tokens';
import { ParallelClasses, changeCount } from '../classes/PlanHeader';
import { packTiming } from './pack-labels';
import { settingsStyles as styles } from '../settings/styles';
import { coreContext } from '../storage/core-context';
import { useAppData } from '../storage/AppData';
import { useText } from '../text/i18n';
import { LayerCard } from './LayerCard';
import { layerModels } from './layer-rules';
import { packOfPin } from './plan-rules';

export type PlanLayersProps = {
  readonly courseId: string;
  readonly onCourse?: (courseId: string) => void;
  readonly onChanges: () => void;
  readonly onDetails: () => void;
  readonly onImport: () => void;
  readonly onExport: () => void;
};

export function PlanLayers({ courseId, onCourse, onChanges, onDetails, onImport, onExport }: PlanLayersProps) {
  const t = useText();
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const { state, profile, year, calendar, calendarRelease, packs, record } = useAppData();
  const context = useMemo(
    () => coreContext({ profile, year, calendar, calendarRelease, packs, state }),
    [profile, year, calendar, calendarRelease, packs, state],
  );
  const pin = state.courses.get(courseId)?.pack ?? null;
  const className = state.classes.get(state.courses.get(courseId)?.classId ?? '')?.name ?? '';
  const base = packOfPin(packs, pin);
  const models = useMemo(() => layerModels(t, context, courseId, base), [t, context, courseId, base]);
  const toggle = (level: LayerLevel, key: string) => (on: boolean) => {
    try {
      record(switchLayer(context.state, courseId, level, on ? key : null));
    } catch {
      Alert.alert(t('planLayers.title'), t('planLayers.refused'));
    }
  };
  const level = (step: number, at: LayerLevel) => (
    <View style={styles.group}>
      <SectionHeader
        testID={`layers-${at}`}
        label={t('planLayers.step', { step, name: t(`planLayers.level.${at}`) })}
      />
      {models[at].length === 0 ? (
        <Text style={[styles.sub, align]}>{t(`planLayers.empty.${at}`)}</Text>
      ) : (
        models[at].map((model) => (
          <LayerCard key={model.key} model={model} toggle={{ className, onChange: toggle(at, model.key) }} />
        ))
      )}
    </View>
  );
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
      {onCourse !== undefined && <ParallelClasses context={context} courseId={courseId} onCourse={onCourse} />}
      <Text style={[styles.body, align]}>{t('planLayers.intro')}</Text>
      <View style={styles.group}>
        <SectionHeader label={t('planLayers.step', { step: 4, name: t('planLayers.mine') })} />
        <RowLink
          testID="layers-changes"
          icon={controlIcon('tune')}
          title={t('classPlan.changes')}
          description={changeCount(t, context, courseId)}
          onPress={onChanges}
        />
        {changesFor(courseDecisions(context, courseId), courseId).length > 0 && (
          <Button testID="layers-export" variant="line" label={t('planLayers.export.action')} onPress={onExport} />
        )}
      </View>
      {level(3, 'school')}
      {level(2, 'district')}
      {base !== undefined && (
        <View style={styles.group}>
          <SectionHeader label={t('planLayers.step', { step: 1, name: t('planLayers.pack') })} />
          <View testID="layers-pack" style={[styles.card, { gap: spacing['space-8'] }]}>
            <View style={{ flexDirection: 'row', direction }}>
              <Badge label={t(`plan.status.${base.status}`)} />
            </View>
            <Text accessibilityRole="header" style={[styles.title, align]}>
              {t('classPlan.packTitle', { release: base.release })}
            </Text>
            <Text style={[styles.sub, align]}>{packTiming(t, base)}</Text>
            <RowLink
              testID="layers-details"
              icon={controlIcon('info')}
              title={t('classPlan.details')}
              onPress={onDetails}
            />
          </View>
        </View>
      )}
      <Text style={[styles.sub, align]}>{t('planLayers.foot')}</Text>
      <Button testID="layers-import" variant="line" label={t('planLayers.import')} onPress={onImport} />
    </ScrollView>
  );
}
