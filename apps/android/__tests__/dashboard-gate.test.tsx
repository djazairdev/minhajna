// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The dashboard's gates (answer 809), against a made-up directory: a first
// visitor sets the code, typed twice, and the next enters it, as does the one
// who set it when the page then failed to read; a refused code says so; the
// page says the server is waking and goes on; a page locks and forgets its
// code; the school is chosen from the published list, wilaya, commune then
// school, and no list or one with no school says so. Every school is made up.

import { Platform } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { schoolIn } from '../jest/dashboard-world';
import { FakeDirectory } from '../jest/fake-directory';
import { act, has, press, rendered, show, texts as shown, type, unmount } from '../jest/ministry-page';
import { DashboardRoot } from '../src/dashboard/DashboardRoot';
import words from '../src/dashboard/text/ar.json';
import { bundledReference, readReference } from '../src/reference';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

const read = readReference(bundledReference);
if (!read.ok) throw new Error('The bundled reference does not read');
const { profile, bells } = read;

let directory: FakeDirectory;
const root = () =>
  show(<DashboardRoot profile={profile} bells={bells} onBack={() => undefined} onReader={() => undefined} />);
const typed = (testID: string) =>
  (
    rendered().root.findAll((one) => one.props.testID === testID && one.props.value !== undefined)[0]?.props as {
      value: string;
    }
  ).value;

beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'web');
  directory = new FakeDirectory();
  directory.install();
});

afterEach(async () => {
  await unmount();
  jest.restoreAllMocks();
});

describe('the code gate', () => {
  const openReference = async () => {
    await root();
    await press('dashboard-reference');
  };

  it('sets the first code, typed twice', async () => {
    await openReference();
    await type('gate-code', 'made-up-code');
    await type('gate-again', 'other-code-1');
    await press('gate-open');
    expect(shown()).toContain(words.gate.different);
    expect(directory.referenceCode).toBeNull();
    await type('gate-again', 'made-up-code');
    await press('gate-open');
    expect(directory.referenceCode).toBe('made-up-code');
    expect(has('gate-code')).toBe(false);
  });

  it('asks for the code it set when the page then fails to read', async () => {
    directory.failingOn = 'GET /directory/reference/state';
    await openReference();
    await type('gate-code', 'made-up-code');
    await type('gate-again', 'made-up-code');
    await press('gate-open');
    expect(directory.referenceCode).toBe('made-up-code');
    expect(shown()).toContain(words.problem.network);
    expect(shown()).not.toContain(words.gate.taken);
    expect(has('gate-again')).toBe(false);
    directory.failingOn = null;
    await press('gate-open');
    expect(has('gate-code')).toBe(false);
  });

  it('refuses a code too short before sending it', async () => {
    await openReference();
    await type('gate-code', 'short');
    await type('gate-again', 'short');
    await press('gate-open');
    expect(shown()).toContain(words.gate.badCode);
    expect(directory.seen.filter((one) => one.startsWith('POST'))).toEqual([]);
  });

  it('asks for the code once set, and says when it is refused', async () => {
    directory.referenceCode = 'made-up-code';
    await openReference();
    expect(has('gate-again')).toBe(false);
    await type('gate-code', 'wrong-code-1');
    await press('gate-open');
    expect(shown()).toContain(words.problem.refused);
    await type('gate-code', 'made-up-code');
    await press('gate-open');
    expect(has('gate-code')).toBe(false);
  });

  it('forgets the code on locking', async () => {
    directory.referenceCode = 'made-up-code';
    await openReference();
    await type('gate-code', 'made-up-code');
    await press('gate-open');
    await press('dashboard-side-lock');
    expect(typed('gate-code')).toBe('');
  });

  it('says the server is waking, and goes on', async () => {
    directory.asleep = 1;
    await openReference();
    expect(has('dashboard-waking')).toBe(true);
    await ReactTestRenderer.act(() => new Promise((done) => setTimeout(done, 1100)));
    await act();
    expect(has('dashboard-waking')).toBe(false);
    expect(has('gate-code')).toBe(true);
    expect(directory.seen.filter((one) => one.endsWith('/claimed'))).toHaveLength(2);
  });

  it('offers a retry when the server cannot be reached', async () => {
    directory.failing = 500;
    await openReference();
    expect(shown()).toContain(words.problem.network);
    directory.failing = null;
    await press('dashboard-retry');
    expect(has('gate-code')).toBe(true);
  });
});

describe('choosing the school', () => {
  const list = (schools: ReturnType<typeof schoolIn>[]) => {
    directory.draft = { levels: [], schools };
    directory.versions.push({
      format: 1,
      version: '2029.1',
      published: '2029-11-12' as never,
      levels: [{ code: 'cem', options: [] }],
      schools,
    });
  };
  const choose = async (field: string, value: string) => {
    await press(field);
    await press(`${field}-${value}`);
  };

  it('says so while nothing is published', async () => {
    await root();
    await press('dashboard-school');
    expect(has('school-nothing')).toBe(true);
  });

  it('says so while the list published has no school', async () => {
    list([]);
    await root();
    await press('dashboard-school');
    expect(has('school-nothing')).toBe(true);
    expect(has('school-wilaya')).toBe(false);
  });

  it('goes by wilaya, commune and school, to the school’s gate', async () => {
    const commune = { code: '1601', name: { ar: 'بلدية مثال', fr: 'Commune exemple' } };
    list([schoolIn('160101', commune, 'متوسطة مثال'), schoolIn('160102', commune, 'متوسطة أخرى')]);
    await root();
    await press('dashboard-school');
    await act();
    await choose('school-wilaya', '16');
    await choose('school-commune', '1601');
    await choose('school-school', '160102');
    await press('school-next');
    expect(directory.seen).toContain('GET /directory/schools/160102/claimed');
    await type('gate-code', 'school-code-1');
    await type('gate-again', 'school-code-1');
    await press('gate-open');
    expect(directory.schoolCodes.get('160102')).toBe('school-code-1');
    expect(has('gate-code')).toBe(false);
  });
});
