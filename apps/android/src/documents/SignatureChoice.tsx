// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «خانة التوقيع» on an output screen (#236, Doc-output, Print, answer 412):
// while the drawn signature is in use, the teacher picks «بتوقيعي المرسوم»,
// the first, or «فارغة» for this output only, and «إعدادات التوقيع» opens
// the signature. When it is not in use, nothing shows here and the screen
// keeps its line about signing by hand. While the output carries it, a line
// under the print and save buttons says that whoever gets the PDF can copy
// it (R-3.8-46, answer 415).

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

/** Whether any of the documents has a teacher's box or column that can carry the signature. */
export function carriesSignature(ids: readonly DocumentId[]): boolean {
  return DOCUMENTS.some((kind) => ids.includes(kind.id) && kind.drawn !== undefined);
}

/** The note under the choice: on what is confirmed only when one of the documents signs only that. */
export function drawnNote(t: Translate, ids: readonly DocumentId[]): string {
  const confirmed = DOCUMENTS.some((kind) => ids.includes(kind.id) && kind.drawn === 'confirmed');
  return t(confirmed ? 'documents.output.drawnNote' : 'documents.output.drawnNoteBox');
}

/** «من يستلم ملف PDF يمكنه نسخ التوقيع.» while `shown`; naming the print shop when one PDF goes there. */
export function CopyWarning({ testID, shown, printShop = false }: CopyWarningProps) {
  const t = useText();
  if (!shown) return null;
  return (
    <Text testID={testID} style={styles.note}>
      {t(printShop ? 'documents.output.copyShop' : 'documents.output.copy')}
    </Text>
  );
}

export type CopyWarningProps = { readonly testID: string; readonly shown: boolean; readonly printShop?: boolean };

export type SignatureChoiceProps = {
  readonly testID: string;
  readonly label: string;
  readonly drawn: boolean;
  readonly onDrawn: (drawn: boolean) => void;
  readonly disabled?: boolean;
  /** Where the signature goes, under the choice. */
  readonly note?: string;
  /** Opens the signature; without it, «إعدادات التوقيع» does not show. */
  readonly onSettings?: () => void;
};

export function SignatureChoice({ testID, label, drawn, onDrawn, disabled, note, onSettings }: SignatureChoiceProps) {
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
      {note !== undefined && (
        <Text testID={`${testID}-note`} style={styles.note}>
          {note}
        </Text>
      )}
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
  note: { ...typography.body, color: colors.pencil },
});
