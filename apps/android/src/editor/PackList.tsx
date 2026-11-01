// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The packs page of the curator's PC workspace (#611, PRD section 4.2).
// Its list shows every supplied source release, with its declared status
// and provenance. Example packs stay visibly examples. Filters change
// only this view; no pack, teacher pin or record changes. Publishing and
// changing a draft's metadata belong to the release workflow (#612).
// While #515 has no pack-list board, this uses the existing components,
// following the demo's approach before design exports (answer 572).

import { PACK_STATUSES, type CountryProfile, type PlanPack } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Badge } from '../components/Badge';
import { ChipGroup } from '../components/Chip';
import { colors, radius, spacing, typography } from '../design/tokens';
import { groupName, packSource } from '../plan/pack-labels';
import { localized } from '../setup/names';
import { useDeviceText } from '../text/device-text';
import { isolate } from '../week/grid-labels';
import { editorPacks } from './pack-list';

export function PackList({
  packs,
  profile,
  refusedPacks = 0,
}: {
  readonly packs: readonly PlanPack[];
  readonly profile: CountryProfile;
  readonly refusedPacks?: number;
}) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: direction === 'rtl' ? 'right' : 'left' } as const;
  const [status, setStatus] = useState('all');
  const rows = editorPacks(packs);
  const shown = rows.filter(({ pack }) => status === 'all' || pack.status === status);
  return (
    <View testID="editor-packs" style={[styles.page, { direction }]}>
      <Text style={[styles.small, align]}>{t('editorPacks.intro')}</Text>
      {refusedPacks > 0 && (
        <Text accessibilityRole="alert" style={[styles.warning, align]}>
          {t('editorPacks.refused', { count: refusedPacks })}
        </Text>
      )}
      <ChipGroup
        testID="editor-status"
        label={t('editorPacks.filter')}
        choices={[
          { value: 'all', label: t('editorPacks.all') },
          ...PACK_STATUSES.map((value) => ({ value, label: t(`plan.status.${value}`) })),
        ]}
        selected={status}
        onSelect={setStatus}
      />
      <View accessibilityLiveRegion="polite" style={styles.page}>
        {shown.length === 0 && (
          <Text testID="editor-packs-empty" style={[styles.small, align]}>
            {t(rows.length === 0 ? 'editorPacks.empty' : 'editorPacks.noMatch')}
          </Text>
        )}
        {shown.map(({ pack, parts }) => (
          <View
            key={`${pack.id}@${pack.release}`}
            testID={`editor-pack-${pack.id}@${pack.release}`}
            style={styles.card}
          >
            <Text accessibilityRole="header" style={[styles.title, align]}>
              {groupName(t, profile, parts)}
            </Text>
            <Badge
              label={t(`plan.status.${pack.status}`)}
              variant={pack.status === 'stale' || pack.status === 'example' ? 'warning' : 'default'}
            />
            <Text style={[styles.small, align]}>{t(`plan.meaning.${pack.status}`)}</Text>
            {pack.status === 'stale' && pack.staleReason !== undefined && (
              <Text style={[styles.warning, align]}>{localized(pack.staleReason)}</Text>
            )}
            <Text style={[styles.small, align]}>{t('plan.release', { release: pack.release })}</Text>
            {pack.status !== 'example' && <Text style={[styles.small, align]}>{packSource(t, pack)}</Text>}
            <Text selectable style={[styles.code, align]}>
              {t('editorPacks.identity', { id: isolate(pack.id) })}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: spacing['space-12'] },
  card: {
    gap: spacing['space-8'],
    padding: spacing['space-16'],
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
  },
  title: { ...typography.label, color: colors.ink },
  small: { ...typography.small, color: colors.ink2 },
  code: { ...typography.small, color: colors.ink2, minWidth: 0, flexShrink: 1 },
  warning: { ...typography.small, color: colors['notice-ink'] },
});
