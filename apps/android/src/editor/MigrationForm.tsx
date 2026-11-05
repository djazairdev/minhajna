// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// E-Migrate (#615, R-4.2-26, R-4.2-30, R-4.3-15, answers 487 and 769): the
// item IDs from the release before to this draft, each entry with the source
// page of the new item, and the earlier items still needing an entry. An entry
// is made by choosing, never by dragging: its kind, the earlier items, then the
// new ones. Each entry saves one revision of the draft, as any other change
// does. What a class's progress does across a split is fixed by the format,
// applied on the teacher's device, and never asked here, so the design's choice
// of how a finished item counts is a note: every part finished, skipped or
// restarted as the old item was. The map is read-only, drawn where the app
// draws, and the entries and lists are its words.

import { newIds, oldIds, type MigrationEntry, type PackItem, type PlanPack } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Button } from '../components/Button';
import { ChipGroup } from '../components/Chip';
import { SegmentedControl } from '../components/SegmentedControl';
import { useDrawing } from '../drawing/drawing-kit';
import { useDeviceText } from '../text/device-text';
import { isolate } from '../week/grid-labels';
import { editorStyles as s } from './editor-styles';
import { addEntry, entryOf, migrationMap, migrationView, removeEntry, type EntryKind } from './migration-rules';

const KINDS = ['rename', 'split', 'merge', 'remove'] as const;

const ids = (list: readonly string[]) => list.map((one) => isolate(one)).join(' · ');
const named = (item: PackItem) => ({ value: item.id, label: `${item.id} · ${item.title}`, script: 'arabic' as const });

/** The pages an entry's new items cite, as the source of the change. */
function sourceOf(entry: MigrationEntry, pack: PlanPack) {
  const pages = newIds(entry).flatMap((id) => {
    const page = pack.items.find((item) => item.id === id)?.sourcePage;
    return page === undefined ? [] : [String(page)];
  });
  return ids(pages);
}

