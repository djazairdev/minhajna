// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The roll call's samples: three figures that follow the marks, and a class
// of 45 made-up pupils in a virtualised list of its own height. The gallery
// is one long scroll view; the list scrolls inside it, so it is given no
// outer scroll context, which would turn its windowing off.

import { useState, type Context } from 'react';
import { FlatList, ScrollView, StyleSheet, View } from 'react-native';
import { RollCallRow } from '../components/RollCallRow';
import { Stats } from '../components/Stats';
import { spacing } from '../design/tokens';
import { madeUpClass, rollCallTexts } from './roll-call-texts';
import type { SampleProps } from './samples';

const OuterScroll = (ScrollView as unknown as { Context: Context<unknown> }).Context;

/** The figures and the 45 rows; marks change the figures, and are kept nowhere. */
export function RollCallSamples({ language }: SampleProps) {
  const text = rollCallTexts[language];
  const names = madeUpClass(text);
  const [absent, setAbsent] = useState<ReadonlySet<number>>(new Set([3]));
  const [late, setLate] = useState<ReadonlySet<number>>(new Set([7]));
  const toggle = (set: ReadonlySet<number>, index: number, on: boolean) => {
    const next = new Set(set);
    if (on) next.add(index);
    else next.delete(index);
    return next;
  };
  return (
    <View style={styles.group}>
      <Stats
        testID="stats"
        items={[
          { id: 'present', value: names.length - absent.size, label: text.present },
          { id: 'absent', value: absent.size, label: text.absent },
          { id: 'late', value: late.size, label: text.late },
        ]}
      />
      <OuterScroll.Provider value={null}>
        <FlatList
          testID="roll-list"
          style={styles.list}
          nestedScrollEnabled
          data={names}
          keyExtractor={(name) => name}
          initialNumToRender={12}
          renderItem={({ item, index }) => (
            <RollCallRow
              testID={`roll-${index + 1}`}
              number={index + 1}
              name={item}
              absent={absent.has(index)}
              late={late.has(index)}
              onAbsent={(on) => {
                setAbsent(toggle(absent, index, on));
                if (on) setLate(toggle(late, index, false));
              }}
              onLate={(on) => {
                setLate(toggle(late, index, on));
                if (on) setAbsent(toggle(absent, index, false));
              }}
            />
          )}
        />
      </OuterScroll.Provider>
    </View>
  );
}

/** Three figures, one of which could surprise and says why. */
export function StatsSamples({ language }: SampleProps) {
  const text = rollCallTexts[language];
  return (
    <View style={styles.group}>
      <Stats
        items={[
          { id: 'present', value: 35, label: text.present },
          { id: 'absent', value: 1, label: text.absent },
          { id: 'late', value: 1, label: text.late },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing['space-12'], paddingHorizontal: spacing['space-16'] },
  list: { height: 480 },
});
