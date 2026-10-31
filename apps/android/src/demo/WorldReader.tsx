// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Reader mode inside a demo world (#563, answer 577): the statements the
// world's teachers share, opened, kept and compared on the world's own record
// book and dated by the world's date, under the band, with the bundled
// reference data and no trusted key, so nothing real-signed applies. Each
// statement checks against this world alone, and what is kept stays in the
// world's store, which leaving closes. A store whose kept world does not read
// as this one opens nothing. The pages follow one another as reader mode's
// routes do, the picture first, each said as it opens, as the world's home
// says its pages; going back, by the button or Android's back, goes to the
// page before, and from the picture back to the world's home.

import { keptWorld, type RandomBytes } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useEffect, useEffectEvent, useState } from 'react';
import { AccessibilityInfo, BackHandler, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { colors, spacing, typography } from '../design/tokens';
import { ReaderList } from '../reader/ReaderList';
import { ReaderMerge } from '../reader/ReaderMerge';
import { ReaderOpen } from '../reader/ReaderOpen';
import { ReaderPicture } from '../reader/ReaderPicture';
import { ReaderSpot } from '../reader/ReaderSpot';
import type { ReferenceResult } from '../reference';
import { AppDataProvider } from '../storage/AppData';
import { onPc, useDeviceText } from '../text/device-text';
import { DemoBand } from './DemoBand';
import type { OpenWorld } from './world-mode';

/** A page of reader mode in a world. */
type Page =
  | { readonly kind: 'picture' }
  | { readonly kind: 'list' }
  | { readonly kind: 'open'; readonly id?: string }
  | { readonly kind: 'spot'; readonly id: string }
  | { readonly kind: 'merge'; readonly grade: string };

const TITLES = {
  picture: 'reader.picture.title',
  list: 'reader.title',
  open: 'reader.open',
  spot: 'reader.spot.title',
  merge: 'reader.merge.title',
} as const satisfies Record<Page['kind'], string>;

/** How long the hidden words stay, in milliseconds, so browsing the page does not read them twice. */
const SAID_FOR = 5000;

export type WorldReaderProps = {
  readonly world: Pick<OpenWorld, 'book' | 'code' | 'date'>;
  /** The world's date, written out for the band. */
  readonly date: string;
  readonly reference: Extract<ReferenceResult, { ok: true }>;
  readonly random: RandomBytes;
  /** Back to the world's home. */
  readonly onClose: () => void;
};

/** Reader mode's pages on a world's own record book. */
export function WorldReader({ world, date, reference, random, onClose }: WorldReaderProps) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const insets = useSafeAreaInsets();
  const sides = { paddingLeft: insets.left + spacing['space-16'], paddingRight: insets.right + spacing['space-16'] };
  const [pages, setPages] = useState<readonly Page[]>([{ kind: 'picture' }]);
  const page = pages.at(-1)!;
  const go = (next: Page) => setPages([...pages, next]);
  const to = (kind: 'picture' | 'list') => {
    const at = pages.findIndex((one) => one.kind === kind);
    setPages(at < 0 ? [...pages, { kind }] : pages.slice(0, at + 1));
  };
  const back = () => (pages.length > 1 ? setPages(pages.slice(0, -1)) : onClose());
  const backKey = useEffectEvent(back);
  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      backKey();
      return true;
    });
    return () => handler.remove();
  }, []);
  const title = t(TITLES[page.kind]);
  const [said, setSaid] = useState('');
  const announce = useEffectEvent(() => (onPc() ? setSaid(title) : AccessibilityInfo.announceForAccessibility(title)));
  useEffect(() => {
    const timer = setTimeout(announce, 0);
    return () => clearTimeout(timer);
  }, [title]);
  useEffect(() => {
    if (said === '') return;
    const timer = setTimeout(() => setSaid(''), SAID_FOR);
    return () => clearTimeout(timer);
  }, [said]);
  const ours = keptWorld(world.book.entries)?.code === world.code;
  return (
    <View testID="world-reader" style={[styles.screen, { direction }]}>
      <DemoBand date={date} />
      {onPc() && (
        <Text testID="world-reader-said" accessibilityLiveRegion="polite" style={styles.hidden}>
          {said}
        </Text>
      )}
      <View style={[styles.bar, sides]}>
        <Button testID="world-reader-back" variant="plain" label={t('demo.entry.back')} onPress={back} />
        <Text accessibilityRole="header" style={[styles.title, { writingDirection: direction }]}>
          {title}
        </Text>
      </View>
      {!ours ? (
        <Text accessibilityRole="alert" style={[styles.problem, sides, { writingDirection: direction }]}>
          {t('demo.problem.store')}
        </Text>
      ) : (
        <AppDataProvider
          book={world.book}
          profile={reference.profile}
          year={reference.calendar.year}
          calendar={reference.calendar.entries}
          calendarRelease={reference.calendar.release}
          bells={reference.bells}
          packs={reference.packs}
          keys={[]}
          random={random}
          today={() => world.date}
        >
          {page.kind === 'picture' && (
            <ReaderPicture
              onOpen={(id) => go(id === undefined ? { kind: 'open' } : { kind: 'open', id })}
              onList={() => to('list')}
              onMerge={(grade) => go({ kind: 'merge', grade })}
            />
          )}
          {page.kind === 'list' && (
            <ReaderList
              onOpen={(id) => go(id === undefined ? { kind: 'open' } : { kind: 'open', id })}
              onPicture={() => to('picture')}
            />
          )}
          {page.kind === 'open' && (
            <ReaderOpen
              key={page.id ?? 'new'}
              {...(page.id !== undefined && { id: page.id })}
              onList={() => to('list')}
              onSpot={(id) => go({ kind: 'spot', id })}
            />
          )}
          {page.kind === 'spot' && <ReaderSpot id={page.id} />}
          {page.kind === 'merge' && <ReaderMerge grade={page.grade} onOpen={(id) => go({ kind: 'open', id })} />}
        </AppDataProvider>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['space-8'],
    paddingVertical: spacing['space-8'],
  },
  title: { ...typography['bar-title'], flexShrink: 1, color: colors.ink, textAlign: 'start' },
  hidden: { position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0 },
  problem: { ...typography.body, color: colors['error-ink'], paddingVertical: spacing['space-16'] },
});
