// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The school's wilaya on Setup-2-Teaching (#25). The field opens the
// country profile's list over the screen, with a search by name or number;
// choosing one closes it, and Back closes it unchanged. The wilaya picks the
// calendar's zone layer and never leaves the phone (PRD §4.5).

import type { Zone } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { OptionRow } from '../components/OptionRow';
import { TextField } from '../components/TextField';
import { colorRoles, colors, radius, sizes, spacing, typography } from '../design/tokens';
import { useText } from '../text/i18n';
import { localized } from './names';
import { zoneMatches } from './zone-search';

/** A wilaya as the list and the field write it: its number, then its name. */
export function zoneLabel(zone: Zone): string {
  return `${zone.code} · ${localized(zone.name)}`;
}

/** The field, and the list it opens. */
export function ZonePicker({
  zones,
  value,
  onChange,
  testID,
}: {
  zones: readonly Zone[];
  value: string | undefined;
  onChange: (code: string) => void;
  testID?: string;
}) {
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  const t = useText();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const chosen = zones.find((zone) => zone.code === value);
  const shown = zones.filter((zone) => zoneMatches(zone, query));
  const close = () => {
    setOpen(false);
    setQuery('');
  };
  return (
    <View style={[styles.group, { direction }]}>
      <Text style={[styles.label, align]}>{t('setup.zone')}</Text>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={`${t('setup.zone')}: ${chosen ? zoneLabel(chosen) : t('setup.zoneChoose')}`}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.field, pressed && { borderColor: colors.ink }]}
      >
        <Text style={[chosen ? styles.value : styles.placeholder, align]}>
          {chosen ? zoneLabel(chosen) : t('setup.zoneChoose')}
        </Text>
      </Pressable>
      <Text style={[styles.hint, align]}>{t('setup.zoneHint')}</Text>
      <Modal visible={open} animationType="slide" onRequestClose={close} statusBarTranslucent>
        <View
          style={[
            styles.sheet,
            {
              direction,
              paddingTop: insets.top + spacing['space-12'],
              paddingLeft: insets.left + spacing['space-16'],
              paddingRight: insets.right + spacing['space-16'],
            },
          ]}
        >
          <View style={styles.head}>
            <Text accessibilityRole="header" style={[styles.title, align]}>
              {t('setup.zone')}
            </Text>
            <Button testID={`${testID}-close`} variant="plain" label={t('setup.close')} onPress={close} />
          </View>
          <TextField
            testID={`${testID}-search`}
            label={t('setup.zoneSearch')}
            placeholder={t('setup.zoneSearchExample')}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
          />
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + spacing['space-16'] }]}
          >
            {shown.map((zone) => (
              <OptionRow
                key={zone.code}
                testID={`${testID}-${zone.code}`}
                label={zoneLabel(zone)}
                selected={zone.code === value}
                onPress={() => {
                  onChange(zone.code);
                  close();
                }}
              />
            ))}
            {shown.length === 0 && <Text style={[styles.hint, align]}>{t('setup.zoneNone')}</Text>}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { alignSelf: 'stretch', gap: spacing['space-6'] },
  label: { ...typography.label, color: colors.ink2 },
  field: {
    minHeight: sizes.target,
    minWidth: sizes.target,
    justifyContent: 'center',
    paddingHorizontal: spacing['space-14'],
    paddingVertical: spacing['space-10'],
    borderWidth: 1.5,
    borderColor: colorRoles.controlBorder,
    borderRadius: radius['radius-control'],
    backgroundColor: colors.sheet,
  },
  value: { ...typography.body, color: colors.ink },
  placeholder: { ...typography.body, color: colors.ink2 },
  hint: { ...typography.caption, color: colors.ink2 },
  sheet: { flex: 1, gap: spacing['space-12'], backgroundColor: colors.paper },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing['space-8'] },
  title: { ...typography.h2, color: colors.ink, flex: 1 },
  list: { gap: spacing['space-8'] },
});
