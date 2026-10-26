// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The app's root on the web (#250): one full-window view in the kept
// language's direction. React Native Web lays out `start` and `end`, and
// mirrors rows, from the direction of the nearest view that names one, as
// Android does from the direction it sets before the app starts.

import { createElement } from 'react';
import { View } from 'react-native-web';
import { isRtl } from './direction.ts';

/** The app inside a view that names its direction. */
export function withLocale(App) {
  return function LocaleRoot(props) {
    return createElement(View, { dir: isRtl() ? 'rtl' : 'ltr', style: { flex: 1 } }, createElement(App, props));
  };
}
