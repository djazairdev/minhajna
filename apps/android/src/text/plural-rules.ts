// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Hermes on Android has no Intl.PluralRules, so i18next would fall back to
// English plurals: 2, 3, 11 and 100 sessions would all take Arabic's "other"
// form. These are the Unicode CLDR cardinal rules for the interface's three
// languages (https://www.unicode.org/cldr/charts/latest/supplemental/language_plural_rules.html).
// Tests compare them with Node's ICU for every count up to 10,000 and for
// decimals. A language added to the interface adds its rule here.

type Category = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other';

/** CLDR's operands: n the absolute value, i its integer digits, v its count of visible fraction digits. */
interface Operands {
  readonly n: number;
  readonly i: number;
  readonly v: number;
}

interface Rule {
  readonly categories: readonly Category[];
  select(operands: Operands): Category;
}

const RULES: Readonly<Record<string, Rule>> = {
  ar: {
    categories: ['zero', 'one', 'two', 'few', 'many', 'other'],
    select: ({ n }) => {
      if (n === 0) return 'zero';
      if (n === 1) return 'one';
      if (n === 2) return 'two';
      const hundreds = n % 100;
      if (Number.isInteger(hundreds) && hundreds >= 3 && hundreds <= 10) return 'few';
      if (Number.isInteger(hundreds) && hundreds >= 11 && hundreds <= 99) return 'many';
      return 'other';
    },
  },
  fr: {
    categories: ['one', 'many', 'other'],
    select: ({ i, v }) => {
      if (i === 0 || i === 1) return 'one';
      if (v === 0 && i !== 0 && i % 1_000_000 === 0) return 'many';
      return 'other';
    },
  },
  en: {
    categories: ['one', 'other'],
    select: ({ i, v }) => (i === 1 && v === 0 ? 'one' : 'other'),
  },
};

/**
 * The operands of a number as Intl.PluralRules sees it: its shortest decimal
 * form, rounded half up to three decimal places, with no trailing zeros. Counts
 * the app shows stay far below 10^12, beyond which no rounding is needed.
 */
function operandsOf(value: number): Operands {
  const n = Math.abs(value);
  if (n >= 1e12) return { n, i: Math.trunc(n), v: 0 };
  if (n < 1e-6) return { n: 0, i: 0, v: 0 };
  const [whole = '0', fraction = ''] = String(n).split('.');
  const thousandths = Number(whole + fraction.slice(0, 3).padEnd(3, '0')) + (Number(fraction[3] ?? '0') >= 5 ? 1 : 0);
  const rounded = thousandths / 1000;
  const digits = String(thousandths % 1000)
    .padStart(3, '0')
    .replace(/0+$/, '');
  return { n: rounded, i: Math.trunc(rounded), v: digits.length };
}

/**
 * The part of Intl.PluralRules that i18next uses: cardinal rules for Arabic,
 * French and English. Any other language or an ordinal rule is refused, and
 * i18next then shows the "other" form rather than a wrong one.
 */
export class PluralRules {
  readonly #language: string;
  readonly #rule: Rule;

  constructor(locales?: string | readonly string[], options?: { readonly type?: string }) {
    if (options?.type !== undefined && options.type !== 'cardinal') {
      throw new RangeError('Only cardinal plural rules are available');
    }
    const requested = (typeof locales === 'string' ? [locales] : (locales ?? [])).map(
      (locale) => locale.split(/[-_]/)[0]?.toLowerCase() ?? '',
    );
    const language = requested.find((code) => Object.hasOwn(RULES, code));
    if (language === undefined) throw new RangeError(`No plural rules for ${requested.join(', ') || 'no language'}`);
    this.#language = language;
    this.#rule = RULES[language];
  }

  select(value: number): Category {
    return Number.isFinite(value) ? this.#rule.select(operandsOf(value)) : 'other';
  }

  resolvedOptions(): { locale: string; type: 'cardinal'; pluralCategories: Category[] } {
    return { locale: this.#language, type: 'cardinal', pluralCategories: [...this.#rule.categories] };
  }
}

/** Puts these rules in Intl.PluralRules where the engine has none, as on Hermes. */
export function installPluralRules(intl: object | undefined = globalThis.Intl): void {
  if (intl === undefined || typeof (intl as { PluralRules?: unknown }).PluralRules === 'function') return;
  Object.defineProperty(intl, 'PluralRules', { value: PluralRules, writable: true, configurable: true });
}
