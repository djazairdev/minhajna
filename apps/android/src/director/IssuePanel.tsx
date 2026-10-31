// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// D-Issue's panel for the teacher chosen (#570, answer 598): a code waiting
// shows its QR, for one scan, worked out again from the school key, with its
// last valid day, printing on the PC, and cancelling it, which gives the next
// code at once; a security key shows its number and replaces a lost one; a
// teacher with no code, an expired one, or joined, gets a new code or a key
// instead. On a PC whose browser has security keys, a key waiting is set up
// there with the teacher beside it (#572, answer 602): while the key is asked
// the panel says to touch it and type its PIN and keeps its other buttons
// waiting, and once done it says the key is ready, even after the key joined;
// why not is said as the page's problem. Its last line says what joining gives
// back. The QR is one image for a screen reader, named for its teacher; a code
// that cannot be worked out is said as the page's problem.

import { joinedKey, type Day, type IssueRow, type SchoolIssued } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { colors, radius, spacing, typography } from '../design/tokens';
import qr from '../native/NativeMinhajnaCalendarInput';
import { QrCode } from '../settings/QrCode';
import { onPc, useDeviceText } from '../text/device-text';
import { codeText, type IssueDesk } from './issue-session';
import { personName } from './dashboard-text';

export type IssuePanelProps = {
  readonly world: string;
  readonly desk: IssueDesk;
  readonly row: IssueRow;
  readonly subject: string;
  readonly busy: boolean;
  readonly dayText: (day: Day) => string;
  readonly onIssue: (access: 'phone' | 'key') => void;
  /** Prints the code shown, on the PC. */
  readonly onPrint: () => void;
  readonly onProblem: (error: unknown) => void;
  /** Sets the key waiting up with the teacher, on a PC whose browser has security keys; none elsewhere. */
  readonly onSetUpKey?: () => Promise<void>;
};

/** The chosen teacher's code or key, and how to give one. */
export function IssuePanel(props: IssuePanelProps) {
  const { world, desk, row, subject, dayText, onIssue, onPrint, onProblem, onSetUpKey } = props;
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const { status, issue } = row;
  const waiting = status.kind === 'waiting' && issue !== null;
  const shown = waiting && issue.access === 'phone' ? issue : null;
  const key = shown === null ? null : joinedKey(shown.assignment, shown.issue);
  const [code, setCode] = useState<{ readonly key: string; readonly text: string } | null>(null);
  const [made, setMade] = useState<SchoolIssued | null>(null);
  if (shown !== null && (made === null || joinedKey(made.assignment, made.issue) !== key)) setMade(shown);
  useEffect(() => {
    if (made === null) return;
    let open = true;
    const of = joinedKey(made.assignment, made.issue);
    void codeText(world, desk, made).then(
      (text) => open && setCode({ key: of, text }),
      (error: unknown) => open && onProblem(error),
    );
    return () => {
      open = false;
    };
  }, [world, desk, made, onProblem]);
  const [settingUp, setSettingUp] = useState(false);
  const [setUp, setSetUp] = useState<string | null>(null);
  const setting = useRef(false);
  const busy = props.busy || settingUp;
  const setUpKey = (of: string) => {
    if (onSetUpKey === undefined || setting.current) return;
    setting.current = true;
    setSettingUp(true);
    void onSetUpKey()
      .then(() => setSetUp(of), onProblem)
      .finally(() => {
        setting.current = false;
        setSettingUp(false);
      });
  };
  const text = key !== null && code?.key === key ? code.text : null;
  const rows = useMemo(() => (text === null ? null : qr.qrRows(text)), [text]);
  const name = personName(row.teacher);
  return (
    <View testID="issue-panel" style={styles.panel}>
      <Text accessibilityRole="header" style={[styles.head, align]}>
        {name}
      </Text>
      <Text style={[styles.small, align]}>{subject}</Text>
      {shown !== null && status.kind === 'waiting' && status.until !== null ? (
        <>
          {rows !== null && (
            <QrCode testID="issue-qr" rows={rows} module={4} label={t('demo.issue.panel.qr', { name })} />
          )}
          <Text style={[styles.head, align]}>{t('demo.issue.panel.once')}</Text>
          <Text style={[styles.small, align]}>{t('demo.issue.panel.until', { until: dayText(status.until) })}</Text>
          {onPc() && text !== null && (
            <Button testID="issue-print-code" label={t('demo.issue.panel.print')} disabled={busy} onPress={onPrint} />
          )}
          <Button
            testID="issue-cancel"
            variant="line"
            label={t('demo.issue.panel.cancel')}
            disabled={busy}
            onPress={() => onIssue('phone')}
          />
        </>
      ) : waiting && row.keyNumber !== null ? (
        <>
          <Text style={[styles.head, align]}>{t('demo.issue.panel.key', { number: row.keyNumber })}</Text>
          <Text style={[styles.small, align]}>{t('demo.issue.panel.keyNote')}</Text>
          {settingUp && (
            <Text testID="issue-key-asking" accessibilityLiveRegion="polite" style={[styles.small, align]}>
              {t('demo.issue.panel.keyAsking', { number: row.keyNumber })}
            </Text>
          )}
          {onSetUpKey !== undefined && setUp !== joinedKey(issue.assignment, issue.issue) && (
            <Button
              testID="issue-key-setup"
              label={t('demo.issue.panel.setUpKey', { number: row.keyNumber })}
              disabled={busy}
              onPress={() => setUpKey(joinedKey(issue.assignment, issue.issue))}
            />
          )}
          <Button
            testID="issue-replace-key"
            variant="line"
            label={t('demo.issue.panel.replaceKey')}
            disabled={busy}
            onPress={() => onIssue('key')}
          />
        </>
      ) : (
        <>
          <Button
            testID="issue-new-code"
            label={t('demo.issue.panel.newCode')}
            disabled={busy}
            onPress={() => onIssue('phone')}
          />
          <Button
            testID="issue-key-instead"
            variant="line"
            label={t('demo.issue.panel.keyInstead')}
            disabled={busy}
            onPress={() => onIssue('key')}
          />
        </>
      )}
      {issue !== null && issue.keyNumber !== null && setUp === joinedKey(issue.assignment, issue.issue) && (
        <Text testID="issue-key-ready" accessibilityLiveRegion="polite" style={[styles.small, align]}>
          {t('demo.issue.panel.keyReady', { number: issue.keyNumber })}
        </Text>
      )}
      <Text style={[styles.small, align]}>{t('demo.issue.panel.restores')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
    padding: spacing['space-16'],
    gap: spacing['space-8'],
  },
  head: { ...typography.label, color: colors.ink },
  small: { ...typography.small, color: colors.ink2 },
});
