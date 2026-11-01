// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Approving a directorate's request on the director's access page (#593,
// answer 621): what the grant opens, each signed week the request resolves to
// with its class and teacher, the director being the school's and seeing its
// teachers, and the classes with none; a request with no signed week says it
// cannot be granted and asks nothing. Otherwise the inspector's key
// fingerprint is asked, as the inspectorate's official message gives it, left
// to right, and the button grants and tells the teachers once one is typed,
// saying it is granting while it is; a second button closes the panel.

import type { Day } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { TextField } from '../components/TextField';
import { colors, radius, spacing, typography } from '../design/tokens';
import { useDeviceText } from '../text/device-text';
import { isolate } from '../week/grid-labels';
import type { AskedGrant } from './grant-session';

export type GrantApproveProps = {
  readonly one: AskedGrant;
  readonly dayText: (day: Day) => string;
  readonly busy: boolean;
  readonly working: boolean;
  readonly onApprove: (fingerprint: string) => void;
  readonly onClose: () => void;
};

/** The panel that approves one request once the inspector's fingerprint is typed. */
export function GrantApprove({ one, dayText, busy, working, onApprove, onClose }: GrantApproveProps) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const [fingerprint, setFingerprint] = useState('');
  const id = one.request.id;
  return (
    <View testID={`grant-approve-${id}`} style={styles.panel}>
      <Text accessibilityRole="header" style={[styles.head, align]}>
        {t('demo.access.opens')}
      </Text>
      {one.weeks.map((week) => (
        <Text key={`${week.recorded.week.course}/${week.recorded.week.week}`} style={[styles.small, align]}>
          {t('demo.access.week', {
            class: isolate(week.class),
            teacher: isolate(week.teacher),
            week: dayText(week.recorded.week.week),
          })}
        </Text>
      ))}
      {one.missing.length > 0 && (
        <Text style={[styles.small, align]}>
          {t('demo.access.missing', { classes: one.missing.map(isolate).join(' · ') })}
        </Text>
      )}
      {one.weeks.length === 0 ? (
        <Text style={[styles.body, align]}>{t('demo.access.noWeeks')}</Text>
      ) : (
        <>
          <TextField
            testID={`grant-print-${id}`}
            label={t('demo.access.fingerprint')}
            placeholder="0000-0000-0000-0000"
            value={fingerprint}
            onChangeText={setFingerprint}
            textDirection="ltr"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={[styles.small, align]}>{t('demo.access.fingerprintHint')}</Text>
          <Button
            testID={`grant-make-${id}`}
            label={t(working ? 'demo.access.approving' : 'demo.access.approve')}
            disabled={busy || fingerprint.trim() === ''}
            onPress={() => onApprove(fingerprint)}
          />
        </>
      )}
      <Button testID={`grant-close-${id}`} variant="plain" label={t('demo.access.close')} onPress={onClose} />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    padding: spacing['space-12'],
    gap: spacing['space-8'],
  },
  head: { ...typography.label, color: colors.ink },
  body: { ...typography.body, color: colors.ink },
  small: { ...typography.small, color: colors.ink2 },
});
