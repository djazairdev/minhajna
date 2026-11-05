// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// E-Release's list (#614, answer 768): the releases of this world, each with
// its stage; the reviews page holds those under review. Choosing one opens its
// checks and review. The curators' account and the Ministry's read the same
// list, as the Ministry publishes what the curators have had reviewed; without
// an account a device reads only.

import { compareReleases, packReleaseKey, type PackPublisher, type PackRelease, type PlanPack } from '@minhajna/core';
import { useState, type Dispatch, type SetStateAction } from 'react';
import { Text, View } from 'react-native';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import type { OpenWorld } from '../demo/world-mode';
import type { Send } from '../demo/world-session';
import { useDeviceText } from '../text/device-text';
import { isolate } from '../week/grid-labels';
import type { TermReference } from '../director/seeded-fill';
import { editorStyles as s } from './editor-styles';
import type { PackEditor } from './pack-release-session';
import { ReleaseDetail } from './ReleaseDetail';
import { usePackDrafts } from './usePackDrafts';

type Props = PackEditor & {
  readonly reference: TermReference;
  readonly packs: readonly PlanPack[];
  readonly role: PackPublisher;
  readonly underReview: boolean;
  readonly send?: Send;
  readonly setOpen?: Dispatch<SetStateAction<OpenWorld | null>>;
};

const newestFirst = (a: PackRelease, b: PackRelease) =>
  a.pack.id.localeCompare(b.pack.id) || compareReleases(b.pack.release, a.pack.release);

export function ReleasesPage(props: Props) {
  const t = useDeviceText();
  const { role, underReview, reference, packs } = props;
  const desk = usePackDrafts(props, packs, props.send, props.setOpen, role);
  const [opened, setOpened] = useState<string | null>(null);
  const shown = [...desk.records.values()]
    .filter((one) => !underReview || one.stage === 'under-review')
    .sort(newestFirst);
  const release = opened === null ? undefined : desk.records.get(opened);
  return (
    <View testID="editor-releases-page" style={s.page}>
      {desk.problem !== null && (
        <Text accessibilityRole="alert" style={s.error}>
          {t(`editorItem.${desk.problem}`)}
        </Text>
      )}
      <Button
        testID="release-reload"
        label={t('editorDesk.reload')}
        variant="plain"
        disabled={desk.busy}
        onPress={desk.reload}
      />
      {release !== undefined ? (
        <ReleaseDetail
          key={opened}
          release={release}
          records={desk.records}
          bundled={packs}
          reference={reference}
          role={role}
          canAct={desk.ready && props.accounts?.[role] !== undefined}
          busy={desk.busy}
          change={desk.change}
          onClose={() => {
            setOpened(null);
            desk.dismiss();
          }}
        />
      ) : (
        <>
          <Text accessibilityRole="header" style={s.title}>
            {t(underReview ? 'editorDesk.release.reviewsTitle' : 'editorDesk.release.listTitle')}
          </Text>
          {!desk.ready && desk.problem === null && (
            <Text accessibilityLiveRegion="polite" style={s.body}>
              {t('editorDesk.loading')}
            </Text>
          )}
          {desk.ready && shown.length === 0 && (
            <Text testID="releases-empty" style={s.body}>
              {t(underReview ? 'editorDesk.release.noReviews' : 'editorDesk.release.none')}
            </Text>
          )}
          {shown.map((one) => {
            const name = `${isolate(one.pack.id)} · ${isolate(one.pack.release)}`;
            return (
              <View key={packReleaseKey(one.pack.id, one.pack.release)} style={s.card}>
                <Text style={s.body}>{name}</Text>
                <Badge
                  label={t(`editorDesk.release.stage.${one.stage}`)}
                  variant={one.stage === 'published' ? 'done' : one.stage === 'withdrawn' ? 'warning' : 'default'}
                />
                <Button
                  testID={`release-open-${one.pack.release}`}
                  label={t('editorDesk.release.open')}
                  name={t('editorDesk.release.openNamed', { name })}
                  onPress={() => setOpened(packReleaseKey(one.pack.id, one.pack.release))}
                />
              </View>
            );
          })}
        </>
      )}
    </View>
  );
}
