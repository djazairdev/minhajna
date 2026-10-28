// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «تقرير عطل، قبل إرساله» over Today (#249, Crash-preview, R-1.5-07, answer
// 483), the reader's home or the welcome (#460): after a crash kept while crash
// reports were on, the next start shows exactly what would be shared, then
// «إرسال», which hands that text to Android's share sheet, or «عدم الإرسال».
// Either way the report is deleted from the phone. Closing the sheet chooses
// nothing: it comes back on the next start, not after an unlock, until the
// teacher chooses or turns crash reports off in Help. A report that does not
// read is deleted. On a PC the text goes through the browser's share menu, or
// is copied when it has none, and the sheet stays open to say so; a report that
// was not copied, or whose menu was closed, is kept, and its preview can be
// copied by hand. While the menu is open, both buttons wait (#250, answers 509
// and 523).

import { useLocale } from '@react-navigation/native';
import { useRef, useState } from 'react';
import { StyleSheet, Text, View, type ViewInstance } from 'react-native';
import { BottomSheet } from '../components/BottomSheet';
import { Button } from '../components/Button';
import { colors, radius, spacing, typography } from '../design/tokens';
import native from '../native/NativeMinhajnaCrash';
import { onPc, useDeviceText } from '../text/device-text';
import { crashLines, offeredCrash } from './crash-report';
import { sendReport, type Sent } from './send-report';

export function CrashSheet() {
  const t = useDeviceText();
  const { direction } = useLocale();
  const opener = useRef<ViewInstance>(null);
  const [report] = useState(offeredCrash);
  const [open, setOpen] = useState(report !== null);
  const [handed, setHanded] = useState<Sent | null>(null);
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const lines = report === null ? [] : crashLines(t, report);
  const choose = (send: boolean) => {
    if (pending.current) return;
    if (!send || !onPc()) {
      native.drop();
      setOpen(false);
      if (send) void sendReport(lines.join('\n'), t('crash.title'));
      return;
    }
    pending.current = true;
    setBusy(true);
    setHanded(null);
    void sendReport(lines.join('\n'), t('crash.title')).then((how) => {
      pending.current = false;
      setBusy(false);
      if (how === 'cancelled') return;
      if (how !== 'failed') native.drop();
      if (how === 'shared') setOpen(false);
      setHanded(how);
    });
  };
  return (
    <View ref={opener} collapsable={false}>
      <BottomSheet
        testID="crash-sheet"
        visible={open}
        title={t('crash.title')}
        context={t('crash.intro')}
        reassurance={t('crash.footer')}
        returnFocusRef={opener}
        onClose={() => setOpen(false)}
      >
        <View style={styles.group}>
          <View testID="crash-preview" accessible style={styles.card}>
            <Text style={[styles.note, align]}>{t('report.preview')}</Text>
            {lines.map((line, index) => (
              <Text key={index} selectable={onPc()} style={[styles.body, align]}>
                {line}
              </Text>
            ))}
          </View>
          <Text selectable style={[styles.body, align]}>
            {t('report.sendTo')}
          </Text>
          <Text style={[styles.note, align]}>{t('crash.deleted')}</Text>
          {(handed === 'copied' || handed === 'failed') && (
            <Text testID={`crash-${handed}`} accessibilityLiveRegion="polite" style={[styles.body, align]}>
              {t(handed === 'copied' ? 'report.copied' : 'report.copyFailed')}
            </Text>
          )}
          <Button
            testID="crash-send"
            label={t('crash.send')}
            disabled={handed === 'copied' || busy}
            onPress={() => choose(true)}
          />
          <Button
            testID="crash-dont-send"
            variant="line"
            label={t('crash.dontSend')}
            disabled={busy}
            onPress={() => choose(false)}
          />
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing['space-10'] },
  card: {
    gap: spacing['space-4'],
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    padding: spacing['space-14'],
    backgroundColor: colors.sheet,
  },
  body: { ...typography.body, color: colors.ink },
  note: { ...typography.caption, color: colors.ink2 },
});
