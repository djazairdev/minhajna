// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A source-only draft desk. Each accepted item/structure change saves one
// signed revision. Pending forms survive a failed save; immutable releases
// are read-only and a copied reference needs a fresh release identity. When
// another curator saved first, the open form moves onto the latest revision:
// what this curator changed stays and the rest takes the newer values. Focus
// returns to the button that opened a form, or to the add button if that's
// gone or was a PDF row; applying the latest revision moves it to the form.
// These moves are for the PC, the only place this page opens.

import {
  movePackItem,
  removePackItem,
  type PackItem,
  type PackPublisher,
  type PackRelease,
  type PlanPack,
} from '@minhajna/core';
import { useEffect, useRef, useState } from 'react';
import { Text, View, type ViewInstance } from 'react-native';
import { Button } from '../components/Button';
import { useDeviceText } from '../text/device-text';
import { isolate } from '../week/grid-labels';
import { ItemForm } from './ItemForm';
import { PackDraftItem } from './PackDraftItem';
import { StructureForm } from './StructureForm';
import { SourceForm } from './SourceForm';
import { SourcePdf, type SourceRow } from './SourcePdf';
import { editorStyles as s } from './editor-styles';
import { isOwnDraft } from './usePackDrafts';

const pane = { flexGrow: 1, flexShrink: 1, flexBasis: 360, minWidth: 0 } as const;

