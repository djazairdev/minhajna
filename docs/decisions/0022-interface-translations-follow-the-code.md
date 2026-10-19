# 0022. The interface's texts and their translations follow the code's licence

- **Date:** 2026-10-15, accepted the same day
- **Status:** Accepted
- **Decided by:** the lead maintainer

## Context

The apps' interface texts live in catalogues, one file per language, such as `apps/android/src/text/ar.json`. Translators will add the French and English ones, and later other languages, through Weblate ([#74](https://github.com/djazairdev/minhajna/issues/74)).

Two rules disagreed about these files:
- `REUSE.toml` licenses the catalogues under AGPL-3.0-or-later, like the code they ship in.
- CONTRIBUTING.md lists translations with content, and contributors agree to publish content under CC BY-SA 4.0.

[0002](0002-licences.md) sets AGPL-3.0-or-later for the apps and CC BY-SA 4.0 for documents and teachers' content. It does not say where interface texts belong. This has to be settled before translators are invited, since each one agrees to a licence when they contribute.

## Options

- **Catalogues under CC BY-SA 4.0.** Translators would work under the same licence as teachers' plans. But the APK would then mix two licences, would have to credit each translator, and could combine them with the AGPL code only through Creative Commons' one-way compatibility with GPLv3. That is rare for interface texts.
- **Both licences at once.** Translators would offer their work under AGPL-3.0-or-later or CC BY-SA 4.0, so the texts could also be reused in documents. This gives more to explain to every translator, for a reuse nobody has asked for yet.
- **Interface texts follow the code: AGPL-3.0-or-later.** The texts are part of the program, as in GNOME, KDE and most apps on F-Droid. The app keeps one licence, which the Ministry and anyone who forks it already understand. Chosen.

## Decision

- The apps' interface texts, in every language, are under AGPL-3.0-or-later, like the code. This covers the catalogues and every translation of them.
- Translations of documents, such as the privacy policy, the guides and print layouts, stay under CC BY-SA 4.0, like the documents themselves. So does content that teachers make: plans, distributions, templates and corrections ([0002](0002-licences.md)).
- Translations of the interface take the DCO sign-off, like code ([0003](0003-contributor-terms-dco.md)). Through Weblate, the translator agrees to the DCO there, and each commit Weblate makes carries their sign-off.

Details: [PRD §1.3](../prd/PRD.md#13-licences) and [§1.17](../prd/PRD.md#117-decisions-and-open-points).

## Consequences

- `REUSE.toml` already labels the catalogues correctly, so no file changes licence.
- CONTRIBUTING.md separates the two kinds of translation: interface texts under AGPL-3.0-or-later with a sign-off, documents under CC BY-SA 4.0.
- Weblate's set-up must show the licence and the DCO to each translator, and sign off their commits. Where Weblate runs is still to be decided, with the rest of #74's open points.
