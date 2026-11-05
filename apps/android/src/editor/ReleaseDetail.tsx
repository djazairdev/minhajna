// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// E-Release's page for one release (#614, answer 768): its head and stages, the
// map of who holds what or the table of its changes, the automated checks, the
// fixed rule of what a release does to classes, the notes as they reach
// teachers, and beside them the two-person review and the steps. The map is
// drawn only where the app draws, and the same words stand beside it.
// Publishing waits for no held-back line and both approvals; the core refuses
// the second by itself, while the lines, needing what a reviewer types, are
// this page's. A release's own content isn't editable here: the packs page
// edits a draft, and saving there takes it back to draft and clears its
// reviews.

import {
  reviewsDone,
  compareReleases,
  type PackChange,
  type PackPublisher,
  type PackRelease,
  type PlanPack,
} from '@minhajna/core';
import { useLocale } from '@react-navigation/native';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { SegmentedControl } from '../components/SegmentedControl';
import type { TermReference } from '../director/seeded-fill';
import { useDrawing } from '../drawing/drawing-kit';
import { useDeviceText } from '../text/device-text';
import { isolate } from '../week/grid-labels';
import { editorStyles as s } from './editor-styles';
import { ReleaseChecks } from './ReleaseChecks';
import { ReleaseChangesTable } from './ReleaseChangesTable';
import { releaseHistory, reviewRelease, type BudgetFigures } from './release-checks';
import { releaseMap, type ReleaseMap } from './release-map';
import { ReleaseReviews } from './ReleaseReviews';
import type { PackReleaseTarget } from './pack-release-session';

const RAIL = ['draft', 'under-review', 'published'] as const;

function MapWords({ map }: { readonly map: ReleaseMap }) {
  const t = useDeviceText();
  return (
    <View testID="release-map-text" style={s.card}>
      {map.boxes.map((box) => (
        <Text key={box.id} style={s.body}>
          {box.label}: {box.holds}
        </Text>
      ))}
      {map.lines.map((line) => (
        <Text key={line.id} style={s.body}>
          {line.text}
          {line.now ? '' : ` (${t('editorDesk.map.later')})`}
        </Text>
      ))}
    </View>
  );
}

