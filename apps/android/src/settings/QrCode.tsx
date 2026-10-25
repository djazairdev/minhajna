// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A QR code drawn from its modules (#247): dark ink on the sheet's light
// colour, inside a quiet zone of four modules, left to right whatever the
// interface's direction, as a scanner reads it. Each row is drawn as runs of
// one colour, so a code of 25 to 33 modules needs a few hundred views, and a
// statement's of up to 117 a few thousand. It is one image for a screen reader,
// named by `label`. The transfer's code (#247) and the progress statement's
// (Share-qr, #439) use it; it stays beside the transfer until a shared QR code
// joins the design system and its gallery.

import { StyleSheet, View } from 'react-native';
import { colors } from '../design/tokens';

const QUIET = 4;

/** The runs of one row: each run's colour and length, in modules. */
function runs(row: string): { dark: boolean; length: number }[] {
  const out: { dark: boolean; length: number }[] = [];
  for (const module of row) {
    const dark = module === '1';
    const last = out.at(-1);
    if (last?.dark === dark) last.length += 1;
    else out.push({ dark, length: 1 });
  }
  return out;
}

/** The code of `rows`, as `qrRows` gives them, `module` points to a module. */
export function QrCode({
  rows,
  label,
  module = 6,
  testID,
}: {
  readonly rows: string;
  readonly label: string;
  readonly module?: number;
  readonly testID?: string;
}) {
  const lines = rows.split('\n');
  const width = (lines[0]?.length ?? 0) * module;
  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      style={[styles.zone, { padding: QUIET * module }]}
    >
      <View style={[styles.code, { width }]}>
        {lines.map((line, y) => (
          <View key={y} style={[styles.row, { height: module }]}>
            {runs(line).map((run, x) => (
              <View
                key={x}
                style={{ width: run.length * module, backgroundColor: run.dark ? colors.ink : colors.sheet }}
              />
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  zone: { alignSelf: 'center', backgroundColor: colors.sheet },
  code: { direction: 'ltr' },
  row: { flexDirection: 'row' },
});
