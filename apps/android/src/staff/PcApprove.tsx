// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Web-signin-phone in a national demo world (#572, answer 602): the teacher's
// phone scans the code a staffroom PC shows, then asks, as the design draws it,
// whether to open the teacher's records on that PC, with the school, that it is
// one of the school's PCs, the system, what opens there and that the private
// notes never do, that nothing is recorded, and to refuse a PC that is not in
// front of the teacher now. The session is sealed to the PC as it asks, so
// approving again puts the same answer, and approving shows the check the PC
// shows too, to compare before the PC opens anything. A code that is not a
// PC's, a phone that joined no school, a refused camera and any other problem
// are said in the world's words; Android's back button goes back to the world's
// home, except while an approval is being put, so its check is shown.

import { readPcQr, type DemoSchool, type PcSession, type SealedAnswer } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';
import { BackHandler, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { DemoBand } from '../demo/DemoBand';
import type { OpenWorld } from '../demo/world-mode';
import type { Send, WorldKit } from '../demo/world-session';
import { colors, radius, spacing, typography } from '../design/tokens';
import { PUBLIC_KEY_BYTES } from '../director/school-desk';
import { spelled } from '../director/keys-map';
import { errorCode } from '../lock/lock-rules';
import scanner from '../native/NativeMinhajnaCalendarInput';
import { problemOf } from '../school/school-join-session';
import { useDeviceText } from '../text/device-text';
import { isolate } from '../week/grid-labels';
import { phoneSession, putAnswer, sealAnswer } from './staff-session';

type Phase =
  | { readonly kind: 'scan' }
  | { readonly kind: 'ask'; readonly sealed: SealedAnswer; readonly session: PcSession }
  | { readonly kind: 'done'; readonly check: string };

export type PcApproveProps = {
  readonly world: Pick<OpenWorld, 'world' | 'book' | 'date'>;
  readonly school: DemoSchool;
  /** The world's date, written out as the band writes it. */
  readonly date: string;
  readonly kit: WorldKit;
  readonly send?: Send;
  readonly onClose: () => void;
};

/** The phone's side of a staffroom PC's sign-in. */
export function PcApprove({ world, school, date, kit, send, onClose }: PcApproveProps) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const [phase, setPhase] = useState<Phase>({ kind: 'scan' });
  const [said, setSaid] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const acting = useRef(false);
  const open = useRef(true);
  useEffect(() => {
    open.current = true;
    return () => {
      open.current = false;
      scanner.cancel();
    };
  }, []);
  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (acting.current) return true;
      scanner.cancel();
      onClose();
      return true;
    });
    return () => handler.remove();
  }, [onClose]);
  const say = (error: unknown) => open.current && setSaid(t(problemOf(error) as 'demo.problem.other'));

  const act = (step: () => Promise<void>) => {
    if (acting.current) return;
    acting.current = true;
    setBusy(true);
    setSaid(null);
    void step()
      .catch(say)
      .finally(() => {
        acting.current = false;
        if (open.current) setBusy(false);
      });
  };
  const scan = () =>
    act(async () => {
      const rtl = direction === 'rtl';
      const text = await scanner
        .scanQr(t('demo.staff.phone.scan'), t('demo.staff.phone.hint'), t('demo.staff.phone.cancel'), rtl)
        .catch((error: unknown) => {
          const camera = errorCode(error) === 'E_CALENDAR_CAMERA';
          if (open.current) setSaid(t(camera ? 'demo.school.problem.camera' : 'demo.school.problem.scan'));
          return null;
        });
      if (text === null || !open.current) return;
      const request = readPcQr(text.trim(), PUBLIC_KEY_BYTES);
      if (request === null) return setSaid(t('demo.staff.phone.notCode'));
      const session = await phoneSession(world, school, kit);
      const sealed = await sealAnswer(request, session, kit);
      if (open.current) setPhase({ kind: 'ask', sealed, session });
    });
  const approve = (sealed: SealedAnswer) =>
    act(async () => {
      const check = await putAnswer(world, sealed, kit, send);
      if (open.current) setPhase({ kind: 'done', check });
    });

  const row = (label: string, value: string) => (
    <View key={label} style={styles.row}>
      <Text style={[styles.label, align]}>{label}</Text>
      <Text style={[styles.value, align]}>{value}</Text>
    </View>
  );
  return (
    <View testID="pc-approve" style={[styles.screen, { direction }]}>
      <DemoBand date={date} />
      <ScrollView contentContainerStyle={styles.body}>
        <Text accessibilityRole="header" style={[styles.title, align]}>
          {t('demo.staff.phone.title')}
        </Text>
        <Text style={[styles.small, align]}>{t('demo.staff.phone.lead')}</Text>
        {phase.kind === 'scan' && (
          <View style={styles.card}>
            <Text style={[styles.small, align]}>{t('demo.staff.phone.camera')}</Text>
            <Text style={[styles.small, align]}>{t('demo.staff.phone.memory')}</Text>
            <Button testID="pc-scan" label={t('demo.staff.phone.scanButton')} disabled={busy} onPress={scan} />
          </View>
        )}
        {phase.kind === 'ask' && (
          <View testID="pc-ask" accessibilityLiveRegion="polite" style={styles.card}>
            <Text accessibilityRole="header" style={[styles.head, align]}>
              {t('demo.staff.phone.ask')}
            </Text>
            <Text style={[styles.small, align]}>{t('demo.staff.phone.asked')}</Text>
            {row(t('demo.staff.phone.school'), isolate(phase.session.schoolName))}
            {row(t('demo.staff.phone.computer'), t('demo.staff.phone.pcValue'))}
            {row(t('demo.staff.phone.opens'), t('demo.staff.phone.opensValue', { number: phase.session.joins.length }))}
            <Text style={[styles.small, align]}>{t('demo.staff.phone.nothingKept')}</Text>
            <Text style={[styles.small, align]}>{t('demo.staff.phone.private')}</Text>
            <Text style={[styles.warn, align]}>{t('demo.staff.phone.present')}</Text>
            <Button
              testID="pc-approve-yes"
              label={t('demo.staff.phone.approve')}
              disabled={busy}
              onPress={() => approve(phase.sealed)}
            />
            <Button
              testID="pc-refuse"
              variant="line"
              label={t('demo.staff.phone.refuse')}
              disabled={busy}
              onPress={() => setPhase({ kind: 'scan' })}
            />
          </View>
        )}
        {phase.kind === 'done' && (
          <View testID="pc-done" accessibilityLiveRegion="polite" style={styles.card}>
            <Text
              testID="pc-check"
              accessibilityRole="text"
              accessibilityLabel={t('demo.staff.phone.check', { check: spelled(phase.check) })}
              style={[styles.head, align]}
            >
              {t('demo.staff.phone.check', { check: isolate(phase.check) })}
            </Text>
          </View>
        )}
        <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={[styles.problem, align]}>
          {said ?? ''}
        </Text>
        <Button testID="pc-close" variant="plain" label={t('demo.staff.phone.close')} onPress={onClose} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  body: { padding: spacing['space-16'], gap: spacing['space-12'] },
  card: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
    padding: spacing['space-16'],
    gap: spacing['space-8'],
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing['space-8'] },
  label: { ...typography.small, color: colors.ink, minWidth: 72 },
  value: { ...typography.small, color: colors.ink2, flexGrow: 1, flexBasis: 160 },
  title: { ...typography['bar-title'], color: colors.ink },
  head: { ...typography.label, color: colors.ink },
  small: { ...typography.small, color: colors.ink2 },
  warn: { ...typography.small, color: colors.ink },
  problem: { ...typography.body, color: colors['error-ink'] },
});
