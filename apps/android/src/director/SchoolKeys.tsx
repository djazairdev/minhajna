// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// D-Keys, who holds the school key in a national demo world (#571, §6.5, answer
// 599), as the design draws it, under the workspace's title: the school, the
// world's date and what the page shows; tabs for the holders and the recovery;
// how many devices hold the key, and a warning when more than one holder looks
// like a recovery; on the PC, React Flow's read-only map (keys-map.ts), with
// the panel of the box chosen beside it; and on every device the map's boxes
// written out in groups, each a button that shows what the panel says of it,
// said as it changes. The holders' tab opens on the key, the recovery's on the
// recovery, and adds the keyring's fingerprint, to compare with another holder,
// and the recovery's making (KeysRecovery.tsx). Under them: the map shows at
// once who holds the key, what it opens and who never holds it, and no device
// is linked by dragging on it. Answer 600 adds the holders: on the holders'
// tab, adding a device from its one-time code (HolderAdd.tsx), and in the panel
// of another holder's box, removing it (HolderRemove.tsx), whose renewed
// recovery opens the recovery's tab; that tab warns when the recovery's maker
// no longer holds the key. A device that holds no key chooses how to hold one
// (KeysStart.tsx) or waits to be added (HolderWait.tsx) instead of the tabs.
// Until the key is held the page says it is opening; a problem is said in the
// world's words.

import type { Day, DemoSchool } from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SegmentedControl } from '../components/SegmentedControl';
import type { OpenWorld } from '../demo/world-mode';
import type { Send, WorldKit } from '../demo/world-session';
import { colors, radius, spacing, typography } from '../design/tokens';
import { useDrawing } from '../drawing/drawing-kit';
import { onPc, useDeviceText } from '../text/device-text';
import { isolate } from '../week/grid-labels';
import { personName } from './dashboard-text';
import { HolderAdd } from './HolderAdd';
import { HolderRemove } from './HolderRemove';
import { HolderWait } from './HolderWait';
import { keysMap, type KeysBox } from './keys-map';
import { KeysRecovery } from './KeysRecovery';
import { KeysStart } from './KeysStart';
import { useKeysPage } from './use-keys-page';

type KeysTab = 'holders' | 'recovery';

export type SchoolKeysProps = {
  readonly world: Pick<OpenWorld, 'world' | 'book' | 'date'>;
  readonly school: DemoSchool;
  readonly kit: WorldKit;
  readonly send?: Send;
  /** A day of the world, written out as the band writes it. */
  readonly dayText: (day: Day) => string;
};

