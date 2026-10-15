# Message catalogue and translation platform

This compares three ways to keep the interface text in catalogues, for [#74](https://github.com/djazairdev/minhajna/issues/74), and records the direction agreed there on 15 October 2026. It follows the [engineering rules](../contributing/engineering.md#dependencies): nothing is installed until the checks at the end are done.

## The direction

The interface text goes in **i18next JSON v4** catalogues, read by **i18next** and **react-i18next**. The catalogues ship inside the app, so every language works offline. Arabic is the source language and the fallback. Translators work in **Weblate**, and a person reviews every import.

Three reasons:
- **It is closest to what we have.** The app already reads its text from `apps/android/src/text/ar.json`, and JSON v4 keeps that form.
- **Arabic plurals are easy to check.** Each of the six forms is its own entry, with a named suffix, so a reviewer sees them all.
- **Weblate supports it.** Weblate has a dedicated `i18nextv4` format that knows about plurals and placeholders.

Lingui and React Intl would also work. The choice is about fit with this project, not about quality. None of the three has been measured in the APK yet.

## The three options

Versions are the published packages on 15 October 2026.

| | A. i18next + react-i18next (chosen) | B. Lingui | C. React Intl (FormatJS) |
|---|---|---|---|
| Packages | i18next 26.4.5, react-i18next 17.0.17 | @lingui/core and @lingui/react 6.9.1 | react-intl 12.1.4 |
| Licence | MIT | MIT | BSD-3-Clause |
| Translators' files | JSON, one entry per plural form | PO files with ICU messages, compiled to JavaScript | JSON with ICU messages |
| Arabic plurals | All six forms | All six forms | All six forms |
| Weblate | Dedicated `i18nextv4` format | PO; ICU plurals need a round-trip test | Dedicated `formatjs` format; the plural forms sit inside one message |
| Build cost | None: the JSON is read as it is | A compile step in Babel and Metro | Optional compile step |
| Watch out for | If the phone lacks plural rules, it quietly falls back to English-style one/other | 6.9.1 needs Node.js 22.19, above our 22.18 | Its own number and date formatting must not bypass ours (#73) |
| Added APK size | Not measured | Not measured | Not measured |

Sources: [i18next JSON v4](https://www.i18next.com/misc/json-format), [i18next plurals](https://www.i18next.com/translation-function/plurals), [Lingui catalogue formats](https://lingui.dev/ref/catalog-formats), [React Intl](https://formatjs.github.io/docs/react-intl/), and Weblate's [i18next](https://docs.weblate.org/en/latest/formats/i18next.html), [PO](https://docs.weblate.org/en/latest/formats/gettext.html) and [FormatJS](https://docs.weblate.org/en/latest/formats/formatjs.html) pages.

In Weblate, choose `i18nextv4` explicitly: its generic example still shows v3.

## Arabic plurals

Arabic has six plural forms. "100 and more" is not one of them: 101 and 102 take "other", while 103 takes "few". These are the counts the tests must cover, from [Unicode CLDR 49](https://www.unicode.org/cldr/charts/49/supplemental/language_plural_rules.html):

| Form | Counts to test | JSON v4 suffix |
|---|---|---|
| Zero | 0 | `_zero` |
| One | 1 | `_one` |
| Two | 2 | `_two` |
| Few | 3, 10, 103, 110, 203 | `_few` |
| Many | 11, 99, 111, 199 | `_many` |
| Other | 100, 101, 102, 200 | `_other` |

Each test checks the form chosen and the reviewed Arabic sentence, for both `ar` and `ar-DZ`. French and English have their own rules: French uses "one" for 0 and 1, and "many" for 1,000,000.

Node.js 22.23.2 gives all of these with `Intl.PluralRules('ar-DZ')`. That proves nothing about the phone: the app runs on Hermes, and its documentation disagrees about whether Hermes has `Intl.PluralRules` ([Hermes](https://github.com/facebook/hermes/blob/static_h/doc/Features.md), [FormatJS](https://formatjs.github.io/docs/guides/react-native-hermes/)). So the release app must be checked on Android 8 and a recent Android. If the rules are missing, load the maintained FormatJS polyfill with only Arabic, French and English data ([polyfill](https://formatjs.github.io/docs/polyfills/intl-pluralrules/)).

## What the packages weigh

The nine package archives below were downloaded outside the repository and checked against the registry's SHA-512. Nothing was installed or run.

| Package | Archive bytes | Unpacked bytes | Licence |
|---|---:|---:|---|
| [i18next 26.4.5](https://registry.npmjs.org/i18next/26.4.5) | 125,936 | 525,431 | MIT |
| [react-i18next 17.0.17](https://registry.npmjs.org/react-i18next/17.0.17) | 232,058 | 958,372 | MIT |
| [@lingui/core 6.9.1](https://registry.npmjs.org/@lingui%2fcore/6.9.1) | 8,978 | 30,345 | MIT |
| [@lingui/react 6.9.1](https://registry.npmjs.org/@lingui%2freact/6.9.1) | 8,300 | 24,590 | MIT |
| [react-intl 12.1.4](https://registry.npmjs.org/react-intl/12.1.4) | 43,649 | 199,219 | BSD-3-Clause |
| [@formatjs/intl-pluralrules 6.3.15](https://registry.npmjs.org/@formatjs%2fintl-pluralrules/6.3.15) | 177,205 | 972,094 | MIT |
| [@formatjs/intl-locale 5.3.12](https://registry.npmjs.org/@formatjs%2fintl-locale/5.3.12) | 226,491 | 1,205,407 | MIT |
| [@formatjs/intl-getcanonicallocales 3.2.12](https://registry.npmjs.org/@formatjs%2fintl-getcanonicallocales/3.2.12) | 507,215 | 2,062,585 | MIT |
| [intl-pluralrules 2.0.1](https://registry.npmjs.org/intl-pluralrules/2.0.1) | 14,052 | 65,087 | ISC |

These are not what the app would grow by: archives hold extra builds and type files, and leave out each package's own dependencies. Only a measured APK counts.

## Rules for the catalogues

For #21, once the checks below are done:
- **Stable IDs.** Each text has an explicit ID, in one catalogue per language. Wording lives in the catalogues, never in the components.
- **Every visible text** goes through the catalogue: labels, screen-reader labels, alerts and notifications. A teacher's own words, such as a lesson title, are data, not catalogue entries.
- **Checked at build time:** every ID present, every plural form present, placeholders kept, nothing empty.
- **Dates and numbers** come from the core's formatter (#73), never from the library, so digits stay Western and month names stay Algerian.
- **Offline only.** The catalogues are bundled. No download of translations, no sending of missing keys, and no logging of the values put into a text.
- **The language and the direction.** Changing the catalogue does not change the layout's direction: React Native applies right to left only after a restart, and the app forces it today ([I18nManager](https://reactnative.dev/docs/i18nmanager)). #21 settles how a language choice switches the direction, with #72.

## How translators work

1. A maintainer sets up Weblate with the catalogues, Arabic as the source language and the `i18nextv4` format.
2. Translators suggest translations in the browser, with a glossary and made-up examples only. A fluent reviewer checks them.
3. A person brings the reviewed changes into a pull request, checks the plural forms and placeholders, and signs it off. Weblate never writes to `main` on its own.
4. Each release ships the catalogues it was tested with. If Weblate is down, the app is not affected, and the teachers' form stays open.

## Before #21 adds the libraries

- [ ] Check `Intl.PluralRules` in the release app on Android 8 and a recent Android, with every count in the table above. Add the polyfill only if it fails.
- [ ] Measure the APK with the libraries and any polyfill, against `main`, and check that two clean builds still match.
- [ ] Round-trip one Arabic text with all six forms through Weblate into French and English.
- [ ] Settle the catalogues' licence. `REUSE.toml` licenses `apps/android/src/text/*.json` under AGPL-3.0-or-later, while translations from teachers come under CC BY-SA 4.0 ([CONTRIBUTING.md](../../CONTRIBUTING.md#content-contributions)).
- [ ] Decide where Weblate runs and who holds the account. Weblate offers [free hosting to libre projects](https://weblate.org/en/hosting/).
