// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Provisional structure fields for #613, approved for review while #515's
// board is missing. The core checks the whole pack and independent weekly
// counts. Changing an anchor keeps the model until the curator removes it
// explicitly. Other source languages remain on each activity's name.

import { packStructureForm, readPackStructureForm, type PackStructureForm, type PlanPack } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { SegmentedControl } from '../components/SegmentedControl';
import { TextField } from '../components/TextField';
import { colors, radius, spacing, typography } from '../design/tokens';
import { useDeviceText } from '../text/device-text';

/** Anchor, stages and weekly activities, saved as a validated copy by the caller. */
export function StructureForm({
  pack,
  busy = false,
  onSave,
  onCancel,
}: {
  readonly pack: PlanPack;
  readonly busy?: boolean;
  readonly onSave: (pack: PlanPack) => void;
  readonly onCancel: () => void;
}) {
  return <Fields key={`${pack.id}@${pack.release}`} pack={pack} busy={busy} onSave={onSave} onCancel={onCancel} />;
}

function Fields({
  pack,
  busy = false,
  onSave,
  onCancel,
}: {
  readonly pack: PlanPack;
  readonly busy?: boolean;
  readonly onSave: (pack: PlanPack) => void;
  readonly onCancel: () => void;
}) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: direction === 'rtl' ? 'right' : 'left' } as const;
  const [form, setForm] = useState<PackStructureForm>(() => packStructureForm(pack));
  const [invalid, setInvalid] = useState(false);
  const set = (change: Partial<PackStructureForm>) => {
    if (!busy) setForm((old) => ({ ...old, ...change }));
  };
  const template = (at: number, change: Partial<PackStructureForm['templates'][number]>) =>
    set({ templates: form.templates.map((one, index) => (index === at ? { ...one, ...change } : one)) });
  const activity = (at: number, change: Partial<PackStructureForm['activities'][number]>) =>
    set({ activities: form.activities.map((one, index) => (index === at ? { ...one, ...change } : one)) });
  const save = () => {
    if (busy) return;
    const read = readPackStructureForm(pack, form);
    setInvalid(!read.ok);
    if (read.ok) onSave(read.value);
  };
  return (
    <View testID="editor-structure-form" style={[styles.page, { direction }]}>
      <Text accessibilityRole="header" style={[styles.heading, align]}>
        {t('editorItem.structureTitle')}
      </Text>
      <SegmentedControl
        testID="structure-anchor"
        label={t('editorItem.anchor')}
        choices={[
          { value: 'weeks', label: t('editorItem.anchors.weeks') },
          { value: 'budgets', label: t('editorItem.anchors.budgets') },
          { value: 'hybrid', label: t('editorItem.anchors.hybrid') },
        ]}
        selected={form.kind}
        onSelect={(kind) => set({ kind })}
      />
      {form.kind !== 'weeks' && (
        <SegmentedControl
          testID="structure-unit"
          label={t('editorItem.budgetUnit')}
          choices={[
            { value: 'hours', label: t('editorItem.fields.hours') },
            { value: 'sessions', label: t('editorItem.fields.sessions') },
          ]}
          selected={form.unit}
          onSelect={(unit) => set({ unit })}
        />
      )}
      <Text accessibilityRole="header" style={[styles.label, align]}>
        {t('editorItem.templates')}
      </Text>
      {form.templates.map((one, at) => (
        <View key={at} style={styles.row}>
          <TextField
            editable={!busy}
            testID={`structure-template-id-${at}`}
            label={t('editorItem.templateId')}
            placeholder=""
            textDirection="ltr"
            value={one.id}
            onChangeText={(id) => template(at, { id })}
          />
          <TextField
            editable={!busy}
            testID={`structure-template-stages-${at}`}
            label={t('editorItem.templateStages')}
            placeholder=""
            multiline
            value={one.stages}
            onChangeText={(stages) => template(at, { stages })}
          />
          <Button
            disabled={busy}
            testID={`structure-template-remove-${at}`}
            label={t('editorItem.removeTemplate')}
            variant="plain"
            onPress={() => set({ templates: form.templates.filter((_, index) => index !== at) })}
          />
        </View>
      ))}
      <Button
        disabled={busy}
        testID="structure-template-add"
        label={t('editorItem.addTemplate')}
        variant="plain"
        onPress={() => set({ templates: [...form.templates, { id: '', stages: '' }] })}
      />
      {(form.kind === 'weeks' || form.activities.length > 0) && (
        <>
          <Text accessibilityRole="header" style={[styles.label, align]}>
            {t('editorItem.activities')}
          </Text>
          <Text style={[styles.body, align]}>{t('editorItem.numberHint')}</Text>
          {form.activities.map((one, at) => (
            <View key={at} style={styles.row}>
              <TextField
                editable={!busy}
                testID={`structure-activity-code-${at}`}
                label={t('editorItem.activityCode')}
                placeholder=""
                textDirection="ltr"
                value={one.code}
                onChangeText={(code) => activity(at, { code })}
              />
              {(['ar', 'fr', 'en'] as const).map((lang) => (
                <TextField
                  editable={!busy}
                  key={lang}
                  testID={`structure-activity-${lang}-${at}`}
                  label={t(`editorItem.activityName.${lang}`)}
                  placeholder=""
                  value={one.name[lang] ?? ''}
                  textDirection={lang === 'ar' ? 'rtl' : 'ltr'}
                  onChangeText={(text) => {
                    const name = { ...one.name };
                    if (text.trim() === '') delete name[lang];
                    else name[lang] = text;
                    activity(at, { name });
                  }}
                />
              ))}
              <TextField
                editable={!busy}
                testID={`structure-activity-count-${at}`}
                label={t('editorItem.weeklySessions')}
                placeholder=""
                inputMode="numeric"
                textDirection="ltr"
                value={one.sessions}
                onChangeText={(sessions) => activity(at, { sessions, retyped: '' })}
              />
              <TextField
                editable={!busy}
                testID={`structure-activity-retyped-${at}`}
                label={t('editorItem.retype', { field: t('editorItem.weeklySessions') })}
                placeholder=""
                inputMode="numeric"
                textDirection="ltr"
                value={one.retyped}
                onChangeText={(retyped) => activity(at, { retyped })}
              />
              <Button
                disabled={busy}
                testID={`structure-activity-remove-${at}`}
                label={t('editorItem.removeActivity')}
                variant="plain"
                onPress={() => set({ activities: form.activities.filter((_, index) => index !== at) })}
              />
            </View>
          ))}
          {form.kind === 'weeks' && (
            <Button
              disabled={busy}
              testID="structure-activity-add"
              label={t('editorItem.addActivity')}
              variant="plain"
              onPress={() =>
                set({ activities: [...form.activities, { code: '', name: {}, sessions: '', retyped: '' }] })
              }
            />
          )}
        </>
      )}
      {invalid && (
        <Text testID="structure-problems" accessibilityRole="alert" style={[styles.error, align]}>
          {t('editorItem.structureProblem')}
        </Text>
      )}
      <View style={styles.actions}>
        <Button disabled={busy} testID="structure-save" label={t('editorItem.save')} onPress={save} />
        <Button
          disabled={busy}
          testID="structure-cancel"
          label={t('editorItem.cancel')}
          variant="plain"
          onPress={onCancel}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: spacing['space-12'], minWidth: 0 },
  row: {
    gap: spacing['space-8'],
    padding: spacing['space-12'],
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
  },
  heading: { ...typography.h2, color: colors.ink },
  label: { ...typography.label, color: colors.ink },
  body: { ...typography.body, color: colors.ink },
  error: { ...typography.body, color: colors['error-ink'] },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing['space-8'] },
});
