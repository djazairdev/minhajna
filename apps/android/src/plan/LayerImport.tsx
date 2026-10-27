// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Importing a district or school layer without a network (#226, answers
// 337, 338 and 343), from a class's Plan-layers: a file or a QR code. A
// layer that reads is shown as that class would read it, with every
// operation, before the teacher takes it in; taking it in switches nothing
// on, and the app goes back to Plan-layers. A refused file says why, and a
// layer of another pack, one already taken in, or another under the same
// ID is not taken in.

import { addLayer, layerAddStatus } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useMemo } from 'react';
import { ScrollView, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { canScan } from '../components/device-abilities';
import { Button } from '../components/Button';
import { Notice } from '../components/Notice';
import { controlIcon } from '../design/Icon';
import { spacing } from '../design/tokens';
import { SaveProblem } from '../calendar/SaveProblem';
import { useCalendarSave } from '../calendar/useCalendarSave';
import { settingsStyles as styles } from '../settings/styles';
import { coreContext } from '../storage/core-context';
import { useAppData } from '../storage/AppData';
import { useDeviceText } from '../text/device-text';
import { isolate } from '../week/grid-labels';
import { LayerCard } from './LayerCard';
import { layerModel } from './layer-rules';
import { packOfPin } from './plan-rules';
import { useLayerInput } from './useLayerInput';

export type LayerImportProps = {
  readonly courseId: string;
  readonly onTaken: () => void;
};

export function LayerImport({ courseId, onTaken }: LayerImportProps) {
  const t = useDeviceText();
  const data = useAppData();
  const { direction } = useLocale();
  const insets = useSafeAreaInsets();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const input = useLayerInput();
  const writer = useCalendarSave();
  const busy = input.busy || writer.busy;
  const { opened } = input;
  const course = data.state.courses.get(courseId);
  const className = isolate(data.state.classes.get(course?.classId ?? '')?.name ?? '');
  const shown = useMemo(() => {
    if (opened?.ok !== true) return null;
    const { layer, signed } = opened.added;
    const context = coreContext(data);
    const pin = data.state.courses.get(courseId)?.pack ?? null;
    const base = packOfPin(data.packs, pin);
    const options = { on: false, ...(signed !== undefined && { signedBy: signed.key }) };
    return {
      model: layerModel(t, context, courseId, base, layer, options),
      status: layerAddStatus(data.state, layer),
      ours: pin?.id === layer.pack,
      state: data.state,
    };
  }, [opened, data, t, courseId]);
  const take = async () => {
    if (opened?.ok !== true || shown?.status !== 'new' || !shown.ours || writer.isBusy()) return;
    let event;
    try {
      event = addLayer(data.state, opened.added);
    } catch {
      return;
    }
    if (await writer.save(event, shown.state)) onTaken();
  };
  const note = (message: string, testID: string) => (
    <Notice testID={testID} icon={controlIcon('info')} message={message} />
  );
  return (
    <ScrollView
      style={styles.screen}
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
      <Text style={[styles.body, align]}>{t('planLayers.importIntro')}</Text>
      <Button
        testID="layer-file"
        label={t('planLayers.file')}
        disabled={busy}
        onPress={() => void input.read('file')}
      />
      {canScan() && (
        <Button
          testID="layer-qr"
          variant="line"
          label={t('planLayers.qr')}
          disabled={busy}
          onPress={() => void input.read('qr')}
        />
      )}
      {input.busy && <Text style={[styles.sub, align]}>{t('planLayers.reading')}</Text>}
      {input.unreadable && note(t('planLayers.problems.input'), 'layer-unreadable')}
      {opened?.ok === false && note(t(`planLayers.problems.${opened.problem}`), 'layer-refused')}
      {shown !== null && <LayerCard model={shown.model} />}
      {shown !== null && !shown.ours && note(t('planLayers.otherPack', { class: className }), 'layer-other-pack')}
      {shown?.ours === true && shown.status !== 'new' && note(t(`planLayers.${shown.status}`), 'layer-status')}
      <SaveProblem testID="layer-save-failed" problem={writer.problem} />
      {shown?.ours === true && shown.status === 'new' && (
        <Button testID="layer-take" label={t('planLayers.take')} disabled={busy} onPress={take} />
      )}
    </ScrollView>
  );
}
