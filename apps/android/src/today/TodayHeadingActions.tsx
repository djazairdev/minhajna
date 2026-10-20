// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { IconButton } from '../components/IconButton';
import { controlIcon } from '../design/Icon';
import { useText } from '../text/i18n';

/** Keep Settings reachable from Today, beside Help and the optional session outside the timetable. */
export function TodayHeadingActions({
  onExtra,
  onSettings,
  onHelp,
}: {
  onExtra?: () => void;
  onSettings?: () => void;
  onHelp: () => void;
}) {
  const t = useText();
  return (
    <>
      {onExtra !== undefined && (
        <IconButton
          testID="today-extra"
          icon={controlIcon('plus')}
          accessibilityLabel={t('extra.open')}
          onPress={onExtra}
        />
      )}
      {onSettings !== undefined && (
        <IconButton
          testID="today-settings"
          icon={controlIcon('tune')}
          accessibilityLabel={t('settings.title')}
          onPress={onSettings}
        />
      )}
      <IconButton
        testID="today-help"
        icon={controlIcon('info')}
        accessibilityLabel={t('today.help')}
        onPress={onHelp}
      />
    </>
  );
}
