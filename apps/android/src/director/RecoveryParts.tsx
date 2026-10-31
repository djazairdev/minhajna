// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The school key's two recovery parts, just made (#571, answers 556 to 558 and
// 599): each in its numbered groups, the screen guarded as for a PIN pad while
// they show, and each printed on its own sheet in its own print job, so no
// single file ever holds both. Each sheet names the school, its space, the day
// it was made and the keyring's fingerprint, to tell it from the sheets of
// another school or of an older recovery. Since the print screen answers
// before anything is printed, and also when it is cancelled, the parts stay
// until the director says both sheets are on paper; a printing that fails
// keeps them too and says so.

import { useLocale } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { printDocument } from '../documents/print-html';
import { colors, spacing, typography } from '../design/tokens';
import { guardKey } from '../lock/lock-settings';
import pdf from '../native/NativeMinhajnaPdf';
import { problemOf } from '../school/school-join-session';
import { KeyGroups } from '../settings/KeyGroups';
import { RECOVERY_CSS, recoveryPage } from '../settings/recovery-html';
import { currentLanguage } from '../text/i18n';
import { useDeviceText } from '../text/device-text';
import type { MadeRecovery } from './keys-session';

export const SIDES = ['school', 'directorate'] as const;
type Side = (typeof SIDES)[number];
const PRINT = { school: 'demo.keys.recovery.printSchool', directorate: 'demo.keys.recovery.printDirectorate' } as const;
const AGAIN = {
  school: 'demo.keys.recovery.printSchoolAgain',
  directorate: 'demo.keys.recovery.printDirectorateAgain',
} as const;

export type RecoveryPartsProps = {
  readonly recovery: MadeRecovery;
  /** The line naming the school, its space, the day and the fingerprint. */
  readonly sheet: string;
  /** Forgets the parts, once the director says both sheets are printed. */
  readonly onForget: () => void;
};

/** The two parts, a print button for each sheet, and the question that forgets them. */
export function RecoveryParts({ recovery, sheet, onForget }: RecoveryPartsProps) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const [printed, setPrinted] = useState<readonly Side[]>([]);
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<string | null>(null);
  const going = useRef(false);
  useEffect(() => guardKey(), []);

  const print = (side: Side) => {
    if (going.current) return;
    going.current = true;
    setBusy(true);
    setSaid(null);
    const title = t(`demo.keys.recovery.${side}Title`);
    const page = recoveryPage(
      {
        title,
        intro: t(`demo.keys.recovery.${side}Intro`),
        computer: t('demo.keys.recovery.line'),
        lines: [sheet, t('demo.keys.recovery.both'), t('demo.keys.recovery.noCopy')],
      },
      recovery.parts[side],
    );
    const html = printDocument({
      lang: currentLanguage(),
      dir: direction,
      title,
      landscape: false,
      css: RECOVERY_CSS,
      pages: [page],
    });
    void pdf
      .printHtml(html, title, false)
      .then(() => {
        setPrinted((before) => (before.includes(side) ? before : [...before, side]));
        setSaid(t('demo.keys.recovery.sent', { sheet: title }));
      })
      .catch((error: unknown) => setSaid(t(problemOf(error) as 'demo.problem.other')))
      .finally(() => {
        going.current = false;
        setBusy(false);
      });
  };

  return (
    <>
      <Text accessibilityRole="header" style={[styles.head, align]}>
        {t('demo.keys.recovery.title')}
      </Text>
      {SIDES.map((side) => (
        <View key={side} testID={`keys-part-${side}`} style={styles.part}>
          <Text accessibilityRole="header" style={[styles.head, align]}>
            {t(`demo.keys.recovery.${side}Title`)}
          </Text>
          <KeyGroups value={recovery.parts[side]} />
        </View>
      ))}
      <Text style={[styles.small, align]}>{sheet}</Text>
      <Text style={[styles.small, align]}>{t('demo.keys.recovery.once')}</Text>
      <Text style={[styles.small, align]}>{t('demo.keys.recovery.noFile')}</Text>
      {SIDES.map((side) => (
        <Button
          key={side}
          testID={`keys-recovery-print-${side}`}
          label={t(printed.includes(side) ? AGAIN[side] : PRINT[side])}
          variant={printed.includes(side) ? 'line' : 'primary'}
          disabled={busy}
          onPress={() => print(side)}
        />
      ))}
      {printed.length === SIDES.length && (
        <>
          <Text style={[styles.head, align]}>{t('demo.keys.recovery.askPrinted')}</Text>
          <Button
            testID="keys-recovery-forget"
            label={t('demo.keys.recovery.forget')}
            disabled={busy}
            onPress={onForget}
          />
        </>
      )}
      <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={[styles.small, align]}>
        {said ?? ''}
      </Text>
    </>
  );
}

const styles = StyleSheet.create({
  part: { gap: spacing['space-4'] },
  head: { ...typography.label, color: colors.ink },
  small: { ...typography.small, color: colors.ink2 },
});
