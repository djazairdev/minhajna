// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A new source stays local until its first complete, valid item is saved.
// Release identities become immutable after the first saved draft. Only a
// plan with no items yet can choose its timing here: a copy with items would
// fail its first save under another anchor, and StructureForm changes it. An
// open form moved onto a newer revision keeps what this curator changed. The
// curator sets the status here (R-4.2-23): Official comes only from the
// Ministry's account (R-4.3-09), an example stays one, and a stale plan says
// why. A published release keeps its status; the next release changes it.

import { LICENCE_MODES, parsePackSource, rebaseForm, type PlanPack } from '@minhajna/core';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Button } from '../components/Button';
import { ChipGroup } from '../components/Chip';
import { TextField } from '../components/TextField';
import { plain } from '../plan/error-report';
import { localized } from '../setup/names';
import { currentLanguage } from '../text/i18n';
import { useDeviceText } from '../text/device-text';
import { editorStyles as s } from './editor-styles';
import { CURATOR_STATUSES } from './pack-list';

function wordsOf(pack: PlanPack) {
  return {
    id: pack.id,
    release: pack.release,
    language: pack.language,
    issuer: pack.provenance.issuer,
    edition: pack.provenance.edition,
    foundAt: pack.provenance.foundAt ?? '',
  };
}

const reasonOf = (pack: PlanPack | null) =>
  pack?.status === 'stale' && pack.staleReason !== undefined ? localized(pack.staleReason) : '';

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
  const [status, setStatus] = useState<PlanPack['status']>(
    pack?.status ?? (initial?.status === 'example' ? 'example' : 'community'),
  );
  const [reason, setReason] = useState(reasonOf(pack));
  const [invalid, setInvalid] = useState(false);
  const [seen, setSeen] = useState(pack);
  if (pack !== seen) {
    setSeen(pack);
    if (pack !== null && seen !== null) {
      setWords((old) => rebaseForm(old, wordsOf(seen), wordsOf(pack)));
      setLicence((old) => (old === seen.licence ? pack.licence : old));
      setStatus((old) => (old === seen.status ? pack.status : old));
      setReason((old) => (old === reasonOf(seen) ? reasonOf(pack) : old));
    }
  }
  const keep = () => {
    if (busy) return;
    const read = parsePackSource({
      ...words,
      status,
      licence,
      anchor: pack !== null ? pack.anchor : anchor === 'weeks' ? { kind: anchor } : { kind: anchor, unit },
      provenance: {
        issuer: words.issuer,
        edition: words.edition,
        ...(words.foundAt.trim() === '' ? {} : { foundAt: words.foundAt }),
      },
    });
    const duplicate = pack === null && reserved.includes(`${words.id}@${words.release}`);
    const why = plain(reason).trim();
    const unexplained = status === 'stale' && why === '';
    setInvalid(!read.ok || !words.id.startsWith(`${country}.`) || duplicate || unexplained);
    if (read.ok && words.id.startsWith(`${country}.`) && !duplicate && !unexplained) {
      const next = { format: 1 as const, items: [], stageTemplates: [], merges: [], ...base, ...read.value };
      if (pack === null) delete next.migration;
      if (status !== 'stale') delete next.staleReason;
      else if (reason !== reasonOf(base)) next.staleReason = { [currentLanguage()]: why };
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
      {pack === null && (initial === null || initial.items.length === 0) && (
        <>
          <ChipGroup
            testID="source-anchor"
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
      {status !== 'example' && (
        <ChipGroup
          testID="source-status"
          label={t('editorItem.status')}
          selected={status}
          onSelect={(value) => {
            if (!busy) setStatus(value);
          }}
          choices={CURATOR_STATUSES.map((value) => ({ value, label: t(`plan.status.${value}`) }))}
        />
      )}
      {status !== 'example' && <Text style={s.body}>{t('editorItem.statusHint')}</Text>}
      {status === 'stale' && (
        <TextField
          testID="source-staleReason"
          label={t('editorItem.staleReason')}
          placeholder=""
          value={reason}
          editable={!busy}
          onChangeText={(value) => {
            if (!busy) setReason(value);
          }}
        />
      )}
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
