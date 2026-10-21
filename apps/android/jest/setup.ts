// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Jest has no native side: the app's storage, lock-settings, interface-language,
// licence and signature modules, and React Native's developer menu, are Node
// fakes, fresh for each test file.
jest.mock('../src/native/NativeMinhajnaStorage', () => {
  const { FakeStorage } = jest.requireActual<typeof import('./fake-storage')>('./fake-storage');
  return { __esModule: true, default: new FakeStorage().asSpec() };
});

jest.mock('../src/native/NativeMinhajnaLock', () => {
  const { FakeLock } = jest.requireActual<typeof import('./fake-lock')>('./fake-lock');
  return { __esModule: true, default: new FakeLock().asSpec() };
});

jest.mock('../src/native/NativeMinhajnaInterface', () => {
  const { FakeInterface } = jest.requireActual<typeof import('./fake-interface')>('./fake-interface');
  return { __esModule: true, default: new FakeInterface().asSpec() };
});

jest.mock('react-native/Libraries/Utilities/DevSettings', () => {
  const { FakeDevMenu } = jest.requireActual<typeof import('./fake-dev-menu')>('./fake-dev-menu');
  return { __esModule: true, default: new FakeDevMenu() };
});

// No APK assets exist in Jest; screen tests supply synthetic public notices.
jest.mock('../src/native/NativeMinhajnaLicences', () => ({
  __esModule: true,
  default: { readNotices: jest.fn(() => Promise.resolve({ version: '0.0.0', notices: [] })) },
}));

// No web engine exists in Jest; tests check the HTML and supply a made PDF.
jest.mock('../src/native/NativeMinhajnaPdf', () => ({
  __esModule: true,
  default: {
    makePdf: jest.fn((_html: string, name: string) => Promise.resolve({ name, pages: 1, bytes: 1, milliseconds: 1 })),
    sharePdf: jest.fn(() => Promise.resolve()),
    printHtml: jest.fn(() => Promise.resolve()),
    savePdf: jest.fn(() => Promise.resolve(true)),
    pageColors: jest.fn(() => Promise.resolve([])),
  },
}));

// No installed APK exists in Jest; the build is described with made-up checksums.
jest.mock('../src/native/NativeMinhajnaBuild', () => ({
  __esModule: true,
  default: {
    describe: jest.fn(() =>
      Promise.resolve({ version: '0.1.0', versionCode: 1, apkSha256: 'ab'.repeat(32), signerSha256: 'cd'.repeat(32) }),
    ),
  },
}));

jest.mock('../src/native/NativeMinhajnaSignature', () => {
  const { fakeSignature } = jest.requireActual<typeof import('./fake-signature')>('./fake-signature');
  return { __esModule: true, default: fakeSignature };
});

jest.mock('../src/native/NativeMinhajnaCalendarInput', () => ({
  __esModule: true,
  default: {
    readFile: jest.fn(() => Promise.resolve(null)),
    scanQr: jest.fn(() => Promise.resolve(null)),
    cancel: jest.fn(),
  },
}));
