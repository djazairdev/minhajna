// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A session of the world's day on the director's cover page (#586, D-Cover,
// R-7.7-04, R-7.7-06, answer 614): its span, class, subject and room, and
// whether it is the class's last session of the day; a button that marks it for
// cover, with supervision as the default, or unmarks it; once marked, the
// arrangements, letting the pupils go offered only on the class's last session,
// with a line saying so on the others; and for supervision, the study room or a
// free colleague, who takes it among the free colleagues, each with the covers
// they gave this term, between terms without them, and the suggestion marked,
// or that none is free, and that whoever the cover names is no longer free and
// is to choose again. Changing between arrangements in which someone takes the
// session keeps who takes it, and nothing else is kept while a change is.

import { COVER_ARRANGEMENTS, TAKEN_ARRANGEMENTS, type CoverArrangement } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { ChipGroup } from '../components/Chip';
import { colors, radius, spacing, typography } from '../design/tokens';
import { useDeviceText } from '../text/device-text';
import type { CoverSession } from './cover-session';

export type CoverCardProps = {
  readonly one: CoverSession;
  /** The session as the page writes it: its span, class, subject and room. */
  readonly text: string;
  /** Whether a change is being kept, so no other is pressed meanwhile. */
  readonly busy: boolean;
  /** Whether the world's date is in a term, whose covers each colleague is shown with. */
  readonly counted: boolean;
  /** Keeps an arrangement, with who takes it, or none to unmark the session. */
  readonly onCover: (arrangement: CoverArrangement | null, by: string | null) => void;
};

/** A session of the day: marked for cover or not, its arrangement and who takes it. */
export function CoverCard({ one, text, busy, counted, onCover }: CoverCardProps) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const arrangement = one.cover?.arrangement ?? null;
  const by = one.cover?.by ?? null;
  const offered = COVER_ARRANGEMENTS.filter((each) => each !== 'release' || one.last);
  const taken = arrangement !== null && TAKEN_ARRANGEMENTS.includes(arrangement);
  const person = (each: CoverSession['free'][number]) => {
    const suggested = each.id === one.suggested;
    if (!counted) return suggested ? t('demo.cover.nameSuggested', { name: each.name }) : each.name;
    return t(suggested ? 'demo.cover.personSuggested' : 'demo.cover.person', { name: each.name, count: each.count });
  };
  return (
    <View testID={arrangement === null ? 'cover-session' : 'cover-marked'} style={styles.card}>
      <Text accessibilityRole="header" style={[styles.head, align]}>
        {text}
      </Text>
      {one.last && <Text style={[styles.small, align]}>{t('demo.cover.lastOfDay')}</Text>}
      <Button
        testID="cover-mark"
        variant="line"
        label={t(arrangement === null ? 'demo.cover.mark' : 'demo.cover.unmark')}
        name={`${t(arrangement === null ? 'demo.cover.mark' : 'demo.cover.unmark')} ${text}`}
        disabled={busy}
        onPress={() => onCover(arrangement === null ? 'supervision' : null, null)}
      />
      {arrangement !== null && (
        <>
          <ChipGroup
            testID="cover-arrangement"
            label={t('demo.cover.arrangement')}
            hint={one.last ? undefined : t('demo.cover.release')}
            choices={offered.map((each) => ({ value: each, label: t(`demo.cover.arrangements.${each}`) }))}
            selected={arrangement}
            onSelect={(each) => {
              if (!busy && each !== arrangement) onCover(each, TAKEN_ARRANGEMENTS.includes(each) ? by : null);
            }}
          />
          {taken && one.taken !== null && (
            <Text style={[styles.small, align]}>{t('demo.cover.notFree', { name: one.taken.name })}</Text>
          )}
          {taken && one.free.length === 0 && <Text style={[styles.small, align]}>{t('demo.cover.noneFree')}</Text>}
          {taken && one.free.length > 0 && (
            <ChipGroup
              testID="cover-who"
              label={t('demo.cover.who')}
              choices={one.free.map((each) => ({ value: each.id, label: person(each) }))}
              selected={by}
              onSelect={(each) => {
                if (!busy && each !== by) onCover(arrangement, each);
              }}
            />
          )}
        </>
      )}
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
});