export function MigrationForm({
  pack,
  previous,
  busy,
  onSave,
  onCancel,
}: {
  readonly pack: PlanPack;
  readonly previous: PlanPack | null;
  readonly busy: boolean;
  /** Whether it was saved. */
  readonly onSave: (next: PlanPack) => Promise<boolean>;
  readonly onCancel: () => void;
}) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const drawing = useDrawing();
  const [kind, setKind] = useState<EntryKind>('rename');
  const [from, setFrom] = useState<readonly string[]>([]);
  const [to, setTo] = useState<readonly string[]>([]);
  const [invalid, setInvalid] = useState(false);
  const [only, setOnly] = useState<'changes' | 'all'>('changes');
  if (previous === null)
    return <Button testID="migrate-close" label={t('editorDesk.migrate.close')} variant="plain" onPress={onCancel} />;
  const kinds = {
    rename: t('editorDesk.migrate.kinds.rename'),
    split: t('editorDesk.migrate.kinds.split'),
    merge: t('editorDesk.migrate.kinds.merge'),
    remove: t('editorDesk.migrate.kinds.remove'),
  };
  const view = migrationView(pack, previous);
  const entry = entryOf(kind, from, to);
  const save = async (next: PlanPack | null) => {
    setInvalid(next === null);
    if (next === null || !(await onSave(next))) return;
    setFrom([]);
    setTo([]);
  };
  const pickKind = (next: EntryKind) => {
    setKind(next);
    setFrom([]);
    setTo([]);
    setInvalid(false);
  };
  return (
    <View testID="migrate-form" style={s.page}>
      <Text accessibilityRole="header" style={s.title}>
        {t('editorDesk.migrate.title', { from: isolate(previous.release), to: isolate(pack.release) })}
      </Text>
      <Text style={s.body}>{t('editorDesk.migrate.hint')}</Text>
      {view.open.length > 0 && (
        <Text testID="migrate-open" style={s.error}>
          {t('editorDesk.migrate.open', { ids: ids(view.open.map((item) => item.id)) })}
        </Text>
      )}
      {view.misfits.length > 0 && (
        <Text testID="migrate-misfits" style={s.error}>
          {t('editorDesk.migrate.misfits', { ids: ids(view.misfits) })}
        </Text>
      )}
      {view.added.length > 0 && (
        <Text testID="migrate-added" style={s.body}>
          {t('editorDesk.migrate.added', { ids: ids(view.added.map((item) => item.id)) })}
        </Text>
      )}
      {view.entries.length === 0 && <Text style={s.body}>{t('editorDesk.migrate.none')}</Text>}
      {pack.migration !== undefined && pack.migration.from !== previous.release && (
        <Text testID="migrate-other-from" style={s.error}>
          {t('editorDesk.migrate.otherFrom', { release: isolate(pack.migration.from) })}
        </Text>
      )}
      {view.entries.map((one, index) => (
        <View key={oldIds(one).join()} testID={`migrate-entry-${index}`} style={s.card}>
          <Text style={s.body}>
            {t(`editorDesk.release.entry.${one.kind}`, { from: ids(oldIds(one)), to: ids(newIds(one)) })}
          </Text>
          {sourceOf(one, pack) !== '' && (
            <Text style={s.body}>{t('editorDesk.migrate.source', { pages: sourceOf(one, pack) })}</Text>
          )}
          {one.kind === 'split' && <Text style={s.body}>{t('editorDesk.release.splitProgress')}</Text>}
          <Button
            testID={`migrate-remove-${index}`}
            label={t('editorDesk.migrate.remove')}
            name={t('editorDesk.migrate.removeNamed', { ids: ids(oldIds(one)) })}
            variant="plain"
            disabled={busy}
            onPress={() => void save(removeEntry(pack, previous, index))}
          />
        </View>
      ))}
      <View testID="migrate-add" style={s.card}>
        <ChipGroup
          testID="migrate-kind"
          label={t('editorDesk.migrate.kind')}
          choices={KINDS.map((value) => ({ value, label: t(`editorDesk.migrate.kinds.${value}`) }))}
          selected={kind}
          onSelect={pickKind}
        />
        {view.open.length > 0 ? (
          <ChipGroup
            multiple
            testID="migrate-from"
            label={t('editorDesk.migrate.from')}
            choices={view.open.map(named)}
            selected={[...from]}
            onSelect={setFrom}
          />
        ) : (
          <Text style={s.body}>{t('editorDesk.migrate.noneOpen')}</Text>
        )}
        {kind !== 'remove' &&
          (view.added.length > 0 ? (
            <ChipGroup
              multiple
              testID="migrate-to"
              label={t('editorDesk.migrate.to')}
              choices={view.added.map(named)}
              selected={[...to]}
              onSelect={setTo}
            />
          ) : (
            <Text style={s.body}>{t('editorDesk.migrate.noneAdded')}</Text>
          ))}
        {invalid && (
          <Text accessibilityRole="alert" style={s.error}>
            {t('editorDesk.migrate.problem')}
          </Text>
        )}
        <Button
          testID="migrate-add-entry"
          label={t('editorDesk.migrate.add')}
          disabled={busy || entry === null}
          onPress={() => {
            if (entry !== null) void save(addEntry(pack, previous, entry));
          }}
        />
      </View>
      {drawing !== null && (
        <>
          <SegmentedControl
            testID="migrate-only"
            label={t('editorDesk.migrate.shown')}
            choices={[
              { value: 'changes', label: t('editorDesk.migrate.changes') },
              { value: 'all', label: t('editorDesk.migrate.all') },
            ]}
            selected={only}
            onSelect={setOnly}
          />
          <drawing.Map
            testID="migrate-map"
            spec={migrationMap(
              t('editorDesk.migrate.mapLabel'),
              kinds,
              pack,
              view,
              direction === 'rtl',
              only === 'changes',
            )}
          />
        </>
      )}
      <Text style={s.body}>{t('editorDesk.migrate.onDevice')}</Text>
      <Button testID="migrate-close" label={t('editorDesk.migrate.close')} variant="plain" onPress={onCancel} />
    </View>
  );
}
