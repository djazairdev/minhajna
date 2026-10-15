# Message catalogue and translation platform: issue #74

Research date: 15 October 2026. Status: **proposed, awaiting human review and maintainer agreement**. Based on `main` at `4d8db4c`; this is independent of the navigation and contrast PRs.

## Recommendation

Use **i18next JSON v4, i18next and react-i18next**, with **Weblate** as the proposed translator interface. Keep every catalogue in the app for offline use. Arabic is the complete source and fallback language; French and English follow as reviewed translations become ready.

This is a fit recommendation, **not approval to install dependencies or deploy a translation service**. The exact Hermes capabilities, polyfill requirement and APK cost still need an approved integration check. No library wins a measured APK-size comparison here.

The main reasons are the existing JSON catalogue, explicitly named Arabic plural forms, and Weblate's dedicated plural-aware v4 format. Lingui is a credible compiled-catalogue alternative; React Intl is a credible ICU alternative. Their trade-offs are below, not grounds to call either unsuitable in general.

No app code, dependency, lockfile, PRD, licence policy or network flow is changed by this document. Nothing has been posted on the issue. #74 remains open until its comparison is reviewed, submitted by a person and agreed by a maintainer.

## Project requirements

- [#74](https://github.com/djazairdev/minhajna/issues/74) asks for two or three options covering Arabic plurals, licensing, app size, offline use and a libre translation platform. It requires agreement **before code**.
- [#21](https://github.com/djazairdev/minhajna/issues/21) requires catalogue-only interface text, language selection and direction changes, with Arabic plural tests. [#73](https://github.com/djazairdev/minhajna/issues/73) owns shared date/number formatting; do not duplicate that work.
- [PRD §1.14](../prd/PRD.md#114-algeria-first-flexible-for-other-countries), [§3.11](../prd/PRD.md#311-pilot-and-launch) and [§6.8](../prd/PRD.md#68-non-functional-requirements) require translatable Arabic/French/English interfaces, RTL/LTR, Western digits, offline work and a small install.
- [PRD §3.8](../prd/PRD.md#38-the-documents) fixes date forms and Algerian month names. The interface language does not determine the subject's document language.
- The app currently imports three strings from [`ar.json`](../../apps/android/src/text/ar.json). It uses React 19.3.0, React Native 0.87.1, Hermes and TypeScript 6.0.3. Both npm projects declare Node >=22.18 and disable install scripts with `engine-strict=true`.
- The [engineering rules](../contributing/engineering.md#dependencies) require dependency approval, allowed licences, no proprietary/telemetry SDKs and no automatic data transfer. Translation work must also respect the [human-review and sign-off workflow](../../CONTRIBUTING.md#ai-assisted-contributions).

## Three options side by side

Versions are the published packages inspected on the research date, not newly installed or approved versions.

Weblate's rolling `/latest/` pages displayed 2026.11 when read. They are not evidence that a 2026.11 deployment was available on the research date; the chosen service's released version and format behaviour must be checked separately.

| Criterion | A. i18next + react-i18next — recommended | B. Lingui core + React | C. React Intl / FormatJS |
|---|---|---|---|
| Packages inspected | i18next 26.4.5; react-i18next 17.0.17 | @lingui/core and @lingui/react 6.9.1 | react-intl 12.1.4 |
| Translator files | JSON v4; named suffixes for plural leaves | PO by default; ICU messages, compiled to JS for runtime | JSON message descriptors / ICU messages; optional build-time AST compilation |
| Arabic | Six CLDR categories through `Intl.PluralRules`; named leaves are easy to inspect | Six ICU categories with a correct plural runtime | Six ICU categories with a correct plural runtime |
| Licence of these packages | MIT | MIT | BSD-3-Clause; direct FormatJS dependencies inspected in registry metadata use MIT or BSD-3-Clause |
| Offline design | Bundle resources directly; do not add a backend | Bundle compiled catalogues | Bundle messages or compiled ASTs |
| Weblate | Dedicated `i18nextv4` format, with plural handling and interpolation checks | PO is supported; ICU-aware checks and a format round trip must be verified | Dedicated `formatjs` format and ICU checking; plural branches live inside one message rather than separate plural fields |
| Build/tooling cost | JSON remains source and runtime data; no catalogue compiler is required | Extraction/compilation and Babel/Metro setup; reproducibility needs checking | Message extraction/compilation can be added; ESM/Jest configuration needs checking |
| Fit with this repo | Closest to the existing files; explicit IDs can remain stable | Strong translator context and compiled catalogues, but a larger workflow change | Strong ICU message descriptions and tooling; less direct mapping from current JSON |
| Important constraint | A missing plural API can silently reduce Arabic to incorrect English-style forms | Published 6.9.1 packages require Node >=22.19, above this repo's declared >=22.18 | Do not let built-in number/date formatting bypass the project's fixed display rules |
| Incremental APK size | **Not measured** | **Not measured** | **Not measured** |

Sources: [i18next JSON v4](https://www.i18next.com/misc/json-format), [plural handling](https://www.i18next.com/translation-function/plurals), [React integration](https://react.i18next.com/latest/using-with-hooks), [Lingui catalogue formats](https://lingui.dev/ref/catalog-formats), [Lingui React Native setup](https://lingui.dev/tutorials/react-native), [React Intl runtime/tooling](https://formatjs.github.io/docs/react-intl/), and Weblate's [i18next](https://docs.weblate.org/en/latest/formats/i18next.html), [PO](https://docs.weblate.org/en/latest/formats/gettext.html) and [FormatJS](https://docs.weblate.org/en/latest/formats/formatjs.html) support. Package licence/engine evidence is linked in the size table.

### Trade-offs that affect the choice

**A:** Choose `i18nextv4` explicitly in Weblate. Its documentation's generic configuration example still shows v3; copying that example would select the wrong format. Ordinary JSON has no inline translator-comment field. Keep key-specific explanations in a tracked reference and translator discussion rather than inserting fake UI strings into the catalogue. [Weblate format details](https://docs.weblate.org/en/latest/formats/i18next.html).

**B:** Lingui's default PO contains ICU plural messages, not ordinary gettext `msgid_plural` entries. Its alternative PO-gettext formatter has limits for nested/multiple plurals and source languages with more than two forms. An Arabic-source round trip must prove it preserves the chosen representation. Do not silently raise the Node minimum to install 6.9.1; an older compatible version or a baseline change would need a separate assessment and maintainer agreement. [Lingui formats](https://lingui.dev/ref/catalog-formats), [published core metadata](https://registry.npmjs.org/@lingui%2fcore/6.9.1).

**C:** Weblate marks the FormatJS format as having no separate plural-unit support while adding ICU checks. That does **not** mean React Intl cannot pluralise Arabic: the categories are branches of an ICU message. Verify the actual editor, completeness checks and re-export of all six branches. [FormatJS format](https://docs.weblate.org/en/latest/formats/formatjs.html).

The fit ranking is an engineering judgement about the present project, not a benchmark or an upstream quality rating. All three can support an offline React app. Exact React Native 0.87.1 integration has not been tested for any candidate in this research.

## Arabic: the acceptance matrix must go beyond 100

Arabic has six cardinal categories. **“100 and more” is not a seventh rule, nor does every number >=100 use `other`.** Unicode's [CLDR 49 table](https://www.unicode.org/cldr/charts/49/supplemental/language_plural_rules.html) gives the following integer cases:

| Category | Required representative counts | JSON v4 suffix |
|---|---|---|
| Zero | 0 | `_zero` |
| One | 1 | `_one` |
| Two | 2 | `_two` |
| Few | 3, 10, 103, 110, 203 | `_few` |
| Many | 11, 99, 111, 199 | `_many` |
| Other | 100, 101, 102, 200 | `_other` |

Future tests must assert both the selected category **and the rendered, reviewed phrase**. Test `ar` and the supported `ar-DZ` fallback path. A single ternary for singular/plural, a hand-written “>=100” branch, or English-only tests are insufficient. Validate session counts as finite non-negative integers; other number types need their own formatting/grammar requirements.

French and English need their own expected results, not copies of the Arabic categories. The host check below returned French `one` for 0 and 1, `other` for 2, and `many` for 1,000,000; English returned `other`, `one`, `other` for 0, 1, 2. Do not assume French always has only two categories. [CLDR rules](https://www.unicode.org/cldr/charts/49/supplemental/language_plural_rules.html).

**Evidence boundary:** a read-only synthetic check using Node 22.23.2 / ICU 78.2 reproduced every Arabic count in the table with `Intl.PluralRules('ar-DZ')`, plus the French/English cases above. This verifies the host's rules, **not Hermes or any app integration**. No candidate library was executed.

## Hermes and polyfills: do not infer support from Jest

Upstream guidance is inconsistent. Hermes' [feature list](https://github.com/facebook/hermes/blob/static_h/doc/Features.md) lists expanded Intl APIs, including PluralRules and Locale, as planned. FormatJS's [plural-polyfill page](https://formatjs.github.io/docs/polyfills/intl-pluralrules/) says Hermes lacks PluralRules, while its [React Native guide](https://formatjs.github.io/docs/guides/react-native-hermes/) lists it and Locale as available in newer Hermes. Lingui's [native tutorial](https://lingui.dev/tutorials/react-native) also calls for polyfills but dates that advice to 2024.

Therefore this proposal does **not** assert that our exact engine has or lacks those APIs. The installed React Native package records Hermes `250829098.0.17`; the approved follow-up must probe the release app on API 26 and a newer Android version for:

1. `Intl.PluralRules` availability, supported locales and the complete count matrix above.
2. `Intl.Locale` and `Intl.getCanonicalLocales` if the selected polyfill needs them.
3. Correct results offline on first launch, before any library initialises.

The inspected i18next 26.4.5 distribution returns a dummy `one`/`other` rule when a plural rule cannot be constructed. A working welcome screen or passing Node tests would not expose that Arabic failure. The upstream [current FAQ source](https://github.com/i18next/i18next-gitbook/blob/master/how-to/faq.md) also distinguishes this from the obsolete v21–23 compatibility-v3 workaround. Do not rely on that removed option or silently accept the dummy rule.

**Conditional recommendation:** if the native rules pass on all supported targets, add no plural polyfill. If they fail, assess the maintained FormatJS polyfill first, loading only the missing prerequisite APIs and `ar`, `fr`, `en` plural data locally. Its documented load order is prerequisites, plural implementation, locale data, then i18next. On a target known to require replacement, the force entry avoids its documented expensive conditional probe. The inspected 6.x export map uses paths ending in `.js`, including `polyfill-force.js`; match the pinned package's exports rather than copying extensionless examples blindly. [Polyfill requirements and performance warning](https://formatjs.github.io/docs/polyfills/intl-pluralrules/).

`intl-pluralrules` 2.0.1 is a smaller ISC-licensed alternative with no declared runtime dependencies, but its latest published release is from 2023. Its own [package documentation](https://registry.npmjs.org/intl-pluralrules/2.0.1) and archive describe reliance on `Intl.NumberFormat`. Review maintenance, rule currency and actual Hermes behaviour before substituting it. Its published gzip marketing estimate is not our APK measurement. Do not add a new native Intl implementation just to resolve this issue.

## Size evidence and limits

Nine exact official npm archives were downloaded outside the repository and checked against their registry SHA-512 integrity values. Archive paths were checked before inspection; no package scripts ran, and nothing was installed. All nine archives include a licence file, whose contents were checked against their declared licence. These are not signature/provenance attestations or a full transitive audit.

| Published package | Archive bytes, measured | Unpacked bytes, registry | Declared licence |
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

**These columns are not installed-app cost.** They include alternate builds, declarations and other files Metro may not ship, and exclude dependency closure, shared-package reuse, translations, bytecode and APK compression. In particular:

- react-i18next declares Babel runtime, html-parse-stringify and use-sync-external-store dependencies. Its peer requirements include i18next >=26.2 and React >=16.8, which match the proposed pair and the app's React version.
- Lingui's small top-level archives exclude message-utils, the macro/configuration dependency graph and catalogue tooling. The inspected core/react packages declare Node >=22.19; the app currently promises >=22.18.
- React Intl declares @formatjs/intl, intl-messageformat and the ICU parser, which in turn have dependencies. Comparing its single archive against two packages would be misleading.
- FormatJS prerequisites and locale matching can dominate the cost. Selecting three locale modules does not imply every prerequisite table is equally sliceable.

**Before accepting a dependency change:** approve a bounded comparison using the same messages, languages and toolchain; measure the release JS/Hermes bytes and incremental unsigned APK bytes against one main baseline; report exactly which polyfills and data are included; check startup on a budget phone and two clean builds. Do not substitute browser gzip badges for that result. Recheck the complete resolved licences, Unicode/CLDR notices, vulnerabilities, source availability and F-Droid scanner then. This research does not certify F-Droid eligibility or absence of vulnerabilities.

## Proposed catalogue and offline boundaries

These are recommendations for a future #21 implementation, not changes made here:

1. Keep stable, explicit semantic IDs in versioned JSON, with plural leaves using the v4 suffixes. Retain one catalogue per supported language initially; namespaces can be split when size or ownership justifies it. Put wording in catalogues, not `defaultValue` literals in components.
2. Use Arabic as Weblate's monolingual base file and app fallback. Bundle Arabic, French and English locally. Publish only reviewed languages as selectable; a partially translated language can fall back to Arabic during development, not count as complete at launch. Round-trip an Arabic-source six-form message into English and French before adopting the workflow.
3. Require a typed translation boundary for visible text, navigation labels, accessibility labels/hints, inputs, alerts and notifications. Enforce static UI-string rules with tests using existing tooling; do not silently introduce a new lint dependency. Data values, such as a teacher's own lesson title, are not catalogue entries.
4. Validate required IDs, category coverage, placeholders, empty values and syntax at build time. Preserve the numeric `count` for category selection and pass separately formatted display values where required. Some languages legitimately omit a numeral in a singular/dual phrase; placeholder checks must account for that rather than force unnatural wording.
5. Keep date, school-year and Western-digit output with #73's shared formatter, once available. Do not replace the Algerian month names with generic locale output, or let ICU `#` / automatic number formatting introduce Eastern digits. Keep numeric values numeric in records.
6. Initialise from bundled resources only. No HTTP backend, CDN, translation SDK, online language detection, remote catalogue updates or missing-key upload. Set missing-key saving and debug logging off; never include interpolation values or pupil data in diagnostics. This is a proposed configuration restriction, not a claim that every optional plugin is safe. [i18next options](https://www.i18next.com/overview/configuration-options).

### Language and native direction

Changing catalogue language is not sufficient to switch native layout, navigation transitions or back artwork. React Native says RTL settings persist and take effect at the next application start; it discourages production use of `forceRTL` as a language-switch solution. The current preview unconditionally forces RTL in `MainApplication.kt`, so simply adding a language button would leave French/English incorrect. [I18nManager documentation](https://reactnative.dev/docs/i18nmanager).

Agree a production-appropriate app-language/direction mechanism in #21, coordinate it with #72 and test language choice across relaunches. Do not claim an instant native-direction switch, or add a restart/settings dependency without approval. Test RTL/LTR, mixed Arabic/Latin content, 200% text and spoken TalkBack for each selectable language. This document does not choose a new storage mechanism for the preference.

## Translator workflow and governance

Weblate is [GPL-3.0-or-later software](https://docs.weblate.org/en/latest/contributing/license.html), external to the teacher app. Its [workflow](https://docs.weblate.org/en/latest/admin/continuous.html) supports browser translation and exchanging files with Git. A translator can use its interface without learning Git. This proposal uses a **human-curated import/review path**, not automatic publishing:

1. A maintainer selects an authorised Weblate deployment, confirms its version supports `i18nextv4`, and configures the public UI catalogue files with Arabic as source. Verify the real deployed version; rolling documentation is not an installed-version guarantee.
2. Translators receive a glossary, key explanations and synthetic-only context. They suggest translations through the browser; a fluent reviewer checks wording and accessibility labels. Never upload actual school records, pupil screenshots, private notes or free-text content from an installation.
3. A human curator downloads or imports the reviewed catalogue changes and checks the plural/placeholder diff and CI. The curator makes the contribution under the project's submission rules. A bot cannot certify a person's DCO; do not fabricate translator sign-offs or publish identities without consent.
4. A person submits the PR, and a maintainer merges it. Do not give a service direct write access to protected `main`, bypass review or make its GitHub bot a prerequisite for teachers to contribute.
5. Tested catalogue snapshots ship with app releases. A Weblate outage must not affect opening the app or changing between bundled languages. Keep the teacher-form/curator path available.

If direct Git integration is chosen later, Weblate documents conflicts around squash merges and pending changes. Preserve this repository's squash/review policy; agree how to synchronise pending work instead of changing merge rules implicitly. [Continuous-localisation caveats](https://docs.weblate.org/en/latest/admin/continuous.html).

### Two maintainer decisions before onboarding

**Catalogue contribution licensing.** [PRD §1.7](../prd/PRD.md#17-contributions) and [CONTRIBUTING](../../CONTRIBUTING.md#content-contributions) put teacher content contributions under CC BY-SA 4.0. However, [`REUSE.toml`](../../REUSE.toml) currently labels `apps/android/src/text/*.json` AGPL-3.0-or-later. The precise terms for UI translations must be reconciled before displaying a Weblate licence/consent notice or accepting submissions. Do not assume a CC-only submission can be relabelled AGPL, change the annotation, or add a new contributor agreement on an agent's authority. A maintainer resolves the scope and any required licence decision record first. This is a policy-consistency finding, not a legal opinion.

**Hosting and authority.** Weblate advertises [gratis hosting for public libre projects](https://weblate.org/en/hosting/), but eligibility, capacity, account ownership, access, backup/export and privacy terms still need confirmation. Self-hosting also has an operational cost. This proposal commits to neither a purchase nor a hosting application. Approve the deployment and account-data handling separately; no service was created and no credentials or payment details were requested.

## Approval and implementation checkpoints

- [ ] A person reviews and submits this comparison on #74; a maintainer records the library/format direction and scope of any permitted spike.
- [ ] Confirm exact versions, the full dependency graph and the documented Node minimum without weakening `engine-strict` or enabling install scripts.
- [ ] Probe the actual Hermes/API 26 and newer runtime; prove all required plural cases before choosing whether to add a polyfill.
- [ ] Perform a synthetic Weblate v4 round trip with Arabic as source, all six categories, French/English targets and preserved placeholders; verify the deployed editor rather than infer support from a format name.
- [ ] Report release-bytecode/APK cost, cold-start results and reproducibility with the actual required polyfills. Accept any material increase explicitly.
- [ ] Resolve catalogue-contribution terms and approve deployment/account handling before onboarding translators.
- [ ] Implement #21 only after agreement, with catalogue/static-text checks, the shared date/number helper, language persistence and native direction validation. Do not duplicate #73 or claim #72 complete.

**Suggested issue-comment text for human review:**

> I propose i18next + react-i18next with JSON v4 and Weblate, using bundled resources, explicit message IDs, Arabic source/fallback and human-reviewed translation imports. I compared Lingui's compiled PO/ICU workflow and React Intl's ICU/JSON workflow in this audit. The recommendation is based on project fit, not an unmeasured APK ranking. Before a dependency change, I request agreement on a bounded Hermes/Weblate/size check. The catalogue licence mismatch and hosting authority must also be resolved before translator onboarding. No implementation or service setup has been performed.

## What this research actually verified

- Current issue requirements, the repository baseline/configuration and the existing catalogue's three strings.
- The cited official project, Weblate and Unicode documentation; source conflicts are called out above. No third-party comparison article is used as decision evidence.
- Exact registry versions, publication dates, dependency/engine declarations, nine archive sizes, SHA-512 matches and included licence files. The main options were published in October 2026; the small standalone polyfill last released in July 2023. Recency alone is not a maintenance or security guarantee.
- The synthetic host plural results above, clearly separate from app/device results.

Still unverified: actual Hermes feature support, Weblate round-trip behaviour, complete transitive licensing/security, incremental APK/bytecode size, startup, native language switching and spoken screen-reader behaviour. No app build or integration test is claimed for this documentation-only work.
