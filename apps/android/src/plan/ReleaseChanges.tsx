// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The head of «إصدار جديد للمخطط» (#322, Pack-release): the plan and its
// newer release with the number of fixes since the class's own, who signed
// it, bundled with the app or added from a signed file with its key's
// fingerprint, and «ما تغيّر», each change by kind, a renamed item with the
// note that no class loses its place.

import { packKey, parsePackId, releaseChanges, type Migration, type PlanPack } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { Text, View } from 'react-native';
import { Badge } from '../components/Badge';
import { spacing } from '../design/tokens';
import { fingerprintText } from '../calendar/UpdateDetails';
import { localized } from '../setup/names';
import { settingsStyles as styles } from '../settings/styles';
import { useAppData } from '../storage/AppData';
import { useText } from '../text/i18n';
import { isolate } from '../week/grid-labels';
import { groupName } from './pack-labels';
import { changeRows } from './release-rules';

export function ReleaseChanges({ from, to, steps }: { from: PlanPack; to: PlanPack; steps: Migration }) {
  const t = useText();
  const { direction } = useLocale();
  const { state, profile, keys } = useAppData();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const parts = parsePackId(to.id);
  const changes = releaseChanges(from, to, steps);
  const added = state.addedPacks.find(
    (one) => packKey(one.update.pack.id, one.update.pack.release) === packKey(to.id, to.release),
  );
  const signer = added === undefined ? undefined : keys.find((key) => key.id === added.key);
  const rows = changeRows(t, changes);
  return (
    <View testID="release-changes" style={[styles.card, { gap: spacing['space-8'] }]}>
      <Text accessibilityRole="header" style={[styles.title, align]}>
        {t('packRelease.heading', {
          pack: parts === null ? isolate(to.id) : groupName(t, profile, parts),
          release: isolate(to.release),
        })}
      </Text>
      <Text style={[styles.sub, align]}>
        {t('packRelease.fixes', { count: changes.length, release: isolate(from.release) })}
      </Text>
      <View style={{ flexDirection: 'row', direction }}>
        <Badge variant="done" label={t('packRelease.signed')} />
      </View>
      {signer === undefined ? (
        <Text testID="release-bundled" style={[styles.body, align]}>
          {t('packRelease.bundled')}
        </Text>
      ) : (
        <>
          <Text testID="release-signer" style={[styles.body, align]}>
            {t('packRelease.imported', { holder: isolate(localized(signer.holder)) })}
          </Text>
          <Text style={[styles.sub, align]}>{t('packRelease.fingerprint')}</Text>
          <Text selectable style={[styles.body, align]}>
            {fingerprintText(signer.fingerprint)}
          </Text>
        </>
      )}
      <Text accessibilityRole="header" style={[styles.title, align]}>
        {t('packRelease.changed')}
      </Text>
      {rows.map((row, index) => (
        <View key={index} testID={`release-change-${index}`} style={{ gap: spacing['space-4'] }}>
          <Text style={[styles.sub, align]}>{row.kind}</Text>
          <Text style={[styles.body, align]}>{row.text}</Text>
          {changes[index]?.kind === 'title' && <Text style={[styles.sub, align]}>{t('packRelease.renamedNote')}</Text>}
        </View>
      ))}
    </View>
  );
}
