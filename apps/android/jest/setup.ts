// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Jest has no native side: the app's storage and interface-language modules,
// and React Native's developer menu, are Node fakes, fresh for each test file.
jest.mock('../src/native/NativeMinhajnaStorage', () => {
  const { FakeStorage } = jest.requireActual<typeof import('./fake-storage')>('./fake-storage');
  return { __esModule: true, default: new FakeStorage().asSpec() };
});

jest.mock('../src/native/NativeMinhajnaInterface', () => {
  const { FakeInterface } = jest.requireActual<typeof import('./fake-interface')>('./fake-interface');
  return { __esModule: true, default: new FakeInterface().asSpec() };
});

jest.mock('react-native/Libraries/Utilities/DevSettings', () => {
  const { FakeDevMenu } = jest.requireActual<typeof import('./fake-dev-menu')>('./fake-dev-menu');
  return { __esModule: true, default: new FakeDevMenu() };
});
