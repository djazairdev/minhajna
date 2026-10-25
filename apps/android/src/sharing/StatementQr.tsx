// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The statement's QR code (#439, Share-qr, R-3.10-02, R-5.9-18, answer 486):
// the whole signed statement, drawn large on a light ground with the screen
// kept on while it shows, so a reader scans it with no network. The class,
// subject and day above it, «موقّع · يُقرأ دون شبكة», that it carries no pupil
// data and never expires, and «إغلاق», after which «لمن؟» asks where it went.
// TalkBack reads the code as what it is.

import { useLocale } from '@react-navigation/native';
import { useEffect } from 'react';
import { Modal, ScrollView, StyleSheet, Text, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { QrCode } from '../settings/QrCode';
import { colors, spacing, typography } from '../design/tokens';
import { logDay } from '../log/log-text';
import screen from '../native/NativeMinhajnaInterface';
import { localized } from '../setup/names';
import { useAppData } from '../storage/AppData';
import { useText } from '../text/i18n';
import { isolate } from '../week/grid-labels';
import type { ShownCode } from './statement-actions';

/** The code's modules without the four-module quiet zone that QrCode draws itself. */
const QUIET = 4;

export function StatementQr({ shown, onClose }: { readonly shown: ShownCode; readonly onClose: () => void }) {
  const t = useText();
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  const { width } = useWindowDimensions();
  const { profile } = useAppData();
  const centre = { writingDirection: direction, textAlign: 'center' } as const;
  const { statement, qr } = shown;
  const rows = qr.rows.slice(QUIET, -QUIET).map((row) => row.slice(QUIET, -QUIET));
  const module = Math.max(2, Math.floor((width - 2 * spacing['space-16']) / (rows.length + 2 * QUIET)));
  const subject = profile.subjects.find((one) => one.code === statement.class.subject);
  useEffect(() => {
    screen.keepScreenOn(true);
    return () => screen.keepScreenOn(false);
  }, []);
  return (
    <Modal visible animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <ScrollView
        testID="statement-qr"
        style={styles.screen}
        contentContainerStyle={[
          styles.content,
          {
            direction,
            paddingTop: insets.top + spacing['space-24'],
            paddingBottom: insets.bottom + spacing['space-24'],
          },
        ]}
      >
        <Text accessibilityRole="header" style={[styles.title, centre]}>
          {t('statement.qrTitle', { class: isolate(statement.class.section) })}
        </Text>
        <Text style={[styles.line, centre]}>
          {[subject === undefined ? statement.class.subject : localized(subject.name), logDay(statement.day)].join(
            ' · ',
          )}
        </Text>
        <QrCode testID="statement-qr-code" rows={rows.join('\n')} label={t('statement.qrLabel')} module={module} />
        <Text style={[styles.strong, centre]}>{t('statement.qrLine')}</Text>
        <Text style={[styles.line, centre]}>{t('statement.qrNote')}</Text>
        <Button testID="statement-qr-close" variant="line" label={t('statement.qrClose')} onPress={onClose} />
      </ScrollView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.sheet },
  content: { gap: spacing['space-16'], paddingHorizontal: spacing['space-16'] },
  title: { ...typography.label, color: colors.ink },
  strong: { ...typography.label, color: colors.ink },
  line: { ...typography.body, color: colors.ink2 },
});
