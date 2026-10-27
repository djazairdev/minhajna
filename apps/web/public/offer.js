// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

/* global window */

// Holds the browser's install offer from the page's first moment (#250,
// answer 512). A browser may make it before the app's bundle has run, and
// would not make it again for this page, so it is kept here, the browser's
// own prompt held back, until src/native/Browser.ts takes it over.

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  window.minhajnaOffer = event;
});
window.addEventListener('appinstalled', () => {
  window.minhajnaInstalled = true;
});
