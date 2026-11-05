// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// E-Release's changes (#614, answer 768): each change the teacher will read,
// with its kind and whether a migration entry carries it, in rows rather than
// columns, so that text at 200% and the phone keep them; what progress does
// follows answer 487 and is fixed, so no entry chooses it. Under them are the
// fields that don't reach teachers' notes, then the same changes as the notes
// that reach their phones. A first release has none.

import { newIds, oldIds, type PackReleaseComparison, type ReleaseChange } from '@minhajna/core';
import { Text, View } from 'react-native';
import { Badge } from '../components/Badge';
import { changeRows } from '../plan/release-rules';
import { useDeviceText } from '../text/device-text';
import { isolate } from '../week/grid-labels';
import { editorStyles as s } from './editor-styles';

/** The IDs of an earlier release a change names. */
function oldOf(change: ReleaseChange): readonly string[] {
  if (change.kind === 'added') return [];
  if (change.kind === 'page' || change.kind === 'removed') return [change.item.id];
  return change.kind === 'merge' ? change.from.map((item) => item.id) : [change.from.id];
}

const ids = (list: readonly string[]) => list.map((one) => isolate(one)).join(' · ');

export function ReleaseChangesTable({ comparison }: { readonly comparison: PackReleaseComparison }) {
  const t = useDeviceText();
  if (comparison.status !== 'checked') return null;
  const { previous, changes, details, findings, migrations } = comparison;
  if (previous === null)
    return (
      <Text testID="release-no-comparison" style={s.body}>
        {t(findings.length > 0 ? 'editorDesk.release.noComparison' : 'editorDesk.release.firstRelease')}
      </Text>
    );
  const carried = new Set(migrations.flatMap(oldIds));
  const rows = changeRows(t, changes);
  const fields = (list: readonly string[]) =>
    list.map((one) => t(`editorDesk.release.field.${one}` as never)).join(' · ');
  return (
    <View testID="release-changes-table" style={s.page}>
      <Text accessibilityRole="header" style={s.title}>
        {t('editorDesk.release.changesOn', { release: isolate(previous.release) })}
      </Text>
      {rows.length === 0 && migrations.length === 0 && <Text style={s.body}>{t('editorDesk.release.noChanges')}</Text>}
      {changes.map((change, index) => (
        <View key={index} testID={`release-change-${index}`} style={s.card}>
          <Badge label={rows[index].kind} />
          <Text style={s.body}>{rows[index].text}</Text>
          <Text style={s.body}>
            {t(
              oldOf(change).some((id) => carried.has(id))
                ? 'editorDesk.release.withEntry'
                : 'editorDesk.release.noEntry',
            )}
          </Text>
          {change.kind === 'split' && <Text style={s.body}>{t('editorDesk.release.splitProgress')}</Text>}
        </View>
      ))}
      {migrations.map((entry, index) => (
        <Text key={index} testID={`release-entry-${index}`} style={s.body}>
          {t(`editorDesk.release.entry.${entry.kind}`, { from: ids(oldIds(entry)), to: ids(newIds(entry)) })}
        </Text>
      ))}
      <Text style={s.body}>{t('editorDesk.release.layers')}</Text>
      {details.pack.length > 0 && (
        <Text testID="release-details-pack" style={s.body}>
          {t('editorDesk.release.packDetails', { fields: fields(details.pack) })}
        </Text>
      )}
      {details.items.map((one) => (
        <Text key={one.item} style={s.body}>
          {t('editorDesk.release.itemDetails', { item: isolate(one.item), fields: fields(one.fields) })}
        </Text>
      ))}
      <Text accessibilityRole="header" style={s.title}>
        {t('editorDesk.release.notes')}
      </Text>
      <View testID="release-notes" style={s.card}>
        {rows.map((row, index) => (
          <Text key={index} style={s.body}>
            {row.kind}: {row.text}
          </Text>
        ))}
      </View>
    </View>
  );
}
