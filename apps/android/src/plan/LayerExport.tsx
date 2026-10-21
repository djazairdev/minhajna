// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The coordinator's school layer (#226, answers 337, 342 and 345): built
// from a class's changes in force, in their order, named and credited by
// the teacher, shown exactly as colleagues will read it, then handed to
// Android's share sheet as a file. Nothing is recorded and no class
// changes; an edit after a share makes a new layer, under a new ID (answer
// 341). The name of who made it goes only as the teacher types it; the
// file holds no pupil, mark, roll call or recorded session. A file another
// teacher could not read back is never shared.

import { isOneLine, layerFile, layerFromChanges, type PlanLayer } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useMemo, useRef, useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { TextField } from '../components/TextField';
import { spacing } from '../design/tokens';
import NativeInput from '../native/NativeMinhajnaCalendarInput';
import { settingsStyles as styles } from '../settings/styles';
import { coreContext } from '../storage/core-context';
import { useAppData } from '../storage/AppData';
import { useText } from '../text/i18n';
import { isolate } from '../week/grid-labels';
import { plain } from './error-report';
import { LayerCard } from './LayerCard';
import { layerModel } from './layer-rules';
import { packOfPin } from './plan-rules';

export type LayerExportProps = { readonly courseId: string };

export function LayerExport({ courseId }: LayerExportProps) {
  const t = useText();
  const data = useAppData();
  const { direction } = useLocale();
  const insets = useSafeAreaInsets();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const [id, setId] = useState(() => data.newId());
  const [made] = useState(() => data.today());
  const [shared, setShared] = useState(false);
  const sharing = useRef(false);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState('');
  const [by, setBy] = useState('');
  const [note, setNote] = useState('');
  const [outcome, setOutcome] = useState<'shared' | 'failed' | null>(null);
  const className = data.state.classes.get(data.state.courses.get(courseId)?.classId ?? '')?.name ?? '';
  const built = useMemo(() => {
    const context = coreContext(data);
    let layer: PlanLayer;
    try {
      const about = { id, title: title.trim(), by: by.trim(), made };
      layer = layerFromChanges(context, courseId, note.trim() === '' ? about : { ...about, note: note.trim() });
    } catch {
      return null;
    }
    const base = packOfPin(data.packs, data.state.courses.get(courseId)?.pack ?? null);
    const words =
      isOneLine(layer.title, 160) &&
      isOneLine(layer.by, 160) &&
      (layer.note === undefined || isOneLine(layer.note, 500));
    return {
      model: layerModel(t, context, courseId, base, layer, { on: false }),
      file: words ? layerFile(layer, data.profile) : null,
      words,
    };
  }, [data, t, courseId, id, made, title, by, note]);
  const edit = (set: (value: string) => void) => (value: string) => {
    set(plain(value).replace(/[\r\n\t]+/g, ' '));
    if (!shared) return;
    setId(data.newId());
    setShared(false);
  };
  const share = () => {
    if (built?.file == null || sharing.current) return;
    sharing.current = true;
    setBusy(true);
    setOutcome(null);
    NativeInput.shareText(`minhajna-layer-${made}.json`, built.file, t('planLayers.export.shareTitle'))
      .then(
        () => {
          setShared(true);
          setOutcome('shared');
        },
        () => setOutcome('failed'),
      )
      .finally(() => {
        sharing.current = false;
        setBusy(false);
      });
  };
  return (
    <ScrollView
      style={styles.screen}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[
        styles.content,
        {
          direction,
          paddingLeft: insets.left + spacing['space-16'],
          paddingRight: insets.right + spacing['space-16'],
          paddingBottom: insets.bottom + spacing['space-24'],
        },
      ]}
    >
      <Text style={[styles.body, align]}>{t('planLayers.export.intro', { class: isolate(className) })}</Text>
      {built === null ? (
        <Text testID="export-none" style={[styles.sub, align]}>
          {t('planLayers.export.none')}
        </Text>
      ) : (
        <>
          <TextField
            testID="export-title"
            label={t('planLayers.export.name')}
            placeholder={t('planLayers.export.namePlaceholder')}
            value={title}
            maxLength={160}
            onChangeText={edit(setTitle)}
          />
          <TextField
            testID="export-by"
            label={t('planLayers.export.by')}
            placeholder={t('planLayers.export.byPlaceholder')}
            value={by}
            maxLength={160}
            onChangeText={edit(setBy)}
          />
          <TextField
            testID="export-note"
            label={t('planLayers.export.note')}
            optionalLabel={t('planLayers.export.optional')}
            placeholder={t('planLayers.export.notePlaceholder')}
            value={note}
            maxLength={500}
            onChangeText={edit(setNote)}
          />
          <Text accessibilityRole="header" style={[styles.title, align]}>
            {t('planLayers.export.preview')}
          </Text>
          <LayerCard model={built.model} />
          <Text style={[styles.sub, align]}>{t('planLayers.export.holds')}</Text>
          {!built.words && (
            <Text testID="export-needs" style={[styles.sub, align]}>
              {t('planLayers.export.needs')}
            </Text>
          )}
          {built.words && built.file === null && (
            <Text testID="export-too-big" style={[styles.sub, align]}>
              {t('planLayers.export.tooBig')}
            </Text>
          )}
          <Button
            testID="export-share"
            label={t('planLayers.export.share')}
            disabled={built.file === null || busy}
            onPress={share}
          />
          {outcome !== null && (
            <Text testID={`export-${outcome}`} accessibilityLiveRegion="polite" style={[styles.sub, align]}>
              {t(`planLayers.export.${outcome}`)}
            </Text>
          )}
        </>
      )}
    </ScrollView>
  );
}