export function PackDraft({
  initial,
  revision,
  country,
  busy,
  loading = false,
  changed = false,
  latest,
  role = 'curator',
  onLatest,
  onSave,
  onClose,
}: {
  readonly initial: PlanPack;
  readonly revision: number;
  readonly country: string;
  readonly busy: boolean;
  readonly loading?: boolean;
  readonly changed?: boolean;
  readonly latest?: PackRelease;
  readonly role?: PackPublisher;
  readonly onLatest?: () => void;
  readonly onSave: (pack: PlanPack, revision: number) => Promise<PackRelease | null>;
  readonly onClose: () => void;
}) {
  const t = useDeviceText();
  const [pack, setPack] = useState(initial);
  const [expected, setExpected] = useState(revision);
  const [form, setForm] = useState<'item' | 'structure' | 'source' | null>(null);
  const [item, setItem] = useState<PackItem | null>(null);
  const [suggestion, setSuggestion] = useState<SourceRow | null>(null);
  const [pages, setPages] = useState<number | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [saved, setSaved] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [focusOn, setFocusOn] = useState<{ readonly key: string } | null>(null);
  const openers = useRef(new Map<string, ViewInstance>());
  const opener = useRef('add');
  const keep = useRef<ViewInstance>(null);
  useEffect(() => {
    if (focusOn !== null) (openers.current.get(focusOn.key) ?? openers.current.get('add'))?.focus();
  }, [focusOn]);
  useEffect(() => {
    if (removing !== null) keep.current?.focus();
  }, [removing]);
  const mark = (key: string, node: ViewInstance | null) => {
    if (node === null) openers.current.delete(key);
    else openers.current.set(key, node);
  };
  const open = (next: 'item' | 'structure' | 'source', from: string) => {
    opener.current = from;
    setForm(next);
    setSaved(false);
    setInvalid(false);
    setRemoving(null);
  };
  const closeForm = () => {
    setForm(null);
    setFocusOn({ key: opener.current });
  };
  const save = async (next: PlanPack) => {
    setSaved(false);
    const result = await onSave(next, expected);
    if (result === null) return;
    setPack(result.pack);
    setExpected(result.revision);
    if (form !== null) closeForm();
    setSaved(true);
    setInvalid(false);
  };
  const itemForm = (next: PackItem | null) => {
    setItem(next);
    setSuggestion(null);
    open('item', next === null ? 'add' : `edit-${next.id}`);
  };
  const toLatest = () => {
    if (latest === undefined) return;
    setPack(latest.pack);
    setExpected(latest.revision);
    const now = latest.pack.items.find((one) => one.id === item?.id);
    if (now !== undefined) setItem(now);
    setSaved(false);
    setInvalid(false);
    setRemoving(null);
    setFocusOn({ key: form === null ? 'add' : 'form' });
    onLatest?.();
  };
  const change = (read: ReturnType<typeof removePackItem>) => {
    setInvalid(!read.ok);
    if (read.ok) void save(read.value);
  };
  return (
    <View testID="editor-draft" style={s.page}>
      <Text accessibilityRole="header" style={s.title}>
        {isolate(pack.id)} · {isolate(pack.release)}
      </Text>
      <Text accessibilityLiveRegion="polite" style={s.body}>
        {t(expected === 0 ? 'editorItem.unsaved' : 'editorItem.savedDraft')}
      </Text>
      {loading && (
        <Text accessibilityLiveRegion="polite" style={s.body}>
          {t('editorItem.loading')}
        </Text>
      )}
      {saved && (
        <Text accessibilityRole="status" style={s.body}>
          {t('editorItem.saved')}
        </Text>
      )}
      <Button
        testID="draft-back"
        label={t('editorItem.back')}
        variant="plain"
        disabled={busy || form !== null}
        onPress={onClose}
      />
      {changed &&
        latest !== undefined &&
        latest.revision !== expected &&
        (isOwnDraft(latest, role) ? (
          <>
            <Text style={s.body}>{t(form === null ? 'editorItem.latestShowHint' : 'editorItem.latestApplyHint')}</Text>
            <Button
              testID="draft-latest"
              label={t(form === null ? 'editorItem.openLatest' : 'editorItem.applyLatest')}
              disabled={busy}
              onPress={toLatest}
            />
          </>
        ) : (
          <Text testID="draft-locked" style={s.body}>
            {t('editorItem.packLocked')}
          </Text>
        ))}
      <View style={[s.row, { alignItems: 'flex-start' }]}>
        <View style={pane}>
          <SourcePdf
            onPages={setPages}
            disabled={busy}
            rowDisabled={form !== null}
            onRow={(row) => {
              setItem(null);
              setSuggestion(row);
              open('item', 'add');
            }}
          />
        </View>
        {form !== null && (
          <View
            ref={(node) => mark('form', node)}
            testID="draft-form"
            tabIndex={-1}
            role="group"
            accessibilityLabel={t('editorItem.yourForm')}
            style={pane}
          >
            {form === 'item' && (
              <ItemForm
                pack={pack}
                item={item}
                suggestion={suggestion}
                sourcePages={pages}
                busy={busy}
                onSave={(next) => void save(next)}
                onCancel={closeForm}
              />
            )}
            {form === 'structure' && (
              <StructureForm pack={pack} busy={busy} onSave={(next) => void save(next)} onCancel={closeForm} />
            )}
            {form === 'source' && (
              <SourceForm
                busy={busy}
                pack={pack}
                country={country}
                onKeep={(next) => void save(next)}
                onCancel={closeForm}
              />
            )}
          </View>
        )}
      </View>
      {form === null && (
        <>
          <View style={s.row}>
            <Button
              ref={(node) => mark('add', node)}
              testID="draft-add"
              label={t('editorItem.addAction')}
              disabled={busy}
              onPress={() => itemForm(null)}
            />
            <Button
              ref={(node) => mark('structure', node)}
              testID="draft-structure"
              label={t('editorItem.structureTitle')}
              variant="plain"
              disabled={busy || pack.items.length === 0}
              onPress={() => open('structure', 'structure')}
            />
            <Button
              ref={(node) => mark('source', node)}
              testID="draft-source"
              label={t('editorItem.sourceTitle')}
              variant="plain"
              disabled={busy || pack.items.length === 0}
              onPress={() => open('source', 'source')}
            />
          </View>
          {pack.items.map((one, at) => (
            <PackDraftItem
              key={one.id}
              item={one}
              first={at === 0}
              busy={busy}
              asking={removing === one.id}
              onMark={(key, node) => mark(key, node)}
              keepRef={keep}
              onEdit={() => itemForm(one)}
              onUp={() => change(movePackItem(pack, one.id, pack.items[at - 1]?.id ?? null))}
              onAsk={() => setRemoving(one.id)}
              onKeep={() => {
                setRemoving(null);
                setFocusOn({ key: `remove-${one.id}` });
              }}
              onRemove={() => {
                setRemoving(null);
                setFocusOn({ key: 'add' });
                change(removePackItem(pack, one.id));
              }}
            />
          ))}
        </>
      )}
      {invalid && form === null && (
        <Text accessibilityRole="alert" style={s.error}>
          {t('editorItem.structureProblem')}
        </Text>
      )}
    </View>
  );
}
