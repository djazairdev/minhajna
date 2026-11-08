// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Joining my school, and its update from Settings (answer 808): the joining
// code, typed or scanned with the app's QR scan (a phone only), goes to the
// directory; what arrives shows first, and the teacher's approval records it
// all at once, with the code kept in the device layer for the next update.
// An update fetches again with the kept code and shows only what changes.
// The approval counts once, and plans again from the latest records. Classes
// the teacher entered at that school before stay, and the preview says so.

import {
  joinedPrefix,
  joinPlan,
  keepJoiningCode,
  joiningCodes,
  readJoiningCode,
  type State,
  type TeacherDelivery,
} from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { Notice } from '../components/Notice';
import { TextField } from '../components/TextField';
import { controlIcon } from '../design/Icon';
import { colors, spacing, typography } from '../design/tokens';
import scanner from '../native/NativeMinhajnaCalendarInput';
import { useAppData } from '../storage/AppData';
import { onPc, useDeviceText } from '../text/device-text';
import { JoinPreview } from './JoinPreview';
import { joinTarget } from './join-target';
import { useJoin, type JoinLoad } from './useJoin';

const LINES = {
  unknown: 'join.unknown',
  offline: 'join.offline',
  busy: 'setup.directory.busy',
  asleep: 'join.asleep',
  refused: 'join.refused',
} as const;

/** The join, into the school `named` when Settings opened it, or that school's update with its kept code. */
export function Join({ named, onDone }: { named?: string; onDone: () => void }) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const insets = useSafeAreaInsets();
  const { entries } = useAppData();
  const { load, ask } = useJoin();
  const [kept] = useState(() => (named === undefined ? undefined : joiningCodes(entries()).get(named)));
  const [typed, setTyped] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const sides = {
    paddingLeft: insets.left + spacing['space-16'],
    paddingRight: insets.right + spacing['space-16'],
    paddingBottom: insets.bottom + spacing['space-24'],
  };
  useEffect(() => {
    if (kept !== undefined) ask(kept);
  }, [kept, ask]);
  const busy = load.kind === 'loading';
  const send = (text: string) => {
    const code = readJoiningCode(text);
    setProblem(code === null ? t('join.badCode') : null);
    if (code !== null) ask(code);
  };
  const scan = () => {
    setProblem(null);
    scanner
      .scanQr(t('join.scan'), t('join.scanHint'), t('join.cancel'), direction === 'rtl')
      .then((text) => {
        if (text === null) return;
        setTyped(text);
        send(text);
      })
      .catch(() => setProblem(t('join.camera')));
  };
  const change = (text: string) => {
    setTyped(text);
    setProblem(null);
  };
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, sides, { direction }]}
      keyboardShouldPersistTaps="handled"
    >
      {load.kind === 'ready' ? (
        <Ready delivery={load.delivery} code={load.code} named={named} kept={kept} onDone={onDone} />
      ) : (
        <>
          {kept === undefined && (
            <>
              <TextField
                testID="join-code"
                label={t('join.code')}
                value={typed}
                onChangeText={change}
                onSubmitEditing={() => {
                  if (!busy && typed.trim() !== '') send(typed);
                }}
                returnKeyType="go"
                autoCapitalize="characters"
                autoCorrect={false}
                textDirection="ltr"
                {...(problem !== null && { error: problem })}
              />
              {!onPc() && (
                <Button
                  testID="join-scan"
                  variant="line"
                  icon={controlIcon('qr')}
                  label={t('join.scan')}
                  disabled={busy}
                  onPress={scan}
                />
              )}
              <Button
                testID="join-next"
                icon={controlIcon('chevron')}
                iconEnd
                label={t('join.next')}
                disabled={busy || typed.trim() === ''}
                onPress={() => send(typed)}
              />
            </>
          )}
          <LoadLine load={load} onRetry={() => send(kept ?? typed)} align={align} />
        </>
      )}
    </ScrollView>
  );
}

/** What the load says while nothing is ready, with a retry once it failed. */
function LoadLine({ load, onRetry, align }: { load: JoinLoad; onRetry: () => void; align: object }) {
  const t = useDeviceText();
  if (load.kind === 'idle' || load.kind === 'ready') return null;
  const line =
    load.kind === 'loading' ? t(load.waking ? 'setup.directory.waking' : 'join.loading') : t(LINES[load.kind]);
  return (
    <View testID="join-state" style={styles.state}>
      <Text accessibilityLiveRegion="polite" style={[styles.line, align]}>
        {line}
      </Text>
      {load.kind !== 'loading' && (
        <Button
          testID="join-retry"
          variant="line"
          icon={controlIcon('globe')}
          label={t('setup.directory.retry')}
          onPress={onRetry}
        />
      )}
    </View>
  );
}

/** The delivery's plan for the phone's school, and the approval that records it, keeping a new code. */
function Ready(props: {
  delivery: TeacherDelivery;
  code: string;
  named: string | undefined;
  kept: string | undefined;
  onDone: () => void;
}) {
  const { delivery, code, named, kept, onDone } = props;
  const t = useDeviceText();
  const { state, latestState, year, today, packs, newId, recordAll } = useAppData();
  const done = useRef(false);
  const target = useMemo(() => joinTarget(state, delivery, named, newId), [state, delivery, named, newId]);
  const planFor = useCallback(
    (now: State) =>
      target === null
        ? null
        : joinPlan({ state: now, year, today: today(), delivery, school: target.school, packs, newId }),
    [target, year, today, delivery, packs, newId],
  );
  const plan = useMemo(() => planFor(state), [planFor, state]);
  const handMade =
    target !== null &&
    [...state.classes.values()].some(
      (one) =>
        one.schoolId === target.school.id &&
        one.archivedFrom === undefined &&
        !one.id.startsWith(joinedPrefix(target.school.id)),
    );
  if (target === null || plan === null) {
    return (
      <>
        <Notice testID="join-unplaced" icon={controlIcon('info')} message={t('join.noSchool')} />
        <Button
          testID="join-cancel"
          variant="line"
          icon={controlIcon('cross')}
          label={t('join.cancel')}
          onPress={onDone}
        />
      </>
    );
  }
  const approve = () => {
    if (done.current) return;
    done.current = true;
    const events = planFor(latestState())?.events ?? [];
    recordAll([...events, ...(code === kept ? [] : [keepJoiningCode(target.school.id, code)])]);
    onDone();
  };
  return (
    <JoinPreview
      plan={plan}
      school={delivery.school?.name ?? target.school.name}
      target={target}
      handMade={handMade}
      update={kept !== undefined}
      onApprove={approve}
      onCancel={onDone}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { gap: spacing['space-16'], paddingTop: spacing['space-16'] },
  state: { gap: spacing['space-8'] },
  line: { ...typography.body, color: colors.ink },
});
