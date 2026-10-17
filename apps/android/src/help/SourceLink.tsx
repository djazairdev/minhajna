// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Alert, Linking } from 'react-native';
import type { TFunction } from 'i18next';
import { useText } from '../text/i18n';
import { HelpRow } from './HelpPage';

/** Fixed public target, without identifiers, query parameters or record contents. */
export const sourceUrl = 'https://github.com/djazairdev/minhajna';

/** Offline reading never opens the browser; that needs a separate confirmation. */
export function SourceLink() {
  const t = useText();
  return <HelpRow label={t('help.source')} detail={sourceUrl} link onPress={() => confirmSource(t)} />;
}

function confirmSource(t: TFunction) {
  Alert.alert(t('help.source'), t('help.browserNotice'), [
    { text: t('help.cancel'), style: 'cancel' },
    {
      text: t('help.openBrowser'),
      onPress: () => {
        void Linking.openURL(sourceUrl).catch(() => Alert.alert(t('help.source'), t('help.browserRefused')));
      },
    },
  ]);
}
