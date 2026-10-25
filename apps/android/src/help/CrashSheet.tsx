// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «تقرير عطل، قبل إرساله» over Today (#249, Crash-preview, R-1.5-07, answer
// 483): after a crash kept while crash reports were on, the next start shows
// exactly what would be shared, then «إرسال», which hands that text to
// Android's share sheet, or «عدم الإرسال». Either way the report is deleted
// from the phone. Closing the sheet chooses nothing: it comes back on the
// next start, not after an unlock, until the teacher chooses or turns crash
// reports off in Help. A report that does not read is deleted.

import { useLocale } from '@react-navigation/native';
import { useRef, useState } from 'react';
import { Share, StyleSheet, Text, View, type ViewInstance } from 'react-native';
import { BottomSheet } from '../components/BottomSheet';
import { Button } from '../components/Button';
import { colors, radius, spacing, typography } from '../design/tokens';
import native from '../native/NativeMinhajnaCrash';
import { useText } from '../text/i18n';
import { crashLines, offeredCrash } from './crash-report';

export function CrashSheet() {
  const t = useText();
  const { direction } = useLocale();
  const opener = useRef<ViewInstance>(null);
  const [report] = useState(offeredCrash);
  const [open, setOpen] = useState(report !== null);
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const lines = report === null ? [] : crashLines(t, report);
  const choose = (send: boolean) => {
    native.drop();
    setOpen(false);
    if (send) Share.share({ message: lines.join('\n'), title: t('crash.title') }).catch(() => undefined);
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
              <Text key={index} style={[styles.body, align]}>
                {line}
              </Text>
            ))}
          </View>
          <Text selectable style={[styles.body, align]}>
            {t('report.sendTo')}
          </Text>
          <Text style={[styles.note, align]}>{t('crash.deleted')}</Text>
          <Button testID="crash-send" label={t('crash.send')} onPress={() => choose(true)} />
          <Button testID="crash-dont-send" variant="line" label={t('crash.dontSend')} onPress={() => choose(false)} />
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
