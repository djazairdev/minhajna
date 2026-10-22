// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «خانة التوقيع» on an output screen (#236, Doc-output, Print, answer 412):
// while the drawn signature is in use, the teacher picks «بتوقيعي المرسوم»,
// the first, or «فارغة» for this output only, and «إعدادات التوقيع» opens
// the signature. When it is not in use, nothing shows here and the screen
// keeps its line about signing by hand.

import { signatureInUse } from '@minhajna/core';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { SegmentedControl } from '../components/SegmentedControl';
import { colors, spacing, typography } from '../design/tokens';
import { useAppData } from '../storage/AppData';
import { useText } from '../text/i18n';
import { DOCUMENTS, type DocumentId } from './catalogue';
import type { Translate } from './document-data';

/** Whether the teacher has drawn the signature and turned it on. */
export function useSignatureInUse(): boolean {
  const { state } = useAppData();
  return signatureInUse(state.personal) !== null;
}

/** The note under the choice: on what is confirmed only when one of the documents signs only that. */
export function drawnNote(t: Translate, ids: readonly DocumentId[]): string {
  const confirmed = DOCUMENTS.some((kind) => ids.includes(kind.id) && kind.drawn === 'confirmed');
  return t(confirmed ? 'documents.output.drawnNote' : 'documents.output.drawnNoteBox');
}

export type SignatureChoiceProps = {
  readonly testID: string;
  readonly label: string;
  readonly drawn: boolean;
  readonly onDrawn: (drawn: boolean) => void;
  readonly disabled?: boolean;
  /** Opens the signature; without it, «إعدادات التوقيع» does not show. */
  readonly onSettings?: () => void;
};

export function SignatureChoice({ testID, label, drawn, onDrawn, disabled, onSettings }: SignatureChoiceProps) {
  const t = useText();
  if (!useSignatureInUse()) return null;
  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      <SegmentedControl
        testID={testID}
        label={label}
        selected={drawn ? 'drawn' : 'blank'}
        disabled={disabled}
        onSelect={(value) => onDrawn(value === 'drawn')}
        choices={[
          { value: 'drawn', label: t('documents.printWeek.drawn') },
          { value: 'blank', label: t('documents.printWeek.blankBox') },
        ]}
      />
      {onSettings !== undefined && (
        <Button
          testID={`${testID}-settings`}
          variant="plain"
          label={t('documents.output.signatureSettings')}
          disabled={disabled}
          onPress={onSettings}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing['space-8'] },
  label: { ...typography.label, color: colors.ink2 },
});
