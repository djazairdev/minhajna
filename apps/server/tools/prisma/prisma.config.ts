// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Prisma's settings for its command-line tool, which only generates the
// client and the migrations' SQL. The tool lives in this folder with its
// own lockfile, so it never installs with the server; paths are from here.
// The tool's update and usage checks are turned off, so it calls no one.
// The datasource is only read by a diff against a database, as CI's check
// of the migrations does.

import process from 'node:process';
import { defineConfig } from 'prisma/config';

process.env['CHECKPOINT_DISABLE'] = '1';

export default defineConfig({
  schema: '../../prisma/schema.prisma',
  datasource: { url: process.env['DATABASE_URL'] ?? 'postgresql://nobody@127.0.0.1:1/none' },
});
