// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * React Native's developer menu for Jest: it keeps each item added, so that a
 * test can choose one as a developer would.
 */
export class FakeDevMenu {
  readonly items = new Map<string, () => unknown>();

  addMenuItem(title: string, handler: () => unknown): void {
    this.items.set(title, handler);
  }

  reload(): void {}

  onFastRefresh(): void {}
}
