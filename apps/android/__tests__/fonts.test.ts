// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

/// <reference types="node" />

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import manifest from '../fonts/manifest.json';
import { fontFaces, fontFamilyForWeight } from '../src/design/fonts';
import { typography } from '../src/design/tokens';

const app = join(__dirname, '../android/app/src/main');
const fonts = join(app, 'res/font');
const files = manifest.families.flatMap((family) => family.files.map((file) => ({ ...file, family: family.family })));

test('ships exactly the documented font files, unchanged from upstream', () => {
  expect(readdirSync(fonts).sort()).toEqual(files.map(({ resource }) => `${resource}.ttf`).sort());
  for (const file of files) {
    const bytes = readFileSync(join(fonts, `${file.resource}.ttf`));
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(file.sha256);
    // Read the standard sfnt table directory, then OS/2's usWeightClass. This
    // catches a renamed regular face pretending to supply medium or semibold.
    expect(bytes.readUInt32BE(0)).toBe(0x00010000);
    const tables = Array.from({ length: bytes.readUInt16BE(4) }, (_, i) => 12 + i * 16);
    const os2 = tables.find((offset) => bytes.toString('ascii', offset, offset + 4) === 'OS/2');
    expect(os2).toBeDefined();
    expect(bytes.readUInt16BE(bytes.readUInt32BE(os2! + 8) + 4)).toBe(file.weight);
  }
});

test('registers every alias from a bundled resource before React Native starts', () => {
  const source = readFileSync(join(app, 'java/dz/minhajna/preview/MainApplication.kt'), 'utf8');
  const registrations = Array.from(source.matchAll(/fonts\.addCustomFont\(this, "([^"]+)", R\.font\.(\w+)\)/g));
  expect(registrations.map(([, alias, resource]) => ({ alias, resource }))).toEqual(
    files.map(({ alias, resource }) => ({ alias, resource })),
  );
  expect(source.lastIndexOf('fonts.addCustomFont')).toBeLessThan(source.indexOf('    loadReactNative(this)'));
});

test('selects the real face for every specified weight, including Android 8 medium and semibold', () => {
  expect(
    Object.values(fontFaces)
      .flatMap((weights) => Object.values(weights))
      .sort(),
  ).toEqual(files.map(({ alias }) => alias).sort());
  for (const file of files) expect(fontFamilyForWeight(file.family, file.weight)).toBe(file.alias);
  expect(fontFamilyForWeight('Noto Naskh Arabic', 500)).toBe('Noto Naskh Arabic Medium');
  expect(fontFamilyForWeight('Noto Naskh Arabic', 600)).toBe('Noto Naskh Arabic SemiBold');
  expect(fontFamilyForWeight('Noto Sans', 500)).toBe('Noto Sans Medium');
  expect(fontFamilyForWeight('Noto Sans', 600)).toBe('Noto Sans SemiBold');
  expect(fontFamilyForWeight('Amiri', 400)).toBe('Amiri');
  for (const style of Object.values(typography)) {
    expect(
      files.find((file) => file.alias === style.fontFamily && String(file.weight) === style.fontWeight),
    ).toBeDefined();
  }
});

test('includes the licence and copyright notices in the APK assets', () => {
  const notice = readFileSync(join(app, 'assets/licenses/fonts.txt'), 'utf8');
  const licence = readFileSync(join(__dirname, '../../../LICENSES/OFL-1.1.txt'), 'utf8');
  expect(notice).toContain(licence.trim());
  expect(notice).toContain('Reserved Font Name EURM10');
  for (const project of ['aliftype/aref-ruqaa', 'notofonts/arabic', 'notofonts/latin-greek-cyrillic']) {
    expect(notice).toContain(`https://github.com/${project}`);
  }
});
