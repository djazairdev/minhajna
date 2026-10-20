// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// One plan item and the class's changes to it (#225, Plan-item, R-4.2-02,
// R-4.2-11, R-4.2-14): its kind, essential or optional, sessions and unit,
// stages, source and textbook pages, and its ID; then, for this class
// alone, moving it, joining it with the item after it, its sessions,
// splitting it in two, leaving it out, or adding an item after it. Each
// change is saved at once and can be undone on the spot or later from the
// class's changes; skipping or joining an item the pack marks essential
// asks first (answer 284). An item the teacher added shows neither badge
// nor IDs, being no item of the pack; a part of a split shows the pack
// item's ID and its part. A pack item links to a report of an error in
// it (R-4.3-01). Nothing recorded changes.

import { type Day } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { createRef, useMemo, useState, type RefObject } from 'react';
import { Alert, ScrollView, Text, View, type ViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge } from '../components/Badge';
import { RowLink } from '../components/RowLink';
import { Snackbar } from '../components/Snackbar';
import { controlIcon } from '../design/Icon';
import { spacing } from '../design/tokens';
import { settingsStyles as styles } from '../settings/styles';
import { coreContext } from '../storage/core-context';
import { useAppData } from '../storage/AppData';
import { useText } from '../text/i18n';
import { isolate } from '../week/grid-labels';
import { dayMonth, rowDays } from '../classes/plan-labels';
import { ItemSheets, type Sheet } from './ItemSheets';
import { asksFirst, changeEvent, isAdded, itemPage, shownId, type Draft } from './item-rules';

export type PlanItemProps = {
  readonly courseId: string;
  readonly itemId: string;
  readonly onChanges?: () => void;
  readonly onReport?: () => void;
};

