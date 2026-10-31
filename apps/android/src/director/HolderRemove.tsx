// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Removing a device that holds the school key, from its box's panel on a holder
// in a demo world (#571, answers 555, 558 and 600): the design's question
// first, that nothing new reaches it and the key stays on the other devices;
// once removed, the page says so, and when it had made the recovery, the
// recovery's new parts are handed to the page to show and print as part 2 does.
// A problem is said in the world's words.

import { useLocale } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import type { OpenWorld } from '../demo/world-mode';
import type { Send, WorldKit } from '../demo/world-session';
import { colors, spacing, typography } from '../design/tokens';
import { problemOf } from '../school/school-join-session';
import { useDeviceText } from '../text/device-text';
import { isolate } from '../week/grid-labels';
import { removeHolderDevice } from './holders-session';
import type { MadeRecovery } from './keys-session';
import type { IssueDesk } from './school-desk';

export type HolderRemoveProps = {
  readonly world: Pick<OpenWorld, 'world' | 'book' | 'date'>;
  readonly desk: IssueDesk;
  /** The device to remove. */
  readonly device: string;
  /** The device's name, as its box says it. */
  readonly name: string;
  readonly kit: WorldKit;
  readonly send?: Send;
  /** The device is removed, with the recovery's new parts when it had made it. */
  readonly onRemoved: (renewed: MadeRecovery | null) => void;
};

/** The button that removes a device, after the design's question. */
export function HolderRemove({ world, desk, device, name, kit, send, onRemoved }: HolderRemoveProps) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<string | null>(null);
  const removing = useRef(false);
  const open = useRef(true);
  useEffect(() => {
    open.current = true;
    return () => {
      open.current = false;
    };
  }, []);

  const remove = () => {
    if (removing.current) return;
    removing.current = true;
    setBusy(true);
    setSaid(null);
    void removeHolderDevice(world, desk, device, kit, send)
      .then(({ parts, fingerprint }) => {
        if (open.current) setAsking(false);
        onRemoved(parts === null ? null : { parts, fingerprint });
      })
      .catch((error: unknown) => open.current && setSaid(t(problemOf(error) as 'demo.problem.other')))
      .finally(() => {
        removing.current = false;
        if (open.current) setBusy(false);
      });
  };

  return (
    <View testID="keys-remove" style={styles.part}>
      {asking ? (
        <>
          <Text testID="keys-remove-ask" accessibilityLiveRegion="polite" style={[styles.head, align]}>
            {t('demo.keys.remove.ask', { device: isolate(name) })}
          </Text>
          <Button
            testID="keys-remove-yes"
            variant="danger"
            label={t('demo.keys.remove.yes')}
            disabled={busy}
            onPress={remove}
          />
          <Button
            testID="keys-remove-cancel"
            variant="line"
            label={t('demo.keys.recovery.cancel')}
            disabled={busy}
            onPress={() => setAsking(false)}
          />
        </>
      ) : (
        <Button
          testID="keys-remove-open"
          variant="line"
          label={t('demo.keys.remove.button', { device: isolate(name) })}
          onPress={() => setAsking(true)}
        />
      )}
      <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={[styles.small, align]}>
        {said ?? ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  part: { gap: spacing['space-8'] },
  head: { ...typography.label, color: colors.ink },
  small: { ...typography.small, color: colors.ink2 },
});
