// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Pupils' names replaced in what a teacher types into a problem report
// (#249, PRD §1.5, R-1.5-10, answer 483). Every pupil's name as the class
// lists write it, Arabic or Latin, whole or in part and in any order,
// becomes «تلميذ 1», «تلميذ 2» in the order the pupils first appear, and so
// does a pupil's registration number. Words are compared without vowel
// marks or tatweel, with every alef read as one, ة as ه and ى as ي; Latin
// ones without case or accents. Two or three name words may be typed joined,
// apart or with a hyphen, as «عبد القادر», «عبد-القادر» or «عبدالقادر», and a
// registration number in groups. A word may carry و or ف, then ب, ل or ك,
// which are kept, and «لل» reads as «ال». Particles such as «بن» or
// "el" are replaced only next to another part of the name. Common words that
// are also names are replaced too: a report loses a word rather than keep a
// name. Only «على», «إلى» and the like are never read as a name ending in ي.

/** A pupil's names and registration number as the class list holds them. */
export interface NamedPupil {
  readonly name: string;
  readonly latinName?: string;
  readonly registration?: string;
}

const WORD = /[\p{L}\p{M}]+|[0-9٠-٩]+/gu;
const PARTICLES = new Set(['بن', 'ابن', 'بو', 'ال', 'ولد', 'el', 'al', 'ben', 'bel', 'ou', 'de', 'la', 'le']);
const DIGITS = /^[0-9٠-٩]+$/u;
const APART = /^(?:\s+|\s*[-_]\s*)$/u;
const STOPS = new Set(['علي', 'الي', 'حتي', 'متي', 'لدي', 'سوي']);

