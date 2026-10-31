// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Rejoining on a new phone (#566, R-5.8-03, R-5.8-12, R-6.5-04, answer 588), as
// Rejoin draws it: the phone was lost but the class is not, since the school's
// copy stays, and the school gave a new code for one scan, a new issue of the
// teacher's code (school-join.ts) that the phone joins as on the first day.
// Right under the code's card, the school removes the lost phone from its key,
// so it receives nothing new and what it holds stays locked and encrypted; and
// at the page's foot, no password and no reset through the director: the code
// binds this phone's key to the official assignment.

import { useLocale } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import { Icon } from '../design/Icon';
import { colors, spacing, typography } from '../design/tokens';
import { useDeviceText } from '../text/device-text';

/** What a new phone means for the class, opening the page. */
export function RejoinLead() {
  const t = useDeviceText();
  const { direction } = useLocale();
  return (
    <Text testID="school-rejoin" style={[styles.body, { writingDirection: direction, textAlign: 'start' }]}>
      {t('demo.school.rejoin.lead')}
    </Text>
  );
}

/** The lost phone's removal, right under the code's card. */
export function RejoinRemoved() {
  const t = useDeviceText();
  const { direction } = useLocale();
  return (
    <View style={styles.removed}>
      <Icon name="info" size={20} color={colors.ink2} />
      <Text style={[styles.small, styles.grow, { writingDirection: direction, textAlign: 'start' }]}>
        {t('demo.school.rejoin.removed')}
      </Text>
    </View>
  );
}

/** How the code binds the phone, at the page's foot. */
export function RejoinBinds() {
  const t = useDeviceText();
  const { direction } = useLocale();
  return (
    <Text style={[styles.small, { writingDirection: direction, textAlign: 'center' }]}>
      {t('demo.school.rejoin.binds')}
    </Text>
  );
}

const styles = StyleSheet.create({
  body: { ...typography.body, color: colors.ink },
  small: { ...typography.small, color: colors.ink2 },
  removed: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing['space-8'] },
  grow: { flex: 1, minWidth: 0 },
});
