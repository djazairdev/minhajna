// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The sheets of a device whose working copy is on the other device (#250,
// answers 503 and 513). Taking over asks first, as what the other device
// recorded would not come here. A change refused while the copy is away,
// on any screen, opens a sheet over the whole app that says it was not
// saved and why, with «استلام النسخة» and «استعادة العمل هنا»; it is drawn
// once, beside the navigator, so a screen over the tabs shows it too.
// Closed, it leaves the focus where the screen keeps it, as the change was
// made there.

import { useRef, useState, type RefObject } from 'react';
import type { ViewInstance } from 'react-native';
import { BottomSheet } from '../components/BottomSheet';
import { Button } from '../components/Button';
import { useAppData } from '../storage/AppData';
import { currentLanguage, useText } from '../text/i18n';
import { dayName } from '../today/DayMark';

/** The day the copy left, as the sheets and the banner name it. */
export function useAwayDay(): string | null {
  const t = useText();
  const { handedOver, profile } = useAppData();
  return handedOver === null ? null : dayName(t, handedOver, currentLanguage(), profile);
}

export type TakeOverSheetProps = {
  readonly visible: boolean;
  readonly day: string;
  readonly onClose: () => void;
  readonly returnFocusRef: RefObject<ViewInstance | null>;
};

/** «استعادة العمل هنا», asked first. */
export function TakeOverSheet({ visible, day, onClose, returnFocusRef }: TakeOverSheetProps) {
  const t = useText();
  const { record } = useAppData();
  return (
    <BottomSheet
      testID="handover-take-sheet"
      visible={visible}
      title={t('settings.handover.takeTitle')}
      context={t('settings.handover.takeContext', { day })}
      reassurance={t('settings.handover.takeReassurance')}
      returnFocusRef={returnFocusRef}
      onClose={onClose}
    >
      <Button
        testID="handover-take-confirm"
        label={t('settings.handover.takeOver')}
        onPress={() => {
          onClose();
          record({ kind: 'handover.ended', handover: { how: 'taken' } });
        }}
      />
      <Button variant="line" label={t('settings.handover.cancel')} onPress={onClose} />
    </BottomSheet>
  );
}

export type HandoverRefusedProps = {
  /** Opens «استلام النسخة». */
  readonly onReceive: () => void;
};

/** The sheet of a change refused while the copy is away, over every screen. */
export function HandoverRefused({ onReceive }: HandoverRefusedProps) {
  const t = useText();
  const { refused, dismissRefused } = useAppData();
  const day = useAwayDay();
  const [taking, setTaking] = useState(false);
  const nowhere = useRef<ViewInstance>(null);
  if (day === null) return null;
  return (
    <>
      <BottomSheet
        testID="handover-refused"
        visible={refused}
        title={t('settings.handover.refusedTitle')}
        context={t('settings.handover.refusedContext', { day })}
        reassurance={t('settings.handover.refusedReassurance')}
        returnFocusRef={nowhere}
        onClose={dismissRefused}
      >
        <Button
          testID="handover-refused-receive"
          label={t('settings.handover.receive')}
          onPress={() => {
            dismissRefused();
            onReceive();
          }}
        />
        <Button
          testID="handover-refused-take"
          variant="line"
          label={t('settings.handover.takeOver')}
          onPress={() => {
            dismissRefused();
            setTaking(true);
          }}
        />
        <Button variant="plain" label={t('settings.handover.close')} onPress={dismissRefused} />
      </BottomSheet>
      <TakeOverSheet visible={taking} day={day} onClose={() => setTaking(false)} returnFocusRef={nowhere} />
    </>
  );
}
