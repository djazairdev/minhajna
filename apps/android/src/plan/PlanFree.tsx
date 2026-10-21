// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A class's own list, without a pack (#227, Plan-free, R-4.2-06, R-4.2-20,
// answer 346): its badge «قائمتي · غير مراجَعة», then the form of an item,
// then the list, each item with its kind, sessions, stages and where the
// class is with it. Items are selected to move them a place, to edit one,
// or to remove them; a removed item a session was recorded under keeps its
// title, and nothing recorded changes. Saving records the whole list, and
// the plan, Today and the texts book follow it from then on, and keeps the
// days it began and was offered. Leaving with changes not saved asks
// first, through `onDirty`. Under its history, a saved list with nothing
// left unsaved can be offered for review (answer 347).

import {
  canonicalJson,
  courseSetup,
  planView,
  recordedItems,
  saveFreeList,
  withEdit,
  withItem,
  withoutItems,
  type FreeList,
  type PlanRow,
} from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { RowLink } from '../components/RowLink';
import { controlIcon } from '../design/Icon';
import { colorRoles, colors, radius, sizes, spacing, typography } from '../design/tokens';
import { settingsStyles } from '../settings/styles';
import { localized } from '../setup/names';
import { coreContext } from '../storage/core-context';
import { useAppData } from '../storage/AppData';
import { currentLanguage, useText } from '../text/i18n';
import { rowTags } from '../classes/plan-labels';
import { isolate } from '../week/grid-labels';
import { FreeItemForm } from './FreeItemForm';
import { FreeListHistory } from './FreeListHistory';
import { EMPTY_DRAFT, draftOf, draftTyped, itemOf, listLine, shifted, type FreeDraft } from './free-rules';

export type PlanFreeProps = {
  readonly courseId: string;
  readonly onDirty?: (dirty: boolean) => void;
  readonly onOffer?: () => void;
};

