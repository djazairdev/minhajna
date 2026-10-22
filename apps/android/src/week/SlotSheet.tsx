// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// One slot of the week (#28, Week-slot), over the drawing: what the slot
// holds every week, or in A weeks and in B weeks, a warning when it clashes,
// and «حذف الخانة» and «حفظ». Saving makes any course and half-group the
// slot needs, keeps an activity type only on a session of the main plan,
// and hands the drawing its new version; closing keeps nothing.

import type { TimetableVersion } from '@minhajna/core';
import { weekClashes } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { Notice } from '../components/Notice';
import { colors, spacing, typography } from '../design/tokens';
import { useAppData } from '../storage/AppData';
import { useText } from '../text/i18n';
import { gridCell, slotSpoken } from './grid-labels';
import { ItemEditor } from './ItemEditor';
import { itemsAt, otherWeek, setItems, withActivity, type SlotItem } from './slot-rules';
import type { useWeekRecords } from './useWeekRecords';
import type { Cell } from './week-rules';

type Records = ReturnType<typeof useWeekRecords>;

export type SlotSheetProps = {
  readonly cell: Cell | null;
  readonly title: string;
  readonly version: TimetableVersion;
  readonly records: Records;
  readonly onClose: () => void;
  readonly onSave: (version: TimetableVersion) => void;
};

/** The sheet, open while `cell` is set. */
export function SlotSheet({ cell, ...props }: SlotSheetProps) {
  return (
    <Modal visible={cell !== null} animationType="slide" onRequestClose={props.onClose} statusBarTranslucent>
      {cell !== null && (
        <SlotEditor key={`${cell.weekday}:${cell.slot.half}:${cell.slot.index}`} cell={cell} {...props} />
      )}
    </Modal>
  );
}

function SlotEditor({ cell, title, version, records, onClose, onSave }: SlotSheetProps & { readonly cell: Cell }) {
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  const t = useText();
  const { state, profile, newId } = useAppData();
  const [items, setItemsState] = useState<SlotItem[]>(() => itemsAt(version, records.lookup, cell).slice(0, 2));
  const classes = [...state.classes.values()].filter((schoolClass) => state.schools.has(schoolClass.schoolId));
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const [first, second] = items;
  const pair = first !== undefined && first.weeks !== 'every' ? first.weeks : null;
  const kept = [
    first,
    pair === null || second === undefined ? undefined : { ...second, weeks: otherWeek(pair) },
  ].filter((item): item is SlotItem => item !== undefined);
  const preview = setItems(version, cell, kept, { courseId: (classId, subject) => `${classId}:${subject}`, newId });
  const clashes = weekClashes(preview, state);
  const change = (at: 0 | 1, item: SlotItem | null) => {
    const next = [...items];
    if (item === null) next.splice(at);
    else next[at] = item;
    setItemsState(next);
  };
  const save = (chosen: readonly SlotItem[]) => {
    const names = [t('week.halfName', { n: 1 }), t('week.halfName', { n: 2 })] as const;
    const main = (type: string) => profile.sessionTypes.find((one) => one.code === type)?.queue === 'main';
    const resolved = chosen.map((chose): SlotItem => {
      const item = chose.kind === 'class' && !main(chose.sessionType) ? withActivity(chose, undefined) : chose;
      if (item.kind !== 'class' || !item.groupId.startsWith('half-')) return item;
      const halves = records.halves(item.classId, names)?.groups.filter((group) => group.kind === 'half') ?? [];
      return { ...item, groupId: halves[item.groupId === 'half-1' ? 0 : 1]?.id ?? item.groupId };
    });
    const courseId = (classId: string, subject: string) => records.courseOfClass(classId, subject)?.id ?? '';
    onSave(setItems(version, cell, resolved, { courseId, newId }));
  };
  const named = clashes
    .map((clash) =>
      t('week.clashAt', {
        slot: slotSpoken(t, clash.slot),
        items:
          gridCell(t, preview, records.lookup, { weekday: clash.weekday, slot: clash.slot }, { shown: true })?.spoken ??
          '',
      }),
    )
    .join('\n');
  return (
    <View
      style={[
        styles.sheet,
        {
          direction,
          paddingTop: insets.top + spacing['space-12'],
          paddingLeft: insets.left + spacing['space-16'],
          paddingRight: insets.right + spacing['space-16'],
        },
      ]}
    >
      <View style={styles.head}>
        <Text accessibilityRole="header" style={[styles.title, align]}>
          {title}
        </Text>
        <Button testID="slot-close" variant="plain" label={t('setup.close')} onPress={onClose} />
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        {clashes.length > 0 && <Notice testID="slot-clash" variant="notice" badge={t('week.clash')} message={named} />}
        <ItemEditor
          testID="slot-0"
          cell={cell}
          item={first ?? null}
          onChange={(item) => change(0, item)}
          classes={classes}
        />
        {pair !== null && (
          <ItemEditor
            testID="slot-1"
            cell={cell}
            item={second ?? null}
            onChange={(item) => change(1, item && { ...item, weeks: otherWeek(pair) })}
            classes={classes}
            week={otherWeek(pair)}
          />
        )}
      </ScrollView>
      <View style={[styles.foot, { paddingBottom: insets.bottom + spacing['space-16'] }]}>
        <View style={styles.action}>
          <Button testID="slot-remove" variant="line" label={t('week.removeSlot')} onPress={() => save([])} />
        </View>
        <View style={styles.action}>
          <Button testID="slot-save" label={t('week.saveSlot')} onPress={() => save(kept)} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, gap: spacing['space-12'], backgroundColor: colors.paper },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing['space-8'] },
  title: { ...typography.h2, color: colors.ink, flex: 1 },
  content: { gap: spacing['space-20'], paddingBottom: spacing['space-16'] },
  action: { flex: 1 },
  foot: {
    flexDirection: 'row',
    gap: spacing['space-8'],
    justifyContent: 'space-between',
    paddingTop: spacing['space-12'],
  },
});
