// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «إعدادات القسم» (#279, answer 256): the class's settings that exist,
// each opening its own screen: the seating plan, the counting rules and
// the pupils' moves, and for a lycée class the reshaping of its level's
// classes after reorientation (#231). Renaming a class or changing its
// groups comes later.

import type { RefObject } from 'react';
import { View, type ViewInstance } from 'react-native';
import { BottomSheet } from '../components/BottomSheet';
import { RowLink } from '../components/RowLink';
import { controlIcon } from '../design/Icon';
import { spacing } from '../design/tokens';
import { useText } from '../text/i18n';

export type ClassSettingsProps = {
  readonly visible: boolean;
  readonly className: string;
  readonly returnFocusRef: RefObject<ViewInstance | null>;
  readonly onClose: () => void;
  readonly onSeats: () => void;
  readonly onRules: () => void;
  readonly onMove: () => void;
  /** Opens the reorientation; no row without it. */
  readonly onReorient?: () => void;
};

export function ClassSettings({
  visible,
  className,
  returnFocusRef,
  onClose,
  onSeats,
  onRules,
  onMove,
  onReorient,
}: ClassSettingsProps) {
  const t = useText();
  const open = (go: () => void) => () => {
    onClose();
    go();
  };
  return (
    <BottomSheet
      testID="class-settings"
      visible={visible}
      title={t('classPage.settings')}
      context={className}
      reassurance={t('classPage.settingsLine')}
      returnFocusRef={returnFocusRef}
      onClose={onClose}
    >
      <View style={{ gap: spacing['space-10'] }}>
        <RowLink
          testID="class-settings-seats"
          icon={controlIcon('pupils')}
          title={t('seats.title')}
          onPress={open(onSeats)}
        />
        <RowLink
          testID="class-settings-rules"
          icon={controlIcon('tune')}
          title={t('rules.open')}
          onPress={open(onRules)}
        />
        <RowLink
          testID="class-settings-move"
          icon={controlIcon('plus')}
          title={t('move.open')}
          onPress={open(onMove)}
        />
        {onReorient !== undefined && (
          <RowLink
            testID="class-settings-reorient"
            icon={controlIcon('school')}
            title={t('reorient.open')}
            onPress={open(onReorient)}
          />
        )}
      </View>
    </BottomSheet>
  );
}