export function PlanFree({ courseId, onDirty, onOffer }: PlanFreeProps) {
  const t = useText();
  const data = useAppData();
  const { state, record, newId, today } = data;
  const { direction } = useLocale();
  const insets = useSafeAreaInsets();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const comma = currentLanguage() === 'ar' ? '، ' : ', ';
  const kept = state.lists.get(courseId);
  const [list, setList] = useState<FreeList>(() => kept ?? { courseId, started: today(), items: [] });
  const [draft, setDraft] = useState<FreeDraft>(EMPTY_DRAFT);
  const [editing, setEditing] = useState<string | null>(null);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [outcome, setOutcome] = useState<'saved' | 'refused' | null>(null);
  const course = state.courses.get(courseId);
  const className = state.classes.get(course?.classId ?? '')?.name;
  const subject = data.profile.subjects.find((one) => one.code === course?.subject);
  const dirty =
    canonicalJson([list.items, list.removed ?? []]) !== canonicalJson([kept?.items ?? [], kept?.removed ?? []]);
  const unsaved = dirty || editing !== null || draftTyped(draft);
  useEffect(() => onDirty?.(unsaved), [unsaved, onDirty]);
  const rows = useMemo(() => {
    const context = coreContext({ ...data, state });
    if (courseSetup(context, courseId).pack?.status !== 'own') return new Map<string, PlanRow>();
    const view = planView(context, courseId, data.today());
    return new Map([...(view?.main ?? []), ...(view?.td ?? [])].map((row) => [row.item.id, row]));
  }, [data, state, courseId]);

  if (course === undefined || course.pack !== null) {
    return (
      <View style={settingsStyles.screen}>
        <Text style={[settingsStyles.body, align, { padding: spacing['space-16'] }]}>{t('planFree.hasPack')}</Text>
      </View>
    );
  }
  const change = (next: FreeList) => {
    setList(next);
    setOutcome(null);
  };
  const submit = () => {
    const item = itemOf(draft, editing ?? newId());
    if (item === null) return;
    change(editing === null ? withItem(list, item, null) : withEdit(list, item));
    setDraft(EMPTY_DRAFT);
    setEditing(null);
  };
  const edit = () => {
    const item = list.items.find((one) => selected.has(one.id));
    if (item === undefined) return;
    setDraft(draftOf(item));
    setEditing(item.id);
    setSelected(new Set());
  };
  const remove = () => {
    change(withoutItems(list, [...selected], recordedItems(state, courseId)));
    setSelected(new Set());
    if (editing !== null && selected.has(editing)) {
      setEditing(null);
      setDraft(EMPTY_DRAFT);
    }
  };
  const toggle = (id: string) =>
    setSelected((now) => {
      const next = new Set(now);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  const save = () => {
    try {
      const { items, removed } = list;
      record(
        saveFreeList(state.courses, {
          courseId,
          started: kept?.started ?? list.started,
          ...(kept?.offered !== undefined && { offered: kept.offered }),
          items,
          ...(removed !== undefined && { removed }),
        }),
      );
      setOutcome('saved');
    } catch {
      setOutcome('refused');
    }
  };
  return (
    <ScrollView
      style={settingsStyles.screen}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[
        settingsStyles.content,
        {
          direction,
          paddingLeft: insets.left + spacing['space-16'],
          paddingRight: insets.right + spacing['space-16'],
          paddingBottom: insets.bottom + spacing['space-24'],
        },
      ]}
    >
      <Text style={[settingsStyles.sub, align]}>
        {[subject === undefined ? course.subject : localized(subject.name), className]
          .flatMap((name) => (name === undefined || name === '' ? [] : [isolate(name)]))
          .join(' · ')}
      </Text>
      <View style={{ flexDirection: 'row', direction }}>
        <Badge label={t('plan.status.own')} />
      </View>
      <Text style={[settingsStyles.body, align]}>{t('planFree.intro')}</Text>
      <FreeItemForm
        draft={draft}
        editing={editing !== null}
        onDraft={setDraft}
        onSubmit={submit}
        onCancel={() => {
          setEditing(null);
          setDraft(EMPTY_DRAFT);
        }}
      />
      <Text accessibilityRole="header" style={[settingsStyles.title, align]}>
        {listLine(t, list)}
      </Text>
      {list.items.length === 0 && <Text style={[settingsStyles.sub, align]}>{t('planFree.empty')}</Text>}
      <View>
        {list.items.map((item, index) => {
          const checked = selected.has(item.id);
          const row = rows.get(item.id);
          const lines = [
            item.kind === 'unit'
              ? t('planFree.kinds.unit')
              : `${t(`planFree.kinds.${item.kind}`)} · ${t('planDetails.sessions', { count: item.sessions ?? 1 })}`,
            ...(row === undefined ? [] : rowTags(t, row).map((tag) => tag.label)),
            ...((item.stages ?? []).length > 0
              ? [t('planFree.stagesLine', { stages: (item.stages ?? []).map(isolate).join(comma) })]
              : []),
          ];
          return (
            <Pressable
              key={item.id}
              testID={`free-item-${item.id}`}
              accessible
              accessibilityRole="checkbox"
              accessibilityState={{ checked }}
              accessibilityLabel={[`${index + 1}. ${item.title}`, ...lines].join(comma)}
              onPress={() => toggle(item.id)}
              style={({ pressed }) => [styles.row, checked && styles.checked, pressed && styles.pressed]}
            >
              <View style={[styles.box, checked && styles.ticked]} />
              <Text style={styles.number}>{index + 1}</Text>
              <View style={styles.grow}>
                <Text style={[item.kind === 'unit' ? styles.unit : styles.title, align]}>{item.title}</Text>
                {lines.map((line, at) => (
                  <Text key={`${at}-${line}`} style={[styles.sub, align]}>
                    {line}
                  </Text>
                ))}
              </View>
            </Pressable>
          );
        })}
      </View>
      {list.items.length > 0 && <Text style={[settingsStyles.sub, align]}>{t('planFree.selectNote')}</Text>}
      {selected.size > 0 && (
        <View testID="free-actions" style={settingsStyles.group}>
          <Button
            testID="free-earlier"
            variant="line"
            label={t('planFree.earlier')}
            onPress={() => change(shifted(list, selected, -1))}
          />
          <Button
            testID="free-later"
            variant="line"
            label={t('planFree.later')}
            onPress={() => change(shifted(list, selected, 1))}
          />
          {selected.size === 1 && (
            <Button testID="free-edit" variant="line" label={t('planFree.edit')} onPress={edit} />
          )}
          <Button testID="free-remove" variant="danger" label={t('planFree.remove')} onPress={remove} />
        </View>
      )}
      <Button testID="free-save" label={t('planFree.save')} disabled={!dirty} onPress={save} />
      {outcome !== null && (
        <Text testID={`free-${outcome}`} accessibilityLiveRegion="polite" style={[settingsStyles.sub, align]}>
          {t(`planFree.${outcome}`)}
        </Text>
      )}
      {kept !== undefined && <FreeListHistory list={kept} />}
      {onOffer !== undefined && kept !== undefined && !dirty && kept.items.length > 0 && (
        <RowLink
          testID="free-offer"
          icon={controlIcon('globe')}
          title={t('planFree.offer')}
          description={t('planFree.offerSub')}
          onPress={onOffer}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing['space-12'],
    width: '100%',
    minWidth: sizes.target,
    minHeight: sizes.target,
    paddingVertical: spacing['space-8'],
    paddingHorizontal: spacing['space-8'],
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  checked: { backgroundColor: colors.sheet, borderRadius: radius['radius-control'] },
  box: {
    width: 18,
    height: 18,
    marginTop: spacing['space-2'],
    borderWidth: 1.5,
    borderColor: colorRoles.controlBorder,
    borderRadius: spacing['space-4'],
    backgroundColor: colors.sheet,
  },
  ticked: { backgroundColor: colors.ink, borderColor: colors.ink },
  pressed: { backgroundColor: colors.sheet },
  grow: { flex: 1, gap: spacing['space-2'] },
  number: { ...typography.caption, color: colors.ink2, minWidth: 24 },
  title: { ...typography.label, color: colors.ink },
  unit: { ...typography.label, color: colors.ink, textDecorationLine: 'underline' },
  sub: { ...typography.caption, color: colors.ink2 },
});
