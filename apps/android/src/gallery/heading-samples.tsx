// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { IconButton } from '../components/IconButton';
import { PageHeading } from '../components/PageHeading';
import { SectionHeader } from '../components/SectionHeader';
import type { ControlIcon } from '../components/control';
import { colors, spacing, typography } from '../design/tokens';
import { fill, type Sample } from './samples';

/** Geometric decorations keep the gallery offline and add no extra spoken names. */
const information: ControlIcon = ({ size, color }) => (
  <View
    style={{
      width: size,
      height: size,
      borderWidth: 1.5,
      borderColor: color,
      borderRadius: size / 2,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
    }}
  >
    <View style={{ width: 2, height: 2, backgroundColor: color }} />
    <View style={{ width: 2, height: 6, backgroundColor: color }} />
  </View>
);

const settings: ControlIcon = ({ size, color }) => (
  <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
    {[0, 45, 90, 135].map((angle) => (
      <View
        key={angle}
        style={{
          position: 'absolute',
          width: 3,
          height: size,
          backgroundColor: color,
          transform: [{ rotate: `${angle}deg` }],
        }}
      />
    ))}
    <View
      style={{
        width: size * 0.72,
        height: size * 0.72,
        borderWidth: 2,
        borderColor: color,
        backgroundColor: colors.paper,
        borderRadius: size,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        style={{ width: size * 0.27, height: size * 0.27, borderWidth: 1.5, borderColor: color, borderRadius: size }}
      />
    </View>
  </View>
);

/** Today with real action targets, a long title, and a name/scope-only screen heading. */
export function PageHeadingSamples({ sample }: { sample: Sample }) {
  const [count, setCount] = useState(0);
  const words = sample.headings;
  const activate = () => setCount((previous) => previous + 1);
  const actions = (
    <>
      <IconButton testID="heading-settings" icon={settings} accessibilityLabel={words.settings} onPress={activate} />
      <Button testID="heading-add" variant="line" label={words.addSession} onPress={activate} />
    </>
  );
  const fact = { text: words.fact, icon: information };
  return (
    <View style={styles.group}>
      <PageHeading title={words.day} scope={words.date} fact={fact} actions={actions} />
      <PageHeading
        title={sample.longHeading}
        scope={words.date}
        fact={fact}
        actions={<Button variant="line" label={sample.buttons.line} onPress={activate} />}
      />
      <PageHeading title={sample.tabs[1]} scope={words.scope} />
      <Text accessibilityLiveRegion="polite" style={styles.note}>
        {fill(sample.activations, { count })}
      </Text>
    </View>
  );
}

/** Plain, counted, empty and actionable sections, plus a long label; callbacks change only a synthetic count. */
export function SectionHeaderSamples({ sample }: { sample: Sample }) {
  const [count, setCount] = useState(0);
  const words = sample.headings;
  return (
    <View style={styles.group}>
      <SectionHeader label={words.section} />
      <SectionHeader label={words.section} count={words.count} />
      <SectionHeader label={words.section} count={words.emptyCount} />
      <SectionHeader
        label={words.section}
        action={
          <Button
            testID="section-edit"
            variant="plain"
            label={sample.buttons.line}
            onPress={() => setCount((previous) => previous + 1)}
          />
        }
      />
      <SectionHeader label={sample.longHeading} count={words.count} />
      <Text accessibilityLiveRegion="polite" style={styles.note}>
        {fill(sample.activations, { count })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing['space-12'] },
  note: { ...typography.caption, color: colors.ink2, paddingHorizontal: spacing['space-16'] },
});
