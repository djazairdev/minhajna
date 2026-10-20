// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Button } from '../components/Button';
import { Notice } from '../components/Notice';
import { controlIcon } from '../design/Icon';
import { useText } from '../text/i18n';
import { Impact } from './Impact';
import { SaveProblem } from './SaveProblem';
import type { useCalendarPreview } from './useCalendarPreview';

/** Preview and durable confirmation share the same safeguards in the lunar and A/B editors. */
export function PreviewActions({ draft, label }: { draft: ReturnType<typeof useCalendarPreview>; label?: string }) {
  const t = useText();
  return (
    <>
      {draft.invalid && (
        <Notice testID="calendar-invalid" icon={controlIcon('info')} message={t('calendarView.edit.invalid')} />
      )}
      <Button
        testID="calendar-preview"
        label={t('calendarView.edit.previewButton')}
        disabled={draft.busy}
        onPress={draft.preview}
      />
      {draft.shown !== null && <Impact impact={draft.shown.impact} />}
      <SaveProblem testID="calendar-save-failed" problem={draft.problem} />
      {draft.shown !== null && (
        <Button
          testID="calendar-save"
          label={label ?? t('calendarView.edit.save')}
          disabled={draft.busy}
          onPress={draft.save}
        />
      )}
    </>
  );
}
