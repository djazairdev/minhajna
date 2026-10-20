// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

type Call = { url: string; method: string; body: Record<string, unknown> | null };

/** Run the configuration against a fake API, with synthetic credentials and no real network access. */
function configure(existing: boolean, pulls = true): Call[] {
  const url = pathToFileURL(resolve(__dirname, '../../../infra/weblate/configure.js')).href;
  const script = `
const calls = [];
const existing = ${String(existing)};
const pulls = ${String(pulls)};
globalThis.fetch = async (url, init) => {
  const path = new URL(url).pathname;
  const body = init.body === undefined ? null : JSON.parse(init.body);
  calls.push({ url: String(url), method: init.method, body });
  let result = {};
  let status = 200;
  if (init.method === 'GET' && !path.includes('/units/')) status = existing ? 200 : 404;
  if (path.includes('/units/') && init.method === 'GET') {
    const contexts = path.includes('/android-interface/') ? ['name', 'latinName', 'language.ar', 'language.fr', 'language.en'] : ['minutes'];
    result = { results: contexts.map((context, id) => ({ id, context, source: context === 'minutes' ? ['one', 'other'] : ['text'], extra_flags: '' })) };
  }
  if (path.endsWith('/repository/')) result = { result: pulls };
  return { status, ok: status === 200, json: async () => result };
};
const output = console.log;
console.log = () => undefined;
await import(${JSON.stringify(url)});
output(JSON.stringify(calls));
`;
  return JSON.parse(
    execFileSync(process.execPath, ['--input-type=module', '--eval', script], {
      encoding: 'utf8',
      env: {
        WEBLATE_URL: 'https://weblate.invalid',
        WEBLATE_TOKEN: 'synthetic-placeholder',
        REPOSITORY: 'https://example.invalid/source.git',
        PUSH: 'https://example.invalid/push.git',
      },
    }),
  ) as Call[];
}

test.each([false, true])(
  'configures all catalogues with the same licence and review branch (existing: %s)',
  (existing) => {
    const calls = configure(existing);
    const components = calls.filter(
      (call) => ['POST', 'PATCH'].includes(call.method) && typeof call.body?.filemask === 'string',
    );
    expect(components).toHaveLength(3);
    const [base, settings, calendar] = components.map((call) => call.body!);
    expect(base.repo).toBe('https://example.invalid/source.git');
    expect(base.push).toBe('https://example.invalid/push.git');
    expect(settings.repo).toBe('weblate://minhajna/android-interface');
    for (const option of ['vcs', 'branch', 'push', 'push_branch', 'merge_style']) {
      expect(settings[option]).toBeUndefined();
    }
    expect(base.push_branch).toBe('weblate');
    expect(settings.filemask).toBe('apps/android/src/settings/text/*.json');
    expect(calendar.repo).toBe('weblate://minhajna/android-interface');
    expect(calendar.push).toBeUndefined();
    expect(calendar.filemask).toBe('apps/android/src/calendar/text/*.json');
    for (const component of [base, settings, calendar]) {
      expect(component.license).toBe('AGPL-3.0-or-later');
      expect(component.source_language).toBe('ar');
      expect(component.commit_message).toContain('Signed-off-by: {{ author }}');
      expect(component.agreement).toBe(base.agreement);
    }
    expect(calls.some((call) => call.body?.extra_flags === 'ignore-i18next-interpolation')).toBe(true);
    expect(calls.every((call) => call.url.startsWith('https://weblate.invalid/'))).toBe(true);
  },
);

test.each([false, true])('pulls the main component before linking catalogues to it (existing: %s)', (existing) => {
  const calls = configure(existing);
  const pull = calls.findIndex((call) => call.url.endsWith('/components/minhajna/android-interface/repository/'));
  const linked = calls.findIndex((call) => call.body?.filemask === 'apps/android/src/settings/text/*.json');
  if (!existing) {
    expect(pull).toBe(-1);
    return;
  }
  expect(calls[pull]).toMatchObject({ method: 'POST', body: { operation: 'pull' } });
  expect(pull).toBeLessThan(linked);
  expect(calls.filter((call) => call.url.endsWith('/repository/'))).toHaveLength(1);
});

test('stops before linking a catalogue when Weblate cannot pull', () => {
  expect(() => configure(true, false)).toThrow(/could not update android-interface/);
});
