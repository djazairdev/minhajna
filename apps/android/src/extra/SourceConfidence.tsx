// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { View } from 'react-native';
import { SegmentedControl } from '../components/SegmentedControl';
import { TextField } from '../components/TextField';
import { spacing } from '../design/tokens';
import { useText } from '../text/i18n';

/** A source does not confer authority; the teacher chooses announced or expected explicitly. */
export function SourceConfidence({
  testID,
  source,
  confidence,
  onSource,
  onConfidence,
  busy = false,
}: {
  testID: string;
  source: string;
  confidence: 'announced' | 'expected';
  busy?: boolean;
  onSource: (source: string) => void;
  onConfidence: (confidence: 'announced' | 'expected') => void;
}) {
  const t = useText();
  return (
    <View style={{ gap: spacing['space-16'] }}>
      <TextField
        testID={`${testID}-source`}
        label={t('addSessions.source')}
        placeholder={t('addSessions.sourceDefault')}
        value={source}
        onChangeText={onSource}
        maxLength={200}
        editable={!busy}
      />
      <SegmentedControl
        testID={`${testID}-confidence`}
        label={t('addSessions.confidence')}
        choices={[
          { value: 'announced', label: t('addSessions.confidences.announced') },
          { value: 'expected', label: t('addSessions.confidences.expected') },
        ]}
        selected={confidence}
        onSelect={onConfidence}
        disabled={busy}
      />
    </View>
  );
}
