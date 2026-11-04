// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A provisional curator form for review before #515's design export (#613).
// It uses the shared controls and the core's source-item reader. Re-entry
// starts blank and changing a first numeric entry clears its second entry.
// The caller receives a validated pack copy and owns draft persistence;
// no reference pack or teacher record is written by this component.
// The outer key resets the form when a different item or release opens. A
// form moved onto a newer revision keeps what this curator changed, needs a
// budget retyped if its unit changed, and says if the item is no longer there.

import {
  budgetUnitOf,
  ITEM_KINDS,
  ITEM_NUMBERS,
  editPackItem,
  packItemForm,
  rebasePackItemForm,
  sourceNumber,
  type ItemNumber,
  type PackItem,
  type PackItemForm,
  type ParseProblem,
  type PlanPack,
} from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { CheckRow } from '../components/CheckRow';
import { ChipGroup } from '../components/Chip';
import { TextField } from '../components/TextField';
import { colors, radius, spacing, typography } from '../design/tokens';
import { useDeviceText } from '../text/device-text';
import type { SourceRow } from './SourcePdf';

export interface ItemFormProps {
  readonly pack: PlanPack;
  readonly item: PackItem | null;
  readonly before?: string | null;
  readonly busy?: boolean;
  readonly suggestion?: SourceRow | null;
  readonly sourcePages?: number | null;
  readonly onSave: (pack: PlanPack) => void;
  readonly onCancel: () => void;
}

/** One source item, with independent re-entry of every structured source number. */
export function ItemForm(props: ItemFormProps) {
  return <Fields key={`${props.pack.id}@${props.pack.release}/${props.item?.id ?? ''}`} {...props} />;
}

