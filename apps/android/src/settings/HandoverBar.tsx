// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The banner of a device whose working copy is on the other device (#250,
// answers 503 and 513), above the tabs of Today, Classes and Documents: since
// when, that here is for reading and printing only, «استلام النسخة» and
// «استعادة العمل هنا», which asks first and gives the focus back to its
// button. Nothing shows while the copy is here. A refused change has its
// own sheet, over every screen (`HandoverRefused`).

import { useLocale } from '@react-navigation/native';
import { useRef, useState } from 'react';
import { StyleSheet, Text, View, type ViewInstance } from 'react-native';
import { Button } from '../components/Button';
import { colors, radius, spacing, typography } from '../design/tokens';
import { useText } from '../text/i18n';
import { TakeOverSheet, useAwayDay } from './HandoverSheets';

export type HandoverBarProps = {
  /** Opens «استلام النسخة». */
  readonly onReceive: () => void;
};

export function HandoverBar({ onReceive }: HandoverBarProps) {
  const t = useText();
  const { direction } = useLocale();
  const day = useAwayDay();
  const [taking, setTaking] = useState(false);
  const opener = useRef<ViewInstance>(null);
  if (day === null) return null;
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  return (
    <View testID="handover-bar" style={[styles.bar, { direction }]}>
      <Text style={[styles.line, align]}>{t('settings.handover.away', { day })}</Text>
      <View style={styles.actions}>
        <Button testID="handover-receive" variant="line" label={t('settings.handover.receive')} onPress={onReceive} />
        <Button
          ref={opener}
          testID="handover-take"
          variant="plain"
          label={t('settings.handover.takeOver')}
          onPress={() => setTaking(true)}
        />
      </View>
      <TakeOverSheet visible={taking} day={day} onClose={() => setTaking(false)} returnFocusRef={opener} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    gap: spacing['space-8'],
    marginHorizontal: spacing['space-12'],
    marginBottom: spacing['space-8'],
    paddingVertical: spacing['space-8'],
    paddingHorizontal: spacing['space-12'],
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors['notice-edge'],
    borderRadius: radius['radius-control'],
    backgroundColor: colors.notice,
  },
  line: { ...typography.label, color: colors.ink },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing['space-8'] },
});
