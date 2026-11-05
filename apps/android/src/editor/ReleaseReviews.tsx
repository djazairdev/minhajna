// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// E-Release's review (#614, R-4.3-08, R-4.3-16, answer 768): a curator and a
// subject maintainer, two people, compare each change with the page images and
// the release before, then agree. An inspector may review too, named only by
// choice: the switch starts off and the name field waits for it, and their
// word never counts as an approval or reads as an official one. Reviews are
// taken at the desk under the curators' account, on the device of whoever
// reviews, so no reviewer needs an account of their own. Only the account that
// holds the release takes them.

import {
  NAME_MOST,
  NOTE_MOST,
  REVIEW_ROLES,
  latestReviews,
  reviewText,
  type PackChange,
  type PackPublisher,
  type PackRelease,
  type ReviewRole,
  type ReviewVerdict,
} from '@minhajna/core';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { ChipGroup } from '../components/Chip';
import { Switch } from '../components/Switch';
import { TextField } from '../components/TextField';
import { useDeviceText } from '../text/device-text';
import { editorStyles as s } from './editor-styles';
import type { PackReleaseTarget } from './pack-release-session';

export function ReleaseReviews(props: {
  readonly release: PackRelease;
  readonly role: PackPublisher;
  readonly canAct: boolean;
  readonly busy: boolean;
  readonly change: (target: PackReleaseTarget, step: PackChange) => Promise<PackRelease | null>;
}) {
  const t = useDeviceText();
  const { release, role, canAct, busy, change } = props;
  const [who, setWho] = useState<ReviewRole>('curator');
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [credited, setCredited] = useState(false);
  const inspector = who === 'inspector';
  const named = inspector ? credited : true;
  const typed = reviewText(name);
  const ready = (!named || (typed.length > 0 && typed.length <= NAME_MOST)) && reviewText(note).length <= NOTE_MOST;
  const latest = latestReviews(release.reviews);
  const takes = release.stage === 'under-review' && release.actor === role;
  const take = async (verdict: ReviewVerdict) => {
    const review = { role: who, verdict, name: named ? typed : null, note: reviewText(note) };
    const target = { id: release.pack.id, release: release.pack.release, revision: release.revision };
    const saved = await change(target, { stage: 'under-review', review });
    if (saved === null) return;
    setName('');
    setNote('');
    setCredited(false);
  };
  return (
    <View testID="release-reviews" style={s.page}>
      <Text accessibilityRole="header" style={s.title}>
        {t('editorDesk.review.title')}
      </Text>
      <Text style={s.body}>{t('editorDesk.review.hint')}</Text>
      {REVIEW_ROLES.filter((one) => one !== 'inspector' || latest.has(one)).map((one) => {
        const given = latest.get(one);
        return (
          <View key={one} testID={`review-${one}`} style={s.card}>
            <Text style={s.body}>
              {t(`editorDesk.review.role.${one}`)}
              {given?.name != null ? ` · ${given.name}` : ''}
            </Text>
            <Badge
              label={t(`editorDesk.review.${given?.verdict ?? 'waiting'}`)}
              variant={given?.verdict === 'approved' ? 'done' : given === undefined ? 'default' : 'warning'}
            />
            {given !== undefined && given.note !== '' && <Text style={s.body}>{given.note}</Text>}
            {one === 'inspector' && <Text style={s.body}>{t('editorDesk.review.notOfficial')}</Text>}
          </View>
        );
      })}
      {takes && (
        <View testID="review-form" style={s.card}>
          <ChipGroup
            testID="review-role"
            label={t('editorDesk.review.as')}
            choices={REVIEW_ROLES.map((value) => ({ value, label: t(`editorDesk.review.role.${value}`) }))}
            selected={who}
            onSelect={setWho}
          />
          {inspector && (
            <Switch
              testID="review-credit"
              label={t('editorDesk.review.credit')}
              description={t('editorDesk.review.creditHint')}
              value={credited}
              onValueChange={setCredited}
            />
          )}
          {named && (
            <TextField
              testID="review-name"
              label={t('editorDesk.review.name')}
              placeholder=""
              value={name}
              onChangeText={setName}
            />
          )}
          <TextField
            testID="review-note"
            label={t('editorDesk.review.note')}
            placeholder=""
            value={note}
            onChangeText={setNote}
          />
          <Button
            testID="review-approve"
            label={t('editorDesk.review.approve')}
            disabled={!canAct || busy || !ready}
            onPress={() => void take('approved')}
          />
          <Button
            testID="review-changes"
            label={t('editorDesk.review.requestChanges')}
            variant="plain"
            disabled={!canAct || busy || !ready}
            onPress={() => void take('changes')}
          />
        </View>
      )}
    </View>
  );
}