/** The director's map of the school key. */
export function SchoolKeys({ world, school, kit, send, dayText }: SchoolKeysProps) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const align = { writingDirection: direction, textAlign: 'start' } as const;
  const drawing = useDrawing();
  const page = useKeysPage(world, school, kit, send);
  const [tab, setTab] = useState<KeysTab>('holders');
  const [chosen, setChosen] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const name = personName(school);
  const map = page.facts === null ? null : keysMap(t, page.facts, name, direction === 'rtl');
  const groups = map?.groups.filter((one) => (tab === 'recovery') === (one.id === 'recovery')) ?? [];
  const boxes = groups.flatMap((one) => one.boxes);
  const opening = tab === 'recovery' ? boxes.find((one) => one.id === 'recovery') : map?.key;
  const shown: KeysBox | null = boxes.find((one) => one.id === chosen) ?? opening ?? null;
  const many = (page.facts?.recoveries.length ?? 0) > 1;
  const removable = shown?.id.startsWith('holder-') === true && shown.id !== `holder-${page.facts?.own ?? ''}`;
  const lead = (
    <Text style={[styles.small, align]}>{t('demo.keys.lead', { school: name, date: dayText(world.date) })}</Text>
  );
  const problem = (
    <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={[styles.problem, align]}>
      {page.problem === null ? (note ?? '') : t(page.problem as 'demo.problem.other')}
    </Text>
  );
  if (page.mode === 'choose' || page.mode === 'waiting') {
    return (
      <View testID="school-keys" style={styles.page}>
        {lead}
        {problem}
        {page.mode === 'choose' ? (
          <KeysStart onStart={() => page.choose('start')} onWait={() => page.choose('wait')} />
        ) : (
          <HolderWait
            world={world}
            kit={kit}
            send={send}
            onDone={() => page.choose(null)}
            onWait={() => page.choose('wait')}
          />
        )}
      </View>
    );
  }
  return (
    <View testID="school-keys" style={styles.page}>
      {lead}
      <SegmentedControl
        testID="keys-tab"
        label={t('demo.keys.tabs')}
        choices={[
          { value: 'holders', label: t('demo.keys.tab.holders') },
          { value: 'recovery', label: t('demo.keys.tab.recovery') },
        ]}
        selected={tab}
        onSelect={(one) => {
          setTab(one);
          setChosen(null);
          setNote(null);
        }}
      />
      {problem}
      {page.facts === null || map === null ? (
        <Text style={[styles.small, align]}>{page.busy ? t('demo.keys.opening') : ''}</Text>
      ) : (
        <>
          <Text style={[styles.head, align]}>{t('demo.keys.count', { number: page.facts.devices.length })}</Text>
          {many && (
            <Text testID="keys-many" style={[styles.problem, align]}>
              {t('demo.keys.many')}
            </Text>
          )}
          {tab === 'recovery' && page.orphaned && (
            <Text testID="keys-orphaned" style={[styles.problem, align]}>
              {t('demo.keys.orphaned')}
            </Text>
          )}
          {tab === 'recovery' && (
            <Text style={[styles.small, align]}>
              {t('demo.keys.fingerprint', { fingerprint: isolate(page.facts.fingerprint) })}
            </Text>
          )}
          {tab === 'holders' && page.desk !== null && (
            <HolderAdd world={world} desk={page.desk} kit={kit} send={send} onAdded={page.reload} />
          )}
          {tab === 'recovery' && page.desk !== null && (
            <KeysRecovery
              world={world}
              desk={page.desk}
              made={page.facts.recoveries.length > 0}
              kit={kit}
              send={send}
              school={name}
              dayText={dayText}
              recovery={page.recovery}
              setRecovery={page.setRecovery}
              making={page.making}
              setMaking={page.setMaking}
              said={page.said}
              setSaid={page.setSaid}
              onMade={page.reload}
            />
          )}
          <View style={onPc() ? styles.columns : styles.page}>
            <View style={onPc() ? styles.main : styles.page}>
              {drawing !== null && <drawing.Map testID="keys-map" spec={map.spec} />}
              {groups.map((group) => (
                <View key={group.id} testID={`keys-group-${group.id}`} style={styles.card}>
                  <Text accessibilityRole="header" style={[styles.head, align]}>
                    {group.label}
                  </Text>
                  {group.boxes.map((box) => (
                    <Pressable
                      key={box.id}
                      testID={`keys-box-${box.id}`}
                      accessibilityRole="button"
                      {...(onPc()
                        ? ({ 'aria-current': shown?.id === box.id ? 'true' : undefined } as object)
                        : { accessibilityState: { selected: shown?.id === box.id } })}
                      onPress={() => setChosen(box.id)}
                      style={[styles.box, shown?.id === box.id && styles.chosen]}
                    >
                      <Text style={[styles.label, align]}>{box.label}</Text>
                    </Pressable>
                  ))}
                </View>
              ))}
            </View>
            {shown !== null && (
              <View testID="keys-panel" accessibilityLiveRegion="polite" style={[styles.card, onPc() && styles.side]}>
                <Text style={[styles.small, align]}>{t('demo.keys.chosen')}</Text>
                <Text accessibilityRole="header" style={[styles.head, align]}>
                  {shown.label}
                </Text>
                {shown.rows === undefined ? (
                  <Text style={[styles.value, align]}>{shown.about}</Text>
                ) : (
                  shown.rows.map((row) => (
                    <View key={row.label} style={styles.fact}>
                      <Text style={[styles.factLabel, align]}>{row.label}</Text>
                      <Text style={[styles.value, styles.factValue, align]}>{row.value}</Text>
                    </View>
                  ))
                )}
                {removable && page.desk !== null && (
                  <HolderRemove
                    key={shown.id}
                    world={world}
                    desk={page.desk}
                    device={shown.id.slice('holder-'.length)}
                    name={shown.label}
                    kit={kit}
                    send={send}
                    onRemoved={(renewed) => {
                      if (renewed !== null) {
                        page.setRecovery(renewed);
                        setTab('recovery');
                      }
                      setNote(t(renewed === null ? 'demo.keys.remove.done' : 'demo.keys.remove.renewed'));
                      setChosen(null);
                      page.reload();
                    }}
                  />
                )}
              </View>
            )}
          </View>
        </>
      )}
      <Text style={[styles.small, align]}>{t('demo.keys.footer.map')}</Text>
      <Text style={[styles.small, align]}>{t('demo.keys.footer.buttons')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: spacing['space-12'] },
  columns: { flexDirection: 'row', gap: spacing['space-16'], alignItems: 'flex-start' },
  main: { flex: 2, minWidth: 0, gap: spacing['space-12'] },
  side: { flex: 1, minWidth: 0 },
  fact: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing['space-8'] },
  factLabel: { ...typography.small, color: colors.ink, minWidth: 72, flexShrink: 0 },
  factValue: { flexGrow: 1, flexBasis: 160 },
  card: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius['radius-card'],
    backgroundColor: colors.sheet,
    padding: spacing['space-16'],
    gap: spacing['space-4'],
  },
  box: {
    paddingVertical: spacing['space-8'],
    paddingHorizontal: spacing['space-8'],
    borderRadius: radius['radius-card'],
  },
  chosen: { backgroundColor: colors.well, borderStartWidth: 4, borderStartColor: colors.ink },
  head: { ...typography.label, color: colors.ink },
  label: { ...typography.label, color: colors.ink },
  value: { ...typography.small, color: colors.ink2 },
  small: { ...typography.small, color: colors.ink2 },
  problem: { ...typography.body, color: colors['error-ink'] },
});
