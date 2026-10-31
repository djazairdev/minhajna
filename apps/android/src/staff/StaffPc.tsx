// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A staffroom PC in a national demo world (#572, answer 602), under the demo
// band: it says what a staffroom PC is, that the records stay in the session's
// memory alone and are erased when it is closed or locked, and that no sign-in
// is recorded; then the sign-in with the phone (StaffSignIn.tsx), or, once
// signed in, the teacher's session (StaffSession.tsx). The session is this
// component's state alone, never the browser's storage: locking or ending it,
// or leaving it unused, erases it and shows a new code, saying why; closing
// goes back to the world's home. Under them: the browsers the web app is made
// for.

import type { CountryProfile, Day, DemoSchool, PcSession } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { DemoBand } from '../demo/DemoBand';
import type { OpenWorld } from '../demo/world-mode';
import type { Send, WorldKit } from '../demo/world-session';
import { colors, spacing, typography } from '../design/tokens';
import { useDeviceText } from '../text/device-text';
import { StaffSession } from './StaffSession';
import { StaffSignIn } from './StaffSignIn';

export type StaffPcProps = {
  readonly world: Pick<OpenWorld, 'world' | 'book' | 'date'>;
  readonly school: DemoSchool;
  readonly profile: Pick<CountryProfile, 'subjects'>;
  /** The world's date, written out as the band writes it. */
  readonly date: string;
  readonly dayText: (day: Day) => string;
  readonly kit: WorldKit;
  readonly send?: Send;
  readonly onClose: () => void;
};

/** A staffroom PC: the sign-in, then the session in memory. */
export function StaffPc({ world, school, profile, date, dayText, kit, send, onClose }: StaffPcProps) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const [session, setSession] = useState<PcSession | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  const erase = useCallback(
    (how: 'locked' | 'idle' | 'ended') => {
      setSession(null);
      setNote(t(`demo.staff.erased.${how}`));
      setRound((one) => one + 1);
    },
    [t],
  );
  return (
    <View testID="staff-pc" style={[styles.screen, { direction }]}>
      <DemoBand date={date} />
      <ScrollView contentContainerStyle={styles.body}>
        <Text accessibilityRole="header" style={[styles.title, align]}>
          {t('demo.staff.title')}
        </Text>
        <Text style={[styles.small, align]}>{t('demo.staff.lead')}</Text>
        {session === null ? (
          <StaffSignIn key={round} world={world} kit={kit} send={send} note={note} onSession={setSession} />
        ) : (
          <StaffSession
            session={session}
            school={school}
            profile={profile}
            kit={kit}
            send={send}
            dayText={dayText}
            onErase={erase}
          />
        )}
        <Text style={[styles.small, align]}>{t('demo.staff.browsers')}</Text>
        <Button testID="staff-close" variant="plain" label={t('demo.staff.close')} onPress={onClose} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  body: { padding: spacing['space-16'], gap: spacing['space-12'] },
  title: { ...typography['bar-title'], color: colors.ink },
  small: { ...typography.small, color: colors.ink2 },
});