/** A word as names are compared: Arabic without marks, alefs as one, ة as ه, ى as ي; Latin lower case, no accents. */
export function nameKey(word: string): string {
  return word
    .normalize('NFD')
    .replace(/[ً-ٰٟـ]/gu, '')
    .replace(/[آأإٱ]/gu, 'ا')
    .replace(/ة/gu, 'ه')
    .replace(/[ىی]/gu, 'ي')
    .replace(/ک/gu, 'ك')
    .replace(/[٠-٩]/gu, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}

/** A word without its marks, as written: «على» and «علي» stay apart. */
function written(word: string): string {
  return word.normalize('NFD').replace(/\p{M}|ـ/gu, '');
}

/** Whether a word only links a name's parts, and is not a name by itself. */
function particle(key: string): boolean {
  return key.length < 2 || PARTICLES.has(key);
}

type Parts = { readonly keys: Map<string, Set<number>>; readonly exact: Set<string> };

/** For each word key, and two or three adjacent name words joined, the pupils whose names hold it. */
function partsOf(pupils: readonly NamedPupil[]): Parts {
  const keys = new Map<string, Set<number>>();
  const exact = new Set<string>();
  const add = (key: string, index: number) => keys.set(key, (keys.get(key) ?? new Set()).add(index));
  pupils.forEach((pupil, index) => {
    for (const name of [pupil.name, pupil.latinName ?? '']) {
      const words = name.match(WORD) ?? [];
      words.forEach((word, at) => {
        add(nameKey(word), index);
        exact.add(written(word));
        if (at > 0) add(nameKey(words[at - 1]!) + nameKey(word), index);
        if (at > 1) add(nameKey(words[at - 2]!) + nameKey(words[at - 1]!) + nameKey(word), index);
      });
    }
    const registration = nameKey(pupil.registration?.trim() ?? '');
    if (/^\d{3,}$/u.test(registration)) add(registration, index);
  });
  return { keys, exact };
}

type Stem = { readonly raw: string; readonly key: string; readonly skip: number };

/** A stem without its first letter, when that letter is one of `letters` and two letters or more are left. */
function strip(stem: Stem, letters: string): Stem[] {
  if (!letters.includes(stem.raw[0] ?? '')) return [];
  const raw = stem.raw.slice(1).replace(/^\p{M}+/u, '');
  const key = nameKey(raw);
  return key.length < 2 ? [] : [{ raw, key, skip: stem.skip + stem.raw.length - raw.length }];
}

/** What a typed word may be read as: itself, then without one or two attached prefixes, «لل» as «ال». */
function stems(word: string): Stem[] {
  const whole = { raw: word, key: nameKey(word), skip: 0 };
  const first = [whole, ...strip(whole, 'وف')];
  const second = first.flatMap((one) => strip(one, 'بلك'));
  const article = [...first, ...second]
    .filter((one) => one.key.startsWith('لل'))
    .map((one) => ({ raw: one.raw.slice(1), key: `ا${one.key.slice(1)}`, skip: one.skip + 1 }));
  return [...first, ...second, ...article];
}

type Found = { readonly start: number; readonly end: number; readonly pupils: Set<number>; readonly strong: boolean };
type Typed = { readonly word: string; readonly start: number };

/** Two or three typed words, or up to eight groups of digits, read as one joined name part, a prefix left outside. */
function joined(text: string, words: readonly Typed[], at: number, parts: Parts): Found | undefined {
  const digits = DIGITS.test(words[at]!.word);
  for (let count = digits ? 8 : 3; count >= 2; count -= 1) {
    const group = words.slice(at, at + count);
    if (group.length < count || (digits && !group.every((one) => DIGITS.test(one.word)))) continue;
    const apart = group
      .slice(1)
      .every((one, index) => APART.test(text.slice(group[index]!.start + group[index]!.word.length, one.start)));
    if (!apart) continue;
    const rest = group
      .slice(1)
      .map((one) => nameKey(one.word))
      .join('');
    const last = group[count - 1]!;
    for (const stem of stems(group[0]!.word)) {
      const pupils = parts.keys.get(stem.key + rest);
      if (pupils !== undefined) {
        return { start: group[0]!.start + stem.skip, end: last.start + last.word.length, pupils, strong: true };
      }
    }
  }
  return undefined;
}

/** The text's words that are name parts, words typed apart counted as one, with any prefix left outside. */
function found(text: string, parts: Parts): Found[] {
  const words = [...text.matchAll(WORD)].map((match) => ({ word: match[0], start: match.index }));
  const out: Found[] = [];
  for (let at = 0; at < words.length; at += 1) {
    const { word, start } = words[at]!;
    const group = joined(text, words, at, parts);
    if (group !== undefined) {
      out.push(group);
      while (at + 1 < words.length && words[at + 1]!.start < group.end) at += 1;
      continue;
    }
    const stem = stems(word).find(
      (one) => parts.keys.has(one.key) && !(STOPS.has(one.key) && !parts.exact.has(written(one.raw))),
    );
    if (stem !== undefined) {
      out.push({
        start: start + stem.skip,
        end: start + word.length,
        pupils: parts.keys.get(stem.key)!,
        strong: !particle(stem.key),
      });
    }
  }
  return out;
}

/** Runs of name parts with only spaces between, each taken by the first pupil holding all of it, or split. */
function runs(text: string, words: readonly Found[]): { start: number; end: number; pupil: number }[] {
  const taken: { start: number; end: number; pupil: number }[] = [];
  let index = 0;
  while (index < words.length) {
    let last = index;
    while (last + 1 < words.length && /^\s+$/u.test(text.slice(words[last]!.end, words[last + 1]!.start))) last += 1;
    let end = last;
    for (;;) {
      const run = words.slice(index, end + 1);
      const common = run.reduce(
        (left, word) => new Set([...left].filter((one) => word.pupils.has(one))),
        run[0]!.pupils,
      );
      if (common.size > 0) {
        if (run.some((word) => word.strong)) {
          taken.push({ start: run[0]!.start, end: run[run.length - 1]!.end, pupil: Math.min(...common) });
        }
        index = end + 1;
        break;
      }
      end -= 1;
    }
  }
  return taken;
}

/** The text with every pupil's name replaced by `label(n)`, n counting pupils in the order they first appear. */
export function replaceNames(text: string, pupils: readonly NamedPupil[], label: (n: number) => string): string {
  const numbers = new Map<number, number>();
  let out = '';
  let at = 0;
  for (const run of runs(text, found(text, partsOf(pupils)))) {
    if (!numbers.has(run.pupil)) numbers.set(run.pupil, numbers.size + 1);
    out += text.slice(at, run.start) + label(numbers.get(run.pupil)!);
    at = run.end;
  }
  return out + text.slice(at);
}
