// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The drawn signature on a sheet printed from its own screen (#236, answers
// 412 to 414): the September check, «سؤال المفتش» and the re-pace draft.
// The screen shows «خانة التوقيع» while the signature is in use, with
// «بتوقيعي المرسوم» chosen first and the note on where it goes, and the
// sheet's teacher's box takes the mark unless «فارغة» is chosen; then the
// warning under the buttons says whoever gets the PDF can copy it (answer
// 415). The choice holds for this screen only.

import { signatureInUse } from '@minhajna/core';
import { useState, type ReactElement } from 'react';
import { useAppData } from '../storage/AppData';
import { useText } from '../text/i18n';
import { drawnMark } from './drawn-mark';
import type { useOutputRun } from './output-run';
import { CopyWarning, SignatureChoice } from './SignatureChoice';

/**
 * The mark for the sheet's teacher's box, empty when none goes there; the choice to show, disabled while the
 * screen's `output` runs and clearing what it said of the last file when changed; and the warning for under the
 * print and save buttons.
 */
export function useSheetSignature(
  testID: string,
  output: Pick<ReturnType<typeof useOutputRun>, 'busy' | 'clear'>,
  onSettings?: () => void,
): { mark: string; choice: ReactElement; warning: ReactElement } {
  const t = useText();
  const { state } = useAppData();
  const [drawn, setDrawn] = useState(true);
  const mark = drawn ? drawnMark(signatureInUse(state.personal)) : '';
  return {
    mark,
    warning: <CopyWarning testID={`${testID}-copy`} shown={mark !== ''} />,
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
