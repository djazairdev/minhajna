// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «لمن؟» (#439, Share-to, R-3.10-10, answer 486): after a statement left, or
// from a row of «سجل المشاركة», the role it went to, among the five, never a
// name and no free text. «حفظ في سجل المشاركة» adds the role to the history,
// which keeps the earlier one; «لاحقاً» and closing add nothing, as the share
// is already there, without a recipient yet.

import type { ShareRole, StatementShare } from '@minhajna/core';
import { SHARE_ROLES } from '@minhajna/core';
import { useState, type RefObject } from 'react';
import { StyleSheet, View, type ViewInstance } from 'react-native';
import { BottomSheet } from '../components/BottomSheet';
import { Button } from '../components/Button';
import { ChipGroup } from '../components/Chip';
import { spacing } from '../design/tokens';
import { logDay } from '../log/log-text';
import { useAppData } from '../storage/AppData';
import { useText } from '../text/i18n';
import { shareClass, shareHow } from './share-words';

export type ShareToProps = {
  /** The share asked about, with its day and the role said last, if any; nothing shows without one. */
  readonly share: (StatementShare & { readonly day: string; readonly to: ShareRole | null }) | null;
  readonly onClose: () => void;
  readonly returnFocusRef: RefObject<ViewInstance | null>;
};

export function ShareTo({ share, onClose, returnFocusRef }: ShareToProps) {
  const t = useText();
  const { state, record } = useAppData();
  const [picked, setPicked] = useState<ShareRole | null>(null);
  const role = picked ?? share?.to ?? null;
  const close = () => {
    setPicked(null);
    onClose();
  };
  const save = () => {
    if (share !== null && role !== null && role !== share.to)
      record({ kind: 'statement.sent', sent: { id: share.id, to: role } });
    close();
  };
  const context =
    share === null
      ? ''
      : t('statement.toContext', {
          class: shareClass(state, share.courseId),
          how: shareHow(t, share.how),
          day: logDay(share.day as Parameters<typeof logDay>[0]),
        });
  return (
    <BottomSheet
      testID="statement-to"
      visible={share !== null}
      title={t('statement.toTitle')}
      context={context}
      reassurance={t('statement.toNote')}
      onClose={close}
      returnFocusRef={returnFocusRef}
    >
      <ChipGroup
        testID="statement-to-roles"
        label={t('statement.toTitle')}
        selected={role}
        onSelect={setPicked}
        choices={SHARE_ROLES.map((value) => ({ value, label: t(`statement.roles.${value}`) }))}
      />
      <View style={styles.actions}>
        <Button testID="statement-to-save" label={t('statement.toSave')} disabled={role === null} onPress={save} />
        <Button testID="statement-to-later" variant="line" label={t('statement.toLater')} onPress={close} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  actions: { gap: spacing['space-10'] },
});
