// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// D-Exchange's export of the school's space whole (#592, R-7.11-02, answer
// 620): what the file holds, everything the relay keeps for the space, sealed
// as it is and never opened, so only the school key and the teachers' own keys
// read it, and that it says it comes from a demo world; a button that reads
// every batch of the space page after page, a batch that does not decode
// stopping it, writes them as one minhajna/space-export/1 text, each stream in
// the relay's order, named by the world and its date, and asks where to keep
// it through the system's file picker, once at a time; it waits for the school
// key on this device, which names the space, and says so. Making the file, the
// file kept, the picker cancelled, a problem reading the space in the world's
// words and a file not made or kept are said.

import { spaceExportText } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import type { OpenWorld } from '../demo/world-mode';
import type { Send } from '../demo/world-session';
import { colors, radius, spacing, typography } from '../design/tokens';
import files from '../native/NativeMinhajnaFiles';
import { worldRequest } from '../network/world-network';
import { problemOf } from '../school/school-join-session';
import { spaceBatches } from '../school/space-read';
import { useDeviceText } from '../text/device-text';

type Making =
  | { readonly kind: 'idle' | 'making' | 'saved' | 'cancelled' }
  | { readonly kind: 'failed'; readonly problem: ReturnType<typeof problemOf> | 'demo.exchange.export.failed' };

export type SpaceExportProps = {
  readonly world: Pick<OpenWorld, 'world' | 'date'>;
  /** The school's space this device holds the key of, or null. */
  readonly school: string | null;
  readonly send?: Send;
};

/** Exports the school's space whole, sealed, to a file the director keeps. */
export function SpaceExport({ world, school, send = worldRequest }: SpaceExportProps) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const [making, setMaking] = useState<Making>({ kind: 'idle' });
  const busy = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const run = () => {
    if (school === null || busy.current) return;
    busy.current = true;
    setMaking({ kind: 'making' });
    const head = { world: world.world, school, exported: world.date };
    const name = `minhajna-space-${world.world}-${world.date}.json`;
    const end = (next: Making) => {
      if (mounted.current) setMaking(next);
    };
    spaceBatches(world.world, school, send, { whole: true })
      .then(
        (streams) =>
          Promise.resolve()
            .then(() => files.makeText(spaceExportText(head, streams), name, ''))
            .then((token) => files.saveFile(token))
            .then(
              (saved) => end({ kind: saved ? 'saved' : 'cancelled' }),
              () => end({ kind: 'failed', problem: 'demo.exchange.export.failed' }),
            ),
        (error: unknown) => end({ kind: 'failed', problem: problemOf(error) }),
      )
      .finally(() => {
        busy.current = false;
      });
  };
  const said =
    making.kind === 'failed'
      ? t(making.problem)
      : making.kind === 'idle'
        ? ''
        : t(`demo.exchange.export.${making.kind}`);
  return (
    <View testID="exchange-export" style={styles.card}>
      <Text accessibilityRole="header" style={[styles.head, align]}>
        {t('demo.exchange.export.title')}
      </Text>
      <Text style={[styles.small, align]}>{t('demo.exchange.export.line')}</Text>
      <Button
        testID="exchange-export-button"
        variant="line"
        label={t('demo.exchange.export.button')}
        disabled={school === null || making.kind === 'making'}
        onPress={run}
      />
      <Text
        testID="exchange-export-said"
        accessibilityLiveRegion="polite"
        {...(making.kind === 'failed' ? { accessibilityRole: 'alert' as const } : {})}
        style={[making.kind === 'failed' ? styles.problem : styles.small, align]}
      >
        {school === null ? t('demo.exchange.export.noKey') : said}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
    padding: spacing['space-16'],
    gap: spacing['space-8'],
  },
  head: { ...typography.label, color: colors.ink },
  small: { ...typography.small, color: colors.ink2 },
  problem: { ...typography.body, color: colors['error-ink'] },
});