function Fields({
  pack,
  item,
  before = null,
  busy = false,
  suggestion = null,
  sourcePages = null,
  onSave,
  onCancel,
}: ItemFormProps) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: direction === 'rtl' ? 'right' : 'left' } as const;
  const [form, setForm] = useState<PackItemForm>(() => ({
    ...packItemForm(item),
    ...(suggestion === null
      ? {}
      : {
          title: suggestion.title,
          sourcePage: String(suggestion.page),
          week: suggestion.week === undefined ? '' : String(suggestion.week),
        }),
  }));
  const [titleCheck, setTitleCheck] = useState('');
  const [pagesCheck, setPagesCheck] = useState('');
  const [problems, setProblems] = useState<readonly ParseProblem[]>([]);
  const [seen, setSeen] = useState({ item, pack });
  if (item !== seen.item || pack !== seen.pack) {
    setSeen({ item, pack });
    const moved = item !== null && seen.item !== null ? rebasePackItemForm(form, seen.item, item) : form;
    const unit = budgetUnitOf(pack) !== budgetUnitOf(seen.pack);
    setForm(unit ? { ...moved, retyped: { ...moved.retyped, budget: '' } } : moved);
    if (moved.pages !== form.pages) setPagesCheck('');
  }
  const gone = item !== null && !pack.items.some((one) => one.id === item.id);
  const set = (change: Partial<PackItemForm>) => {
    if (!busy) setForm((old) => ({ ...old, ...change }));
  };
  const error = (path: string) => {
    const problem = problems.find((one) => one.path === path);
    return problem === undefined
      ? undefined
      : path.startsWith('retyped.') && problem.problem === 'invalid'
        ? t('editorItem.numberMismatch')
        : t(`editorItem.errors.${problem.problem}`);
  };
  const word = (key: 'id' | 'title' | 'unit' | 'activity' | 'stages' | 'pages' | ItemNumber) =>
    key === 'budget'
      ? t(
          pack.anchor.kind !== 'weeks' && pack.anchor.unit === 'hours'
            ? 'editorItem.fields.hours'
            : 'editorItem.fields.sessions',
        )
      : t(`editorItem.fields.${key}`);
  const required = (key: ItemNumber) =>
    key === 'sourcePage' ||
    (form.kind !== 'unit' && (pack.anchor.kind === 'weeks' ? key === 'week' : key === 'budget'));
  const numeric = (key: ItemNumber, repeat: boolean) => (
    <TextField
      testID={`item-${repeat ? 'retyped-' : ''}${key}`}
      label={repeat ? t('editorItem.retype', { field: word(key) }) : word(key)}
      placeholder=""
      value={repeat ? form.retyped[key] : form[key]}
      inputMode={key === 'budget' ? 'decimal' : 'numeric'}
      textDirection="ltr"
      editable={!busy}
      {...(required(key) ? {} : { optionalLabel: t('editorItem.optionalField') })}
      error={error(repeat ? `retyped.${key}` : key)}
      onChangeText={(text) =>
        set(
          repeat
            ? { retyped: { ...form.retyped, [key]: text } }
            : { [key]: text, retyped: { ...form.retyped, [key]: '' } },
        )
      }
    />
  );
  const text = (key: 'id' | 'title' | 'pages', optional = false) => (
    <TextField
      testID={`item-${key}`}
      label={word(key)}
      placeholder=""
      value={form[key]}
      editable={!busy && (key !== 'id' || item === null)}
      onChangeText={(value) => {
        set({ [key]: value });
        if (key === 'title') setTitleCheck('');
        if (key === 'pages') setPagesCheck('');
      }}
      error={error(key)}
      {...(optional ? { optionalLabel: t('editorItem.optionalField') } : {})}
      {...(key === 'id' ? { textDirection: 'ltr' as const, autoCapitalize: 'none' as const, maxLength: 64 } : {})}
      {...(key === 'title'
        ? { multiline: true, textDirection: pack.language === 'ar' ? ('rtl' as const) : ('ltr' as const) }
        : {})}
    />
  );
  const choices = (key: 'unit' | 'stages' | 'activity', values: readonly { value: string; label: string }[]) => (
    <View>
      <ChipGroup
        testID={`item-${key}`}
        label={word(key)}
        choices={[{ value: '', label: t('editorItem.none') }, ...values]}
        selected={form[key]}
        onSelect={(value) => set({ [key]: value })}
      />
      {error(key) !== undefined && (
        <Text accessibilityLiveRegion="polite" style={[styles.error, align]}>
          {error(key)}
        </Text>
      )}
    </View>
  );
  const save = () => {
    if (busy || gone) return;
    const read = editPackItem(pack, item?.id ?? null, form, before);
    const extra: ParseProblem[] = [];
    if (suggestion !== null && form.title.trim() !== titleCheck.trim())
      extra.push({ path: 'titleCheck', problem: 'invalid' });
    if (form.pages.trim() !== pagesCheck.trim()) extra.push({ path: 'pagesCheck', problem: 'invalid' });
    if (sourcePages !== null && (sourceNumber(form.sourcePage, true) ?? 0) > sourcePages)
      extra.push({ path: 'sourcePage', problem: 'invalid' });
    setProblems([...(read.ok ? [] : read.problems), ...extra]);
    if (read.ok && extra.length === 0) onSave(read.value);
  };
  const group = (kind: PackItem['kind']) => (kind === 'unit' || kind === 'td' ? kind : 'main');
  const kinds = ITEM_KINDS.filter((kind) => item === null || group(item.kind) === group(kind));
  return (
    <View testID="editor-item-form" style={[styles.card, { direction }]}>
      <Text accessibilityRole="header" style={[styles.heading, align]}>
        {t(item === null ? 'editorItem.addTitle' : 'editorItem.editTitle')}
      </Text>
      {text('id')}
      {item !== null && <Text style={[styles.small, align]}>{t('editorItem.fixedId')}</Text>}
      {text('title')}
      {suggestion !== null && (
        <TextField
          testID="item-title-check"
          label={t('editorItem.retypeTitle')}
          placeholder=""
          multiline
          value={titleCheck}
          onChangeText={setTitleCheck}
          editable={!busy}
          error={error('titleCheck')}
        />
      )}
      <ChipGroup
        testID="item-kind"
        label={t('editorItem.kind')}
        choices={kinds.map((value) => ({ value, label: t(`planItem.kinds.${value}`) }))}
        selected={form.kind}
        onSelect={(kind) => set({ kind })}
      />
      {choices(
        'unit',
        pack.items
          .filter((one) => one.kind === 'unit' && one.id !== item?.id)
          .map((one) => ({ value: one.id, label: one.title })),
      )}
      {pack.activities !== undefined &&
        choices(
          'activity',
          pack.activities.map((one) => ({
            value: one.code,
            label: one.name[pack.language] ?? Object.values(one.name)[0] ?? one.code,
          })),
        )}
      <Text style={[styles.body, align]}>{t('editorItem.numberHint')}</Text>
      {ITEM_NUMBERS.map((key) => (
        <View key={key} style={styles.pair}>
          <View style={styles.column}>{numeric(key, false)}</View>
          {(required(key) || form[key].trim() !== '') && <View style={styles.column}>{numeric(key, true)}</View>}
        </View>
      ))}
      {text('pages', true)}
      {form.pages !== '' && (
        <TextField
          testID="item-pages-check"
          label={t('editorItem.retype', { field: word('pages') })}
          placeholder=""
          value={pagesCheck}
          onChangeText={setPagesCheck}
          editable={!busy}
          error={error('pagesCheck')}
        />
      )}
      {choices(
        'stages',
        pack.stageTemplates.map((one) => ({ value: one.id, label: one.stages.join(' · ') })),
      )}
      <CheckRow
        testID="item-optional"
        label={t('editorItem.optional')}
        checked={form.optional}
        disabled={busy}
        onCheckedChange={(optional) => set({ optional })}
      />
      <CheckRow
        testID="item-buffer"
        label={t('editorItem.buffer')}
        checked={form.buffer}
        disabled={busy}
        onCheckedChange={(buffer) => set({ buffer })}
      />
      {problems.length > 0 && (
        <Text testID="item-problems" accessibilityRole="alert" style={[styles.error, align]}>
          {t('editorItem.checkFields')}
        </Text>
      )}
      {gone && (
        <Text testID="item-gone" accessibilityRole="alert" style={[styles.error, align]}>
          {t('editorItem.itemGone')}
        </Text>
      )}
      <View style={styles.actions}>
        <Button testID="item-save" label={t('editorItem.save')} disabled={busy || gone} onPress={save} />
        <Button
          testID="item-cancel"
          label={t('editorItem.cancel')}
          variant="plain"
          disabled={busy}
          onPress={onCancel}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    padding: spacing['space-16'],
    gap: spacing['space-12'],
    backgroundColor: colors.paper,
    minWidth: 0,
  },
  heading: { ...typography.h2, color: colors.ink },
  body: { ...typography.body, color: colors.ink },
  small: { ...typography.caption, color: colors.ink2 },
  error: { ...typography.body, color: colors['error-ink'] },
  pair: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing['space-12'] },
  column: { flexGrow: 1, flexBasis: 220, minWidth: 0 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing['space-8'] },
});
