// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What a device shows when its world's date has moved (#630, answer 724): the
// page in hand stays as it is, with its date, and under it a line names the new
// date, says that going there closes the page and loses what is not saved on
// it, and has a button named for the date, with that warning as its hint. While
// the keyboard is up, as when typing notes, the warning goes and the bar keeps
// to its line and button, so the page keeps its room. The line and warning are
// announced once for each new date, on a PC through a hidden live region that
// holds them a few seconds, so browsing the page does not read them twice.
// Pressing the button moves the device to the date, closing the page, so no
// page has its date changed while someone works on it.

import { useLocale } from '@react-navigation/native';
import { useContext, useEffect, useEffectEvent, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Keyboard, StyleSheet, Text, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { colors, spacing, typography } from '../design/tokens';
import { onPc, useDeviceText } from '../text/device-text';

/** How long the hidden words stay, in milliseconds. */
const SAID_FOR = 5000;

export type WorldDateFrameProps = {
  /** The later date, as words, or null while the date shown is the latest. */
  readonly movedTo: string | null;
  readonly onTake: () => void;
  readonly children: ReactNode;
};

function useKeyboardUp() {
  const [up, setUp] = useState(false);
  useEffect(() => {
    const shown = Keyboard.addListener('keyboardDidShow', () => setUp(true));
    const hidden = Keyboard.addListener('keyboardDidHide', () => setUp(false));
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);
  return up;
}

/** A page of a world, and under it the offer of the date the world moved to. */
export function WorldDateFrame({ movedTo, onTake, children }: WorldDateFrameProps) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const insets = useContext(SafeAreaInsetsContext);
  const typing = useKeyboardUp();
  const [quiet, setQuiet] = useState<string | null>(null);
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const line = movedTo === null ? null : t('demo.dateMoved.line', { date: movedTo });
  const hint = t('demo.dateMoved.hint');
  const take = t('demo.dateMoved.take');
  const announce = useEffectEvent((words: string) => {
    if (!onPc()) AccessibilityInfo.announceForAccessibility(`${words} ${hint}`);
  });
  useEffect(() => {
    if (line === null) return;
    announce(line);
    const timer = setTimeout(() => setQuiet(line), SAID_FOR);
    return () => clearTimeout(timer);
  }, [line]);
  const room = {
    paddingBottom: spacing['space-12'] + (typing ? 0 : (insets?.bottom ?? 0)),
    paddingLeft: spacing['space-16'] + (insets?.left ?? 0),
    paddingRight: spacing['space-16'] + (insets?.right ?? 0),
  };
  return (
    <View style={styles.frame}>
      <View style={styles.frame}>{children}</View>
      {line !== null && movedTo !== null && (
        <View testID="world-date-moved" style={[styles.bar, room]}>
          <Text style={[styles.line, align]}>{line}</Text>
          {!typing && <Text style={[styles.hint, align]}>{hint}</Text>}
          <Button
            testID="world-date-take"
            variant="line"
            label={take}
            name={`${take} · ${movedTo}`}
            accessibilityHint={hint}
            onPress={onTake}
          />
        </View>
      )}
      {onPc() && (
        <Text testID="world-date-said" accessibilityLiveRegion="polite" style={styles.hidden}>
          {line === null || line === quiet ? '' : `${line} ${hint}`}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1 },
  bar: {
    gap: spacing['space-8'],
    paddingTop: spacing['space-12'],
    backgroundColor: colors.sheet,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  line: { ...typography.body, color: colors.ink },
  hint: { ...typography.small, color: colors.ink2 },
  hidden: { position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0 },
});
