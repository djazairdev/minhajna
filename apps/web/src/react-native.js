// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// React Native as the phone app's code sees it on the web (#250): React
// Native Web, with what it leaves out. The layout's direction comes from the
// kept language, as Android sets it before the app starts; view tags reach
// the interface module's focus; an image named like an Android drawable is
// the SVG the build wrote from it; and the Android-only pieces the app
// imports are inert, since the web asks for no permission and has no
// developer menu or back button of its own.

import { createElement } from 'react';
import { I18nManager as WebI18nManager, Image as WebImage } from 'react-native-web';
import { isRtl } from './direction.ts';
import { tagOf } from './view-tags.ts';

export * from 'react-native-web';

export const I18nManager = { ...WebI18nManager, isRTL: isRtl(), getConstants: () => ({ isRTL: isRtl() }) };

/** A source named like a drawable, such as `{ uri: 'icon_offline' }`, as the build's SVG of it. */
function drawn(source) {
  const uri = source?.uri;
  return typeof uri === 'string' && /^[a-z][a-z0-9_]*$/u.test(uri)
    ? { ...source, uri: `./drawables/${uri}.svg` }
    : source;
}

export function Image(props) {
  return createElement(WebImage, { ...props, source: drawn(props.source) });
}
Object.assign(Image, WebImage);

export function findNodeHandle(target) {
  return tagOf(target);
}

export const DevSettings = { addMenuItem() {}, reload() {} };

export const BackHandler = { addEventListener: () => ({ remove() {} }), exitApp() {} };

export const PermissionsAndroid = {
  PERMISSIONS: {},
  RESULTS: { GRANTED: 'granted', DENIED: 'denied', NEVER_ASK_AGAIN: 'never_ask_again' },
  check: () => Promise.resolve(false),
  request: () => Promise.resolve('denied'),
};
