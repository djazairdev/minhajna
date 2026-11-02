// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A new source stays local until its first complete, valid item is saved.
// Release identities become immutable after the first saved draft.

import { LICENCE_MODES, parsePackSource, type PlanPack } from '@minhajna/core';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Button } from '../components/Button';
import { ChipGroup } from '../components/Chip';
import { TextField } from '../components/TextField';
import { useDeviceText } from '../text/device-text';
import { editorStyles as s } from './editor-styles';

export function SourceForm({
  pack,
  initial = null,
  country,
  busy = false,
  reserved = [],
  onKeep,
  onCancel,
}: {
  readonly pack: PlanPack | null;
  readonly initial?: PlanPack | null;
  readonly country: string;
  readonly busy?: boolean;
  readonly reserved?: readonly string[];
  readonly onKeep: (pack: PlanPack) => void;
  readonly onCancel: () => void;
}) {
  const t = useDeviceText();
  const base = pack ?? initial;
  const [anchor, setAnchor] = useState<string>(base?.anchor.kind ?? 'weeks');
  const [unit, setUnit] = useState<string>(
    base?.anchor.kind === 'weeks' ? 'sessions' : (base?.anchor.unit ?? 'sessions'),
  );
  const [words, setWords] = useState({
    id: base?.id ?? '',
    release: pack?.release ?? '',
    language: base?.language ?? 'ar',
    issuer: base?.provenance.issuer ?? '',
    edition: base?.provenance.edition ?? '',
    foundAt: base?.provenance.foundAt ?? '',
  });
  const [licence, setLicence] = useState<string>(base?.licence ?? 'structure-only');
  const [invalid, setInvalid] = useState(false);
  const keep = () => {
    if (busy) return;
    const read = parsePackSource({
      ...words,
      status: pack?.status ?? (initial?.status === 'example' ? 'example' : 'community'),
      licence,
      anchor: anchor === 'weeks' ? { kind: anchor } : { kind: anchor, unit },
      provenance: {
        issuer: words.issuer,
        edition: words.edition,
        ...(words.foundAt.trim() === '' ? {} : { foundAt: words.foundAt }),
      },
    });
    const duplicate = pack === null && reserved.includes(`${words.id}@${words.release}`);
    setInvalid(!read.ok || !words.id.startsWith(`${country}.`) || duplicate);
    if (read.ok && words.id.startsWith(`${country}.`) && !duplicate) {
      const next = { format: 1 as const, items: [], stageTemplates: [], merges: [], ...base, ...read.value };
      if (pack === null && next.status !== 'stale') delete next.staleReason;
      onKeep(next);
    }
  };
  return (
    <View testID="editor-source-form" style={s.page}>
      <Text accessibilityRole="header" style={s.title}>
        {t('editorItem.sourceTitle')}
      </Text>
      {(Object.keys(words) as (keyof typeof words)[]).map((key) => (
        <TextField
          key={key}
          testID={`source-${key}`}
          label={t(`editorItem.sourceFields.${key}`)}
          placeholder=""
          value={words[key]}
          editable={!busy && (pack === null || (key !== 'id' && key !== 'release'))}
          onChangeText={(value) => {
            if (!busy) setWords((old) => ({ ...old, [key]: value }));
          }}
          {...(['id', 'release', 'language', 'foundAt'].includes(key)
            ? { textDirection: 'ltr' as const, autoCapitalize: 'none' as const }
            : {})}
        />
      ))}
      {pack === null && (
        <>
          <ChipGroup
            label={t('editorItem.anchor')}
            selected={anchor}
            onSelect={setAnchor}
            choices={(['weeks', 'budgets', 'hybrid'] as const).map((value) => ({
              value,
              label: t(`editorItem.anchors.${value}`),
            }))}
          />
          {anchor !== 'weeks' && (
            <ChipGroup
              label={t('editorItem.budgetUnit')}
              selected={unit}
              onSelect={setUnit}
              choices={(['sessions', 'hours'] as const).map((value) => ({
                value,
                label: t(`editorItem.fields.${value}`),
              }))}
            />
          )}
        </>
      )}
      <ChipGroup
        label={t('editorItem.licence')}
        selected={licence}
        onSelect={(value) => {
          if (!busy) setLicence(value);
        }}
        choices={LICENCE_MODES.map((value) => ({ value, label: t(`editorItem.licences.${value}`) }))}
      />
      {invalid && (
        <Text accessibilityRole="alert" style={s.error}>
          {t('editorItem.sourceProblem')}
        </Text>
      )}
      <Button disabled={busy} testID="source-keep" label={t('editorItem.continue')} onPress={keep} />
      <Button disabled={busy} label={t('editorItem.cancel')} variant="plain" onPress={onCancel} />
    </View>
  );
}
