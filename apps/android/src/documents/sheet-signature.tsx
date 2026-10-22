// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The drawn signature on a sheet printed from its own screen (#236, answers
// 412 to 414): the September check, «سؤال المفتش» and the re-pace draft.
// The screen shows «خانة التوقيع» while the signature is in use, with
// «بتوقيعي المرسوم» chosen first and the note on where it goes, and the
// sheet's teacher's box takes the mark unless «فارغة» is chosen. The choice
// holds for this screen only.

import { signatureInUse } from '@minhajna/core';
import { useState, type ReactElement } from 'react';
import { useAppData } from '../storage/AppData';
import { useText } from '../text/i18n';
import { drawnMark } from './drawn-mark';
import type { useOutputRun } from './output-run';
import { SignatureChoice } from './SignatureChoice';

/**
 * The mark for the sheet's teacher's box, empty when none goes there, and the choice to show: disabled while the
 * screen's `output` runs, and clearing what it said of the last file when changed.
 */
export function useSheetSignature(
  testID: string,
  output: Pick<ReturnType<typeof useOutputRun>, 'busy' | 'clear'>,
  onSettings?: () => void,
): { mark: string; choice: ReactElement } {
  const t = useText();
  const { state } = useAppData();
  const [drawn, setDrawn] = useState(true);
  return {
    mark: drawn ? drawnMark(signatureInUse(state.personal)) : '',
    choice: (
      <SignatureChoice
        testID={testID}
        label={t('documents.output.signatureChoice')}
        drawn={drawn}
        disabled={output.busy}
        note={drawn ? t('documents.output.drawnNoteBox') : undefined}
        onDrawn={(next) => {
          setDrawn(next);
          output.clear();
        }}
        onSettings={onSettings}
      />
    ),
  };
}
