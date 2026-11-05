// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Pack-release inside a world (#617, R-4.2-12, R-4.2-27, answer 771): a new
// release, who signed it, as the account the server signed each step for, and
// for each class on its own what changed and a choice to move it or to stay,
// a move kept in the world's store, dated by the world, and a stay kept as
// nothing. Publishing moved no class. The teacher's history stays shut through
// all of it, and the release counts only here, as the app refuses a world's
// signature outside it.

import { keptWorld, packReleaseKey, type Day, type KeptPackPin, type PackRelease, type PlanPack } from '@minhajna/core';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { ChipGroup } from '../components/Chip';
import type { OpenWorld } from '../demo/world-mode';
import { editorStyles as s } from '../editor/editor-styles';
import { keepPackPin } from '../editor/pack-account';
import { changeRows } from '../plan/release-rules';
import { useDeviceText } from '../text/device-text';
import { isolate } from '../week/grid-labels';
import { chainPacks, coursesFor, latestPublished, moveOffer, pinOf, type WorldCourse } from './world-pack-rules';

const named = (course: WorldCourse) => `${course.class} · ${course.subject}`;

export function WorldPackMoves(props: {
  readonly open: Pick<OpenWorld, 'book'>;
  /** The world's date as the page read it. */
  readonly today: Day;
  readonly dayText: (day: Day) => string;
  /** Part of the history didn't read, so no release may be offered from it. */
  readonly damaged: boolean;
  readonly courses: readonly WorldCourse[];
  readonly records: ReadonlyMap<string, PackRelease>;
  readonly bundled: readonly PlanPack[];
}) {
  const t = useDeviceText();
  const { open, today, dayText, damaged, courses, records, bundled } = props;
  const [pins, setPins] = useState<Readonly<Record<string, KeptPackPin>>>(
    () => keptWorld(open.book.entries)?.packPins ?? {},
  );
  const [chosen, setChosen] = useState<Readonly<Record<string, string>>>({});
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(false);
  const [said, setSaid] = useState('');
  const packs = chainPacks(bundled, records);
  const move = async (course: WorldCourse, release: PackRelease) => {
    setBusy(true);
    setProblem(false);
    try {
      const { id, release: number } = release.pack;
      setPins(await keepPackPin({ book: open.book, date: today }, course.key, { id, release: number }));
      setSaid(t('editorDesk.teacher.moved', { class: named(course), release: isolate(number) }));
    } catch {
      setProblem(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <View testID="world-pack-moves" style={s.page}>
      <Text accessibilityRole="header" style={s.title}>
        {t('editorDesk.teacher.yourClasses')}
      </Text>
      {courses.length === 0 && <Text style={s.body}>{t('editorDesk.teacher.noClasses')}</Text>}
      {courses.map((course) => {
        const pin = pinOf(course, pins);
        const withdrawn = pin !== null && records.get(packReleaseKey(pin.id, pin.release))?.stage === 'withdrawn';
        return (
          <View key={course.key} testID="world-course" style={s.card}>
            <Text style={s.body}>
              {pin === null
                ? t('editorDesk.teacher.noPin', { class: named(course) })
                : t('editorDesk.teacher.onRelease', { class: named(course), release: isolate(pin.release) })}
            </Text>
            {pins[course.key]?.day !== undefined && (
              <Text style={s.body}>{t('editorDesk.teacher.movedOn', { day: dayText(pins[course.key].day) })}</Text>
            )}
            {withdrawn && <Text style={s.error}>{t('editorDesk.teacher.withdrawn')}</Text>}
          </View>
        );
      })}
      {said !== '' && (
        <Text testID="world-move-said" accessibilityRole="alert" style={s.body}>
          {said}
        </Text>
      )}
      {problem && (
        <Text accessibilityRole="alert" style={s.error}>
          {t('editorDesk.teacher.moveProblem')}
        </Text>
      )}
      {damaged && (
        <Text testID="world-damaged" accessibilityRole="alert" style={s.error}>
          {t('editorDesk.teacher.damaged')}
        </Text>
      )}
      {(damaged ? [] : latestPublished(records)).map((release) => {
        const offered = coursesFor(release, courses, pins);
        if (offered.length === 0) return null;
        const { id, release: number } = release.pack;
        const selected = offered.find((one) => one.key === chosen[id]) ?? offered[0];
        const pin = pinOf(selected, pins);
        const offer = moveOffer(pin, release.pack, packs);
        const rows = offer.kind === 'move' ? changeRows(t, offer.changes) : [];
        return (
          <View key={id} testID={`world-offer-${number}`} style={s.card}>
            <Text accessibilityRole="header" style={s.title}>
              {t('editorDesk.teacher.newRelease', { release: isolate(number) })}
            </Text>
            <Text style={s.body}>{isolate(id)}</Text>
            <Badge
              testID={`world-signed-${release.actor}`}
              label={t(
                release.actor === 'ministry'
                  ? 'editorDesk.teacher.signedMinistry'
                  : 'editorDesk.teacher.signedCurators',
              )}
              variant="done"
            />
            <Text style={s.body}>{t('editorDesk.teacher.worldOnly')}</Text>
            <Text style={s.body}>{t('editorDesk.teacher.neverMoves')}</Text>
            <ChipGroup
              testID="world-class"
              label={t('editorDesk.teacher.each')}
              choices={offered.map((one) => ({ value: one.key, label: named(one) }))}
              selected={selected.key}
              onSelect={(key) => setChosen((old) => ({ ...old, [id]: key }))}
            />
            {offer.kind === 'none' && (
              <Text testID="world-no-move" style={s.error}>
                {t('editorDesk.teacher.noChain', { release: isolate(offer.from) })}
              </Text>
            )}
            {offer.kind === 'move' && (
              <Text style={s.body}>{t('editorDesk.teacher.changes', { release: isolate(offer.from) })}</Text>
            )}
            {rows.map((row, index) => (
              <Text key={index} testID="world-change" style={s.body}>
                {row.kind}: {row.text}
              </Text>
            ))}
            {offer.kind !== 'none' && (
              <Button
                testID={`world-move-${number}`}
                label={t('editorDesk.teacher.move', { class: selected.class, release: isolate(number) })}
                disabled={busy}
                onPress={() => void move(selected, release)}
              />
            )}
          </View>
        );
      })}
    </View>
  );
}
