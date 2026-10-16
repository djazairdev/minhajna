// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Jest has no native side: the app's storage module is the Node fake, fresh
// for each test file.
jest.mock('../src/native/NativeMinhajnaStorage', () => {
  const { FakeStorage } = jest.requireActual<typeof import('./fake-storage')>('./fake-storage');
  return { __esModule: true, default: new FakeStorage().asSpec() };
});
