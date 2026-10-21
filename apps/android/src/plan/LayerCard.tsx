// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// One district or school layer (#226, Plan-layers): its title, the badge
// that it is a variant and never official, who made it and how it came, a
// district layer signed by the key it names and a school layer from a
// sender the app cannot verify (answer 337), its note, every operation in
// the plan's words, and the terms they touch. On Plan-layers it ends with
// the class's own switch (answer 338); on the import screen, without one.

import { useLocale } from '@react-navigation/native';
import { Text, View } from 'react-native';
import { Badge } from '../components/Badge';
import { Switch } from '../components/Switch';
import { spacing } from '../design/tokens';
import { holderOf } from '../calendar/UpdateChanges';
import { settingsStyles as styles } from '../settings/styles';
import { useAppData } from '../storage/AppData';
import { useText } from '../text/i18n';
import { isolate } from '../week/grid-labels';
import type { LayerModel } from './layer-rules';

export type LayerCardProps = {
  readonly model: LayerModel;
  /** The class's name and its switch; none on the import screen. */
  readonly toggle?: { readonly className: string; readonly onChange: (on: boolean) => void };
};

export function LayerCard({ model, toggle }: LayerCardProps) {
  const t = useText();
  const { keys } = useAppData();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const { layer } = model;
  const by = isolate(layer.by);
  const came =
    model.signedBy === undefined
      ? t('planLayers.unverified', { by })
      : t('planLayers.signed', { by, signer: holderOf(keys, model.signedBy) });
  return (
    <View testID={`layer-${model.key}`} style={[styles.card, { gap: spacing['space-8'] }]}>
      <View accessible style={styles.group}>
        <Text accessibilityRole="header" style={[styles.title, align]}>
          {isolate(layer.title)}
        </Text>
        <View style={{ flexDirection: 'row', direction }}>
          <Badge label={t('planLayers.variant')} />
        </View>
        <Text style={[styles.body, align]}>{came}</Text>
        {layer.note !== undefined && <Text style={[styles.body, align]}>{isolate(layer.note)}</Text>}
      </View>
      {model.operations.map((one, index) => (
        <View
          key={index}
          accessible
          style={{ flexDirection: 'row', gap: spacing['space-8'], direction, alignItems: 'flex-start' }}
        >
          <Text style={styles.sub}>{t(`planChanges.kinds.${one.kind as 'move'}`)}</Text>
          <Text style={[styles.body, align, { flex: 1 }]}>{one.text}</Text>
        </View>
      ))}
      {model.terms !== null && <Text style={[styles.sub, align]}>{model.terms}</Text>}
      {toggle !== undefined && (
        <Switch
          testID={`layer-switch-${model.key}`}
          label={t('planLayers.apply', { title: isolate(layer.title), class: isolate(toggle.className) })}
          description={t(model.on ? 'planLayers.onLine' : 'planLayers.offLine', { class: isolate(toggle.className) })}
          value={model.on}
          onValueChange={toggle.onChange}
        />
      )}
    </View>
  );
}
