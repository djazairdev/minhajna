// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Share-warn (#242, R-5.9-15 to R-5.9-17, answer 467): before a file with
// pupils' marks leaves the phone, the file's name, «داخلي · سري», that
// professional secrecy covers it (Ord. 06-03 Art. 48), so it goes to the
// administration only and better not through messaging or social apps; whether
// a password protects it, set on the screen before; and that no public link is
// ever made. «إلغاء» shares nothing.

import { useLocale } from '@react-navigation/native';
import type { RefObject } from 'react';
import { StyleSheet, Text, View, type ViewInstance } from 'react-native';
import { Badge } from '../components/Badge';
import { BottomSheet } from '../components/BottomSheet';
import { Button } from '../components/Button';
import { colors, spacing, typography } from '../design/tokens';
import { useText } from '../text/i18n';

export type ShareWarnProps = {
  readonly visible: boolean;
  readonly fileName: string;
  readonly locked: boolean;
  readonly returnFocusRef: RefObject<ViewInstance | null>;
  readonly onClose: () => void;
  readonly onShare: () => void;
};

export function ShareWarn({ visible, fileName, locked, returnFocusRef, onClose, onShare }: ShareWarnProps) {
  const t = useText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  return (
    <BottomSheet
      testID="share-warn"
      visible={visible}
      title={t('marks.export.share.heading')}
      context={fileName}
      reassurance={t('marks.export.share.noLink')}
      returnFocusRef={returnFocusRef}
      onClose={onClose}
    >
      <View style={styles.group}>
        <Badge label={t('documents.confidential')} />
        <Text style={[styles.body, align]}>{t('marks.export.share.secrecy')}</Text>
        <Text testID="share-warn-lock" style={[styles.note, align]}>
          {t(locked ? 'marks.export.share.locked' : 'marks.export.share.open')}
        </Text>
        <Button testID="share-warn-share" label={t('marks.export.share.action')} onPress={onShare} />
        <Button testID="share-warn-cancel" variant="line" label={t('marks.export.share.cancel')} onPress={onClose} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing['space-10'] },
  body: { ...typography.body, color: colors.ink },
  note: { ...typography.caption, color: colors.ink2 },
});