export function ReleaseDetail(props: {
  readonly release: PackRelease;
  readonly records: ReadonlyMap<string, PackRelease>;
  readonly bundled: readonly PlanPack[];
  readonly reference: TermReference;
  readonly role: PackPublisher;
  readonly canAct: boolean;
  readonly busy: boolean;
  readonly change: (target: PackReleaseTarget, step: PackChange) => Promise<PackRelease | null>;
  readonly onClose: () => void;
}) {
  const t = useDeviceText();
  const { direction } = useLocale();
  const drawing = useDrawing();
  const { release, records, role, canAct, busy, change } = props;
  const { pack, stage } = release;
  const [view, setView] = useState<'map' | 'table'>('table');
  const [weeks, setWeeks] = useState('');
  const [figures, setFigures] = useState<BudgetFigures>({ main: '', td: '', minutes: '', source: '' });
  const [withdrawing, setWithdrawing] = useState(false);
  const history = releaseHistory(pack, props.bundled, records, stage !== 'draft' && stage !== 'under-review');
  const review = reviewRelease(pack, history, props.reference, weeks, figures);
  const map = releaseMap(t, stage, direction === 'rtl');
  const comparison = review.comparison;
  const target = { id: pack.id, release: pack.release, revision: release.revision };
  const step = (next: PackChange) => void change(target, next);
  const own = release.actor === role;
  const agreed = reviewsDone(release.reviews);
  const canPublish = canAct && !busy && review.blockers === 0 && agreed && (own || role === 'ministry');
  const later = [...records.values()].filter(
    (one) =>
      one.pack.id === pack.id &&
      one.stage === 'published' &&
      one.actor === release.actor &&
      compareReleases(one.pack.release, pack.release) > 0,
  );
  const successor = later.sort((a, b) => compareReleases(b.pack.release, a.pack.release))[0];
  return (
    <View testID="release-detail" style={s.page}>
      <Button testID="release-back" label={t('editorDesk.release.back')} variant="plain" onPress={props.onClose} />
      <Text accessibilityRole="header" style={s.title}>
        {t('editorDesk.release.title', { release: isolate(pack.release) })}
      </Text>
      <Text style={s.body}>
        {isolate(pack.id)} · {t(`plan.status.${pack.status}`)}
      </Text>
      <View style={s.row} accessibilityLabel={t(`editorDesk.release.stage.${stage}`)}>
        {RAIL.map((one) => (
          <Badge
            key={one}
            testID={`release-rail-${one}`}
            label={t(`editorDesk.release.stage.${one}`)}
            variant={one === stage ? 'done' : 'default'}
          />
        ))}
        {stage !== 'draft' && stage !== 'under-review' && stage !== 'published' ? (
          <Badge testID="release-rail-after" label={t(`editorDesk.release.stage.${stage}`)} variant="warning" />
        ) : (
          <Text style={s.body}>{t('editorDesk.release.thenAfter')}</Text>
        )}
      </View>
      {drawing !== null && (
        <SegmentedControl
          testID="release-view"
          label={t('editorDesk.release.viewLabel')}
          choices={[
            { value: 'table', label: t('editorDesk.release.table') },
            { value: 'map', label: t('editorDesk.release.map') },
          ]}
          selected={view}
          onSelect={setView}
        />
      )}
      {drawing !== null && view === 'map' ? (
        <View testID="release-map" style={s.page}>
          <drawing.Map testID="release-map-drawing" spec={map.spec} />
          <MapWords map={map} />
        </View>
      ) : (
        <ReleaseChangesTable comparison={comparison} />
      )}
      {drawing === null && <MapWords map={map} />}
      <ReleaseChecks lines={review.lines} weeks={weeks} onWeeks={setWeeks} figures={figures} onFigures={setFigures} />
      <Text accessibilityRole="header" style={s.title}>
        {t('editorDesk.release.effectTitle')}
      </Text>
      <Text testID="release-effect" style={s.body}>
        {t('editorDesk.release.effect')}
      </Text>
      <ReleaseReviews release={release} role={role} canAct={canAct} busy={busy} change={change} />
      {stage === 'draft' && own && (
        <Button
          testID="release-send"
          label={t('editorDesk.release.send')}
          disabled={!canAct || busy}
          onPress={() => step({ stage: 'under-review' })}
        />
      )}
      {stage === 'under-review' && (
        <>
          {!agreed && <Text style={s.body}>{t('editorDesk.release.waitsForTwo')}</Text>}
          {review.blockers > 0 && <Text style={s.body}>{t('editorDesk.release.waitsForChecks')}</Text>}
          <Button
            testID="release-publish"
            label={t(role === 'ministry' ? 'editorDesk.release.publishOfficial' : 'editorDesk.release.publish')}
            disabled={!canPublish}
            onPress={() => step({ stage: 'published' })}
          />
        </>
      )}
      {stage === 'published' && own && (
        <>
          {successor !== undefined && (
            <Button
              testID="release-supersede"
              label={t('editorDesk.release.supersede', { release: isolate(successor.pack.release) })}
              variant="plain"
              disabled={!canAct || busy}
              onPress={() => step({ stage: 'superseded', by: successor.pack.release })}
            />
          )}
          {withdrawing ? (
            <>
              <Text accessibilityRole="alert" style={s.body}>
                {t('editorDesk.release.withdrawConfirm')}
              </Text>
              <Button
                testID="release-withdraw-confirm"
                label={t('editorDesk.release.withdrawYes')}
                disabled={!canAct || busy}
                onPress={() => {
                  setWithdrawing(false);
                  step({ stage: 'withdrawn' });
                }}
              />
              <Button
                testID="release-withdraw-cancel"
                label={t('editorDesk.release.keep')}
                variant="plain"
                onPress={() => setWithdrawing(false)}
              />
            </>
          ) : (
            <Button
              testID="release-withdraw"
              label={t('editorDesk.release.withdraw')}
              variant="plain"
              disabled={!canAct || busy}
              onPress={() => setWithdrawing(true)}
            />
          )}
        </>
      )}
    </View>
  );
}