export function PlanItem({ courseId, itemId, onChanges, onReport }: PlanItemProps) {
  const t = useText();
  const insets = useSafeAreaInsets();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const { state, profile, year, calendar, packs, today, record, newId } = useAppData();
  const day: Day = today();
  const context = useMemo(
    () => coreContext({ profile, year, calendar, packs, state }),
    [profile, year, calendar, packs, state],
  );
  const page = useMemo(() => itemPage(context, courseId, itemId, day), [context, courseId, itemId, day]);
  const [openers] = useState(
    () =>
      Object.fromEntries(
        (['move', 'budget', 'split', 'add'] as const).map((kind) => [kind, createRef<ViewInstance>()]),
      ) as Record<Sheet, RefObject<ViewInstance | null>>,
  );
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [made, setMade] = useState<string | null>(null);
  const course = state.courses.get(courseId);
  const className = isolate(state.classes.get(course?.classId ?? '')?.name ?? '');

  const save = (draft: Draft) => {
    try {
      const id = newId();
      record(changeEvent(context, courseId, draft, id, day));
      setMade(id);
    } catch {
      Alert.alert(t('planItem.title'), t('planItem.refused'));
    }
    setSheet(null);
  };
  const ask = (draft: Draft) => {
    const items =
      page === null ? [] : [page.row.item, ...(draft.kind === 'join' && page.next !== undefined ? [page.next] : [])];
    const essential = asksFirst(items);
    if (essential === undefined) return save(draft);
    Alert.alert(t('planItem.title'), t('planItem.essentialAsk', { title: isolate(essential.title) }), [
      { text: t('planItem.cancel'), style: 'cancel' },
      { text: t('planItem.goOn'), onPress: () => save(draft) },
    ]);
  };
  const undo = () => {
    if (made === null) return;
    save({ kind: 'undo', change: made });
    setMade(null);
  };
  const snackbar = made !== null && (
    <Snackbar
      testID="item-changed"
      message={t('planItem.changed', { class: className })}
      undoLabel={t('planItem.undo')}
      onUndo={undo}
      bottomOffset={insets.bottom}
    />
  );
  if (page === null) {
    return (
      <View style={styles.screen}>
        <Text style={[styles.body, align, { padding: spacing['space-16'] }]}>{t('planItem.gone')}</Text>
        {snackbar}
      </View>
    );
  }

  const { row, pack, stages, sessions, next, answered } = page;
  const item = row.item;
  const added = isAdded(item);
  const ids = shownId(item);
  const unit = pack.items.find((one) => one.id === item.unit);
  const days = rowDays(row);
  const when =
    row.next !== null
      ? t('planItem.proposed', { class: className, day: dayMonth(row.next) })
      : days !== null
        ? t('planItem.taught', { class: className, days: days.text })
        : t('planItem.classOnly', { class: className });
  const kind = added ? t('planItem.kinds.added') : t(`planItem.kinds.${item.kind}`);
  const source = [
    ...(item.sourcePage === undefined ? [] : [t('planItem.sourcePage', { page: item.sourcePage })]),
    ...(item.pages === undefined ? [] : [t('planItem.textbook', { pages: item.pages })]),
  ].join(' · ');
  const action = (id: string, icon: Parameters<typeof controlIcon>[0], title: string, onPress: () => void) => (
    <RowLink
      key={id}
      ref={id in openers ? openers[id as Sheet] : undefined}
      testID={`item-${id}`}
      icon={controlIcon(icon)}
      title={title}
      onPress={onPress}
    />
  );
  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[
          styles.content,
          {
            direction,
            paddingLeft: insets.left + spacing['space-16'],
            paddingRight: insets.right + spacing['space-16'],
            paddingBottom: insets.bottom + (made === null ? spacing['space-24'] : 96),
          },
        ]}
      >
        <View style={styles.group}>
          <Text accessibilityRole="header" style={[styles.title, align]}>
            {item.title}
          </Text>
          <Text style={[styles.sub, align]}>{when}</Text>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing['space-8'], direction }}>
          <Badge label={kind} />
          {!added && <Badge label={item.optional === true ? t('planItem.optional') : t('planItem.essential')} />}
        </View>
        <Text testID="item-sessions" style={[styles.body, align]}>
          {unit === undefined
            ? t('planDetails.sessions', { count: sessions })
            : t('planItem.sessionsUnit', {
                sessions: t('planDetails.sessions', { count: sessions }),
                unit: isolate(unit.title),
              })}
        </Text>
        {stages.length > 0 && (
          <View testID="item-stages" accessible style={styles.group}>
            <Text style={[styles.sub, align]}>{t('planItem.stages')}</Text>
            {stages.map((stage, index) => (
              <Text key={`${index}-${stage}`} style={[styles.body, align]}>{`${index + 1}. ${isolate(stage)}`}</Text>
            ))}
          </View>
        )}
        {source !== '' && <Text style={[styles.sub, align]}>{source}</Text>}
        {!added && (
          <View accessible style={styles.group}>
            <Text style={[styles.sub, align]}>{t('planItem.ids')}</Text>
            <Text selectable style={[styles.sub, { writingDirection: 'ltr', textAlign: 'left' }]}>
              {`${pack.id} · ${ids.id}`}
            </Text>
            {ids.part !== undefined && (
              <Text style={[styles.sub, align]}>{t('planItem.partId', { part: ids.part })}</Text>
            )}
          </View>
        )}
        <View style={styles.group}>
          <Text accessibilityRole="header" style={[styles.title, align]}>
            {t('planItem.changeFor', { class: className })}
          </Text>
          {action('move', 'tune', t('planItem.move'), () => setSheet('move'))}
          {next !== undefined &&
            page.joinable &&
            action('join', 'plus', t('planItem.join', { title: isolate(next.title) }), () =>
              ask({ kind: 'join', items: [item.id, next.id] }),
            )}
          {action('budget', 'tune', t('planItem.budget'), () => setSheet('budget'))}
          {answered ? (
            <Text testID="item-split-blocked" style={[styles.sub, align]}>
              {t('planItem.splitBlocked')}
            </Text>
          ) : (
            action('split', 'tune', t('planItem.split'), () => setSheet('split'))
          )}
          {row.status !== 'skipped' &&
            action('skip', 'cross', t('planItem.skip'), () => ask({ kind: 'skip', item: item.id }))}
          {item.kind !== 'td' && action('add', 'plus', t('planItem.add'), () => setSheet('add'))}
        </View>
        <Text style={[styles.sub, align]}>{t('planItem.layerNote')}</Text>
        {onChanges !== undefined && action('changes', 'info', t('planItem.changes'), onChanges)}
        {onReport !== undefined && !added && action('report', 'info', t('planItem.report'), onReport)}
      </ScrollView>
      <ItemSheets
        key={item.id}
        sheet={sheet}
        item={item}
        className={className}
        sessions={sessions}
        others={page.others}
        last={page.last}
        openers={openers}
        onClose={() => setSheet(null)}
        onMove={(before) => save({ kind: 'move', item: item.id, before })}
        onBudget={(count) => save({ kind: 'budget', item: item.id, sessions: count })}
        onSplit={(titles) => save({ kind: 'split', item: item.id, titles })}
        onAdd={(title, count) => save({ kind: 'add', title, sessions: count, before: next?.id ?? null })}
      />
      {snackbar}
    </View>
  );
}
