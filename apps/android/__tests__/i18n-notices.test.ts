// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

/// <reference types="node" />

// The interface-text libraries are MIT, which asks for their notices in every
// copy: the APK carries each one's full licence, for the version installed.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const notices = readFileSync(join(__dirname, '../android/app/src/main/assets/licenses/i18n.txt'), 'utf8');

test.each(['i18next', 'react-i18next', 'html-parse-stringify'])('ships the notice of %s', (name) => {
  const root = join(__dirname, '../node_modules', name);
  const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { version: string };
  expect(notices).toContain(`${name} ${version}\n`);
  expect(notices).toContain(readFileSync(join(root, 'LICENSE'), 'utf8').trim());
});
