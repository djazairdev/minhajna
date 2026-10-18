// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { waitFor } from '../jest/fake-storage';
import { errorCode, idleLongEnough, typed, waitWording } from '../src/lock/lock-rules';
import { onUse, noteUse } from '../src/lock/activity';
import ar from '../src/text/ar.json';
import en from '../src/text/en.json';
import fr from '../src/text/fr.json';
import { i18n } from '../src/text/i18n';

test('a wait reads in seconds under a minute, else in minutes rounded up', () => {
  expect(waitWording(30)).toEqual({ key: 'lock.waitSeconds', count: 30 });
  expect(waitWording(0.2)).toEqual({ key: 'lock.waitSeconds', count: 1 });
  expect(waitWording(59)).toEqual({ key: 'lock.waitSeconds', count: 59 });
  expect(waitWording(60)).toEqual({ key: 'lock.waitMinutes', count: 1 });
  expect(waitWording(61)).toEqual({ key: 'lock.waitMinutes', count: 2 });
  expect(waitWording(3600)).toEqual({ key: 'lock.waitMinutes', count: 60 });
});

test('the app is idle after the whole delay, or when the clock went back', () => {
  expect(idleLongEnough(0, 4 * 60_000 + 59_999, 5)).toBe(false);
  expect(idleLongEnough(0, 5 * 60_000, 5)).toBe(true);
  expect(idleLongEnough(10_000, 5_000, 5)).toBe(true);
});

test('a PIN takes four digits and nothing else', () => {
  expect(['1', '2', '3', '4', '5'].reduce(typed, '')).toBe('1234');
  expect(typed('12', 'a')).toBe('12');
  expect(typed('12', '٣')).toBe('12');
});

test('reads the native error code, and nothing from other failures', () => {
  expect(errorCode(Object.assign(new Error('x'), { code: 'E_NO_SPACE' }))).toBe('E_NO_SPACE');
  expect(errorCode(new Error('x'))).toBeUndefined();
  expect(errorCode('E_LOCKED')).toBeUndefined();
  expect(errorCode({ code: 3 })).toBeUndefined();
});

test('the fake waits as long as the device does', () => {
  expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map(waitFor)).toEqual([
    0, 0, 0, 0, 30, 60, 120, 240, 480, 960, 1920, 3600, 3600,
  ]);
});

test('use reaches every listener until it stops listening', () => {
  const heard: string[] = [];
  const stopA = onUse(() => heard.push('a'));
  const stopB = onUse(() => heard.push('b'));
  noteUse();
  stopA();
  noteUse();
  stopB();
  noteUse();
  expect(heard).toEqual(['a', 'b', 'b']);
});

test('every lock text is in each language, and the Arabic footer matches the design', () => {
  const keys = (catalogue: object, prefix = ''): string[] =>
    Object.entries(catalogue as Record<string, unknown>).flatMap(([key, value]) =>
      typeof value === 'object' && value !== null ? keys(value, `${prefix}${key}.`) : [`${prefix}${key}`],
    );
  const base = (key: string) => key.replace(/_(zero|one|two|few|many|other)$/, '');
  const arabic = new Set(keys(ar.lock).map(base));
  expect(new Set(keys(fr.lock).map(base))).toEqual(arabic);
  expect(new Set(keys(en.lock).map(base))).toEqual(arabic);
  expect(i18n.getFixedT('ar')('lock.footer', { count: 5 })).toBe(
    'يُقفَل التطبيق بعد 5 دقائق دون استعمال. ولا يحفظ بصمة ولا صورة وجه، بل يطلبهما من الهاتف.',
  );
  expect(i18n.getFixedT('ar')('lock.waitSeconds', { count: 30 })).toBe('انتظر 30 ثانية قبل محاولة أخرى.');
  expect(i18n.getFixedT('en')('lock.footer', { count: 1 })).toContain('after 1 minute unused');
});
