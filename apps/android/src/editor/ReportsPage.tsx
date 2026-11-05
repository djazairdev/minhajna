// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The curators' inbox of plan-error reports (#616, R-4.3-20, answer 770): each
// with its pack, item and release, its kind, its note, and the name only when
// the teacher chose credit, the latest first, with a filter by release. No
// account is needed to read, as nothing is taken here. A report is what someone
// said: its note stays text, and acting on it is a fix keyed by a curator with
// its source (R-4.4-06).

import type { PackReport } from '@minhajna/core';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Button } from '../components/Button';
import { ChipGroup } from '../components/Chip';
import { useDeviceText } from '../text/device-text';
import { isolate } from '../week/grid-labels';
import { editorStyles as s } from './editor-styles';
import type { Send } from '../demo/world-session';
import type { PackEditor } from './pack-release-session';
import { readPackReports } from './pack-report-session';

const releaseOf = (one: PackReport) => `${one.id}@${one.release}`;

export function ReportsPage({
  send,
  dayText,
  ...editor
}: Pick<PackEditor, 'world' | 'held' | 'profile' | 'kit'> & {
  readonly send?: Send;
  readonly dayText: (day: PackReport['day']) => string;
}) {
  const t = useDeviceText();
  const [reports, setReports] = useState<readonly PackReport[] | null>(null);
  const [problem, setProblem] = useState(false);
  const [only, setOnly] = useState<string>('all');
  const [attempt, setAttempt] = useState(0);
  const { world, held, profile, kit } = editor;
  useEffect(() => {
    let live = true;
    readPackReports({ world, held, profile, kit }, send)
      .then((found) => {
        if (live) setReports(found);
      })
      .catch(() => {
        if (live) setProblem(true);
      });
    return () => {
      live = false;
    };
  }, [world, held, profile, kit, send, attempt]);
  const releases = [...new Set((reports ?? []).map(releaseOf))];
  const shown = (reports ?? []).filter((one) => only === 'all' || releaseOf(one) === only);
  return (
    <View testID="editor-reports-page" style={s.page}>
      <Text accessibilityRole="header" style={s.title}>
        {t('editorDesk.reports.title')}
      </Text>
      <Text style={s.body}>{t('editorDesk.reports.hint')}</Text>
      {problem && (
        <Text accessibilityRole="alert" style={s.error}>
          {t('editorDesk.reports.problem')}
        </Text>
      )}
      <Button
        testID="reports-reload"
        label={t('editorDesk.reload')}
        variant="plain"
        onPress={() => {
          setProblem(false);
          setAttempt((old) => old + 1);
        }}
      />
      {reports === null && !problem && (
        <Text accessibilityLiveRegion="polite" style={s.body}>
          {t('editorDesk.loading')}
        </Text>
      )}
      {reports !== null && reports.length === 0 && (
        <Text testID="reports-empty" style={s.body}>
          {t('editorDesk.reports.none')}
        </Text>
      )}
      {releases.length > 1 && (
        <ChipGroup
          testID="reports-filter"
          label={t('editorDesk.reports.filter')}
          choices={[
            { value: 'all', label: t('editorDesk.reports.all') },
            ...releases.map((value) => ({ value, label: value.replace('@', ' · ') })),
          ]}
          selected={only}
          onSelect={setOnly}
        />
      )}
      {shown.map((one, index) => (
        <View key={index} testID="report-row" style={s.card}>
          <Text style={s.body}>
            {isolate(one.id)} · {isolate(one.item)} · {isolate(one.release)}
          </Text>
          <Text style={s.body}>
            {t(`planError.kinds.${one.kind}`)} · {dayText(one.day)}
          </Text>
          <Text style={s.body}>{isolate(one.note)}</Text>
          <Text style={s.body}>
            {one.name === null
              ? t('editorDesk.reports.noCredit')
              : t('editorDesk.reports.credit', { name: isolate(one.name) })}
          </Text>
        </View>
      ))}
    </View>
  );
}
