// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The form of one item of a class's own list (#227, Plan-free, answer
// 346): its title, one of the pack's ten kinds, its sessions from 1 to 60
// and its stages, optional, one per line. A unit groups the items after it
// and takes neither. While the item breaks a rule, a line says what it
// needs and it cannot be added. Editing an item fills the form with it.

import { FREE_STAGE_MAX, FREE_TITLE_MAX, ITEM_KINDS, type ItemKind } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { Text, View } from 'react-native';
import { Button } from '../components/Button';
import { ChipGroup } from '../components/Chip';
import { Stepper } from '../components/Stepper';
import { TextField } from '../components/TextField';
import { spacing } from '../design/tokens';
import { settingsStyles as styles } from '../settings/styles';
import { useText } from '../text/i18n';
import { draftNeeds, type FreeDraft } from './free-rules';

export type FreeItemFormProps = {
  readonly draft: FreeDraft;
  readonly editing: boolean;
  readonly onDraft: (draft: FreeDraft) => void;
  readonly onSubmit: () => void;
  readonly onCancel: () => void;
};

export function FreeItemForm({ draft, editing, onDraft, onSubmit, onCancel }: FreeItemFormProps) {
  const t = useText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const needs = draftNeeds(t, draft);
  const set = (part: Partial<FreeDraft>) => onDraft({ ...draft, ...part });
  return (
    <View testID="free-form" style={[styles.card, { gap: spacing['space-12'] }]}>
      <TextField
        testID="free-title"
        label={t('planFree.title')}
        placeholder={t('planFree.titlePlaceholder')}
        value={draft.title}
        maxLength={FREE_TITLE_MAX}
        onChangeText={(title) => set({ title: title.replace(/[\r\n\t]+/g, ' ') })}
      />
      <ChipGroup<ItemKind>
        testID="free-kind"
        label={t('planFree.kind')}
        choices={ITEM_KINDS.map((kind) => ({ value: kind, label: t(`planFree.kinds.${kind}`) }))}
        selected={draft.kind}
        onSelect={(kind) => set({ kind })}
      />
      {draft.kind === 'unit' ? (
        <Text style={[styles.sub, align]}>{t('planFree.unitNote')}</Text>
      ) : (
        <>
          <Stepper
            testID="free-sessions"
            label={t('planItem.budget')}
            unit={t('planItem.unit')}
            value={draft.sessions}
            min={1}
            max={60}
            onValueChange={(sessions) => set({ sessions })}
            decreaseLabel={t('planItem.fewer')}
            increaseLabel={t('planItem.more')}
          />
          <TextField
            testID="free-stages"
            label={t('planFree.stages')}
            optionalLabel={t('planFree.optional')}
            placeholder={t('planFree.stagesPlaceholder')}
            value={draft.stages}
            multiline
            maxLength={(FREE_STAGE_MAX + 1) * 12}
            onChangeText={(stages) => set({ stages })}
          />
        </>
      )}
      {needs !== null && draft.title !== '' && (
        <Text testID="free-needs" style={[styles.sub, align]}>
          {needs}
        </Text>
      )}
      <Button
        testID="free-add"
        label={editing ? t('planFree.update') : t('planFree.add')}
        disabled={needs !== null}
        onPress={onSubmit}
      />
      {editing && <Button testID="free-cancel" variant="plain" label={t('planFree.cancel')} onPress={onCancel} />}
    </View>
  );
}
