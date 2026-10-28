// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A document's «طباعة» and «حفظ PDF» (#212). On a PC both go through the
// browser's print dialog (#250, answers 507 and 521), so they become one
// «طباعة أو حفظ PDF», running the print, with a line that the dialog offers
// a printer or "Save as PDF"; the phone keeps its two buttons, or its print
// alone where saving sits elsewhere on the screen.

import { useLocale } from '@react-navigation/native';
import { StyleSheet, Text } from 'react-native';
import { Button, type ButtonProps } from '../components/Button';
import { colors, typography } from '../design/tokens';
import { onPc } from '../text/device-text';
import { useText } from '../text/i18n';

export function PrintSave({ print, save }: { readonly print: ButtonProps; readonly save?: ButtonProps }) {
  const t = useText();
  const { direction } = useLocale();
  if (!onPc()) {
    return (
      <>
        <Button {...print} />
        {save !== undefined && <Button {...save} />}
      </>
    );
  }
  return (
    <>
      <Button {...print} label={t('documents.output.printOrSave')} />
      <Text style={[styles.line, { writingDirection: direction, textAlign: 'start' }]}>
        {t('documents.output.printOrSaveLine')}
      </Text>
    </>
  );
}

const styles = StyleSheet.create({
  line: { ...typography.small, color: colors.ink2 },
});
