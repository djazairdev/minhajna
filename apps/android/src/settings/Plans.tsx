// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useLocale } from '@react-navigation/native';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { SectionHeader } from '../components/SectionHeader';
import { spacing } from '../design/tokens';
import { groupName, packFacts, packSource } from '../plan/pack-labels';
import { packOfPin, pinOfClass, planGroups } from '../plan/plan-rules';
import { useAppData } from '../storage/AppData';
import { useText } from '../text/i18n';
import { settingsStyles as styles } from './styles';

/** Each school's actual class pins, not a newer available pack presented as the one in use. */
export function Plans({
  schoolId,
  onChoose,
}: {
  schoolId?: string;
  onChoose: (grade: string, subject: string, schoolId: string) => void;
}) {
  const t = useText();
  const { direction } = useLocale();
  const insets = useSafeAreaInsets();
  const { state, profile, packs, year } = useAppData();
  const schools = [...state.schools.values()].filter((school) => schoolId === undefined || school.id === schoolId);
  const groups = planGroups(state);
  const align = { writingDirection: direction, textAlign: 'start' } as const;
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
      <Text style={[styles.sub, align]}>{t('settings.pinned')}</Text>
      {schools.length === 0 && <Text style={[styles.body, align]}>{t('settings.noSchools')}</Text>}
      {schools.map((school) => {
        const offered = groups.flatMap((group) =>
          group.classes.filter((one) => one.schoolId === school.id).map((schoolClass) => ({ group, schoolClass })),
        );
        return (
          <View key={school.id} testID={`settings-plans-${school.id}`} style={styles.group}>
            <SectionHeader label={school.name} />
            {offered.length === 0 && <Text style={[styles.body, align]}>{t('settings.noClasses')}</Text>}
            {offered.map(({ group, schoolClass }) => {
              const pin = pinOfClass(state, schoolClass.id, group.subject, year.id, group.grade);
              const pack = packOfPin(packs, pin);
              return (
                <View
                  key={`${group.key}/${schoolClass.id}`}
                  testID={`settings-pin-${schoolClass.id}-${group.subject}-${group.grade}`}
                  style={styles.card}
                >
                  <Text accessibilityRole="header" style={[styles.title, align]}>
                    {schoolClass.name} · {groupName(t, profile, group)}
                  </Text>
                  {pack !== undefined ? (
                    <>
                      <Badge label={t(`plan.status.${pack.status}`)} />
                      <Text style={[styles.body, align]}>{packFacts(t, pack)}</Text>
                      <Text style={[styles.sub, align]}>{packSource(t, pack)}</Text>
                    </>
                  ) : (
                    <Text style={[styles.body, align]}>
                      {pin === null ? t('plan.noPack') : t('settings.missingPack', { release: pin.release })}
                    </Text>
                  )}
                  <Button
                    testID={`settings-choose-${schoolClass.id}-${group.subject}-${group.grade}`}
                    variant="line"
                    label={t('plan.change')}
                    onPress={() => onChoose(group.grade, group.subject, school.id)}
                  />
                </View>
              );
            })}
          </View>
        );
      })}
    </ScrollView>
  );
}
