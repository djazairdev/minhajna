// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A source-only draft desk. Each accepted item/structure change saves one
// signed revision. Pending forms survive a failed save; immutable releases
// are read-only and a copied reference needs a fresh release identity.

import { movePackItem, removePackItem, type PackItem, type PackRelease, type PlanPack } from '@minhajna/core';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Button } from '../components/Button';
import { useDeviceText } from '../text/device-text';
import { ItemForm } from './ItemForm';
import { ReleaseReview } from './ReleaseReview';
import { StructureForm } from './StructureForm';
import { SourceForm } from './SourceForm';
import { SourcePdf, type SourceRow } from './SourcePdf';
import { editorStyles as s } from './editor-styles';

export function PackDraft({
  initial,
  revision,
  country,
  busy,
  reviewHistory,
  onSave,
  onClose,
}: {
  readonly initial: PlanPack;
  readonly revision: number;
  readonly country: string;
  readonly busy: boolean;
  readonly reviewHistory?: readonly PlanPack[] | null;
  readonly onSave: (pack: PlanPack, revision: number) => Promise<PackRelease | null>;
  readonly onClose: () => void;
}) {
  const t = useDeviceText();
  const [pack, setPack] = useState(initial);
  const [expected, setExpected] = useState(revision);
  const [form, setForm] = useState<'item' | 'structure' | 'source' | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [item, setItem] = useState<PackItem | null>(null);
  const [suggestion, setSuggestion] = useState<SourceRow | null>(null);
  const [pages, setPages] = useState<number | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [saved, setSaved] = useState(false);
  const save = async (next: PlanPack) => {
    const result = await onSave(next, expected);
    if (result === null) return;
    setPack(result.pack);
    setExpected(result.revision);
    setForm(null);
    setSaved(true);
    setInvalid(false);
  };
  const itemForm = (next: PackItem | null) => {
    setItem(next);
    setSuggestion(null);
    setForm('item');
    setSaved(false);
  };
  const change = (read: ReturnType<typeof removePackItem>) => {
    setInvalid(!read.ok);
    if (read.ok) void save(read.value);
  };
  return (
    <View testID="editor-draft" style={s.page}>
      <Text accessibilityRole="header" style={s.title}>
        {pack.id} · {pack.release}
      </Text>
      <Text accessibilityLiveRegion="polite" style={s.body}>
        {t(expected === 0 ? 'editorItem.unsaved' : 'editorItem.savedDraft')}
      </Text>
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
      {expected > 0 && form === null && reviewHistory !== undefined && (
        <Button
          testID="draft-review"
          label={t(reviewing ? 'editorItem.releaseReview.back' : 'editorItem.releaseReview.open')}
          variant="plain"
          disabled={busy}
          onPress={() => setReviewing(!reviewing)}
        />
      )}
      <View style={[s.row, { alignItems: 'flex-start' }]}>
        <View style={{ flexGrow: 1, flexShrink: 1, flexBasis: 360, minWidth: 0 }}>
          <SourcePdf
            onPages={setPages}
            disabled={busy}
            rowDisabled={form !== null || reviewing}
            onRow={(row) => {
              setItem(null);
              setSuggestion(row);
              setForm('item');
            }}
          />
        </View>
        {form !== null && (
          <View style={{ flexGrow: 1, flexShrink: 1, flexBasis: 360, minWidth: 0 }}>
            {form === 'item' && (
              <ItemForm
                pack={pack}
                item={item}
                suggestion={suggestion}
                sourcePages={pages}
                busy={busy}
                onSave={(next) => void save(next)}
                onCancel={() => setForm(null)}
              />
            )}
            {form === 'structure' && (
              <StructureForm
                pack={pack}
                busy={busy}
                onSave={(next) => void save(next)}
                onCancel={() => setForm(null)}
              />
            )}
            {form === 'source' && (
              <SourceForm
                busy={busy}
                pack={pack}
                country={country}
                onKeep={(next) => void save(next)}
                onCancel={() => setForm(null)}
              />
            )}
          </View>
        )}
      </View>
      {reviewing && reviewHistory !== undefined && <ReleaseReview pack={pack} history={reviewHistory} />}
      {form === null && !reviewing && (
        <>
          <View style={s.row}>
            <Button
              testID="draft-add"
              label={t('editorItem.addAction')}
              disabled={busy}
              onPress={() => itemForm(null)}
            />
            <Button
              testID="draft-structure"
              label={t('editorItem.structureTitle')}
              variant="plain"
              disabled={busy || pack.items.length === 0}
              onPress={() => setForm('structure')}
            />
            <Button
              testID="draft-source"
              label={t('editorItem.sourceTitle')}
              variant="plain"
              disabled={busy || pack.items.length === 0}
              onPress={() => setForm('source')}
            />
          </View>
          {pack.items.map((one, at) => (
            <View key={one.id} style={s.card}>
              <Text selectable style={s.body}>
                {one.title}
              </Text>
              <View style={s.row}>
                <Button
                  testID={`draft-edit-${one.id}`}
                  label={t('editorItem.edit')}
                  name={t('editorItem.editNamed', { title: one.title })}
                  variant="plain"
                  disabled={busy}
                  onPress={() => itemForm(one)}
                />
                <Button
                  testID={`draft-up-${one.id}`}
                  label={t('editorItem.moveUp')}
                  variant="plain"
                  disabled={busy || at === 0}
                  onPress={() => change(movePackItem(pack, one.id, pack.items[at - 1]?.id ?? null))}
                />
                <Button
                  testID={`draft-remove-${one.id}`}
                  label={t('editorItem.remove')}
                  variant="plain"
                  disabled={busy}
                  onPress={() => change(removePackItem(pack, one.id))}
                />
              </View>
            </View>
          ))}
        </>
      )}
      {invalid && (
        <Text accessibilityRole="alert" style={s.error}>
          {t('editorItem.structureProblem')}
        </Text>
      )}
    </View>
  );
}
