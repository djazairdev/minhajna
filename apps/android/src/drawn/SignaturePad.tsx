// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The pad the signature is drawn on (#236, Signature, answer 411), three
// times as wide as it is high. A finger draws strokes; each one ends when it
// lifts, and only the points are passed on, never their timing. The pad is
// laid out left to right whatever the language, so touches and drawing agree,
// and its pieces take no touches, so every touch is read against the pad.
// The strokes already kept are drawn apart, so a move redraws only the
// stroke under the finger. TalkBack hears whether a signature is drawn.

import type { Point } from '@minhajna/core';
import { memo, useRef, useState } from 'react';
import { StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';
import { colors, radius, spacing, typography } from '../design/tokens';
import { piecesOf } from './strokes';

const INK = 3;
const STEP = 2;

export type SignaturePadProps = {
  readonly strokes: readonly (readonly Point[])[];
  readonly label: string;
  readonly status: string;
  readonly hint: string;
  readonly empty: string;
  readonly onWidth: (width: number) => void;
  readonly onDrawing: (drawing: boolean) => void;
  readonly onStroke: (stroke: Point[]) => void;
};

/** Strokes as straight pieces of ink, taking no touches. */
const Ink = memo(function Ink({ strokes }: { strokes: readonly (readonly Point[])[] }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {strokes.flatMap((stroke, which) =>
        piecesOf(stroke).map((piece, index) => (
          <View
            key={`${which}-${index}`}
            style={[
              styles.piece,
              {
                left: piece.x - (piece.length + INK) / 2,
                top: piece.y - INK / 2,
                width: piece.length + INK,
                transform: [{ rotate: `${piece.angle}rad` }],
              },
            ]}
          />
        )),
      )}
    </View>
  );
});

export function SignaturePad({ strokes, label, status, hint, empty, onWidth, onDrawing, onStroke }: SignaturePadProps) {
  const [current, setCurrent] = useState<Point[]>([]);
  const points = useRef<Point[]>([]);
  const at = (event: GestureResponderEvent) => ({ x: event.nativeEvent.locationX, y: event.nativeEvent.locationY });
  const end = () => {
    const stroke = points.current;
    points.current = [];
    setCurrent([]);
    onDrawing(false);
    if (stroke.length > 0) onStroke(stroke);
  };
  const touches = {
    onStartShouldSetResponder: () => true,
    onMoveShouldSetResponder: () => true,
    onResponderTerminationRequest: () => false,
    onResponderGrant: (event: GestureResponderEvent) => {
      onDrawing(true);
      points.current = [at(event)];
      setCurrent(points.current);
    },
    onResponderMove: (event: GestureResponderEvent) => {
      const point = at(event);
      const last = points.current[points.current.length - 1];
      if (last !== undefined && Math.hypot(point.x - last.x, point.y - last.y) < STEP) return;
      points.current = [...points.current, point];
      setCurrent(points.current);
    },
    onResponderRelease: end,
    onResponderTerminate: end,
  };
  return (
    <View
      testID="signature-pad"
      accessible
      accessibilityLabel={label}
      accessibilityValue={{ text: status }}
      accessibilityHint={hint}
      onLayout={(event) => onWidth(event.nativeEvent.layout.width)}
      style={styles.pad}
      {...touches}
    >
      {strokes.length === 0 && current.length === 0 && (
        <Text style={styles.empty} pointerEvents="none">
          {empty}
        </Text>
      )}
      <Ink strokes={strokes} />
      {current.length > 0 && <Ink strokes={[current]} />}
    </View>
  );
}

const styles = StyleSheet.create({
  pad: {
    direction: 'ltr',
    width: '100%',
    aspectRatio: 3,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
    overflow: 'hidden',
  },
  empty: { ...typography.caption, color: colors.ink2, padding: spacing['space-8'] },
  piece: { position: 'absolute', height: INK, borderRadius: INK / 2, backgroundColor: colors.signature },
});
