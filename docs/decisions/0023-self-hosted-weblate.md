# 0023. Translators work in a Weblate instance we run ourselves

- **Date:** 2026-10-16, accepted the same day
- **Status:** Accepted
- **Decided by:** the lead maintainer

## Context

The interface's catalogues are in the repository, Arabic first, with French and English drafts ([#21](https://github.com/djazairdev/minhajna/issues/21)). Translators who don't use Git need a place to work in their browser, and [#74](https://github.com/djazairdev/minhajna/issues/74) chose Weblate, which is free software. [0022](0022-interface-translations-follow-the-code.md) asks that Weblate show the licence and the DCO to each translator and sign off their commits. Where Weblate runs was left open.

The project's goal is that the Ministry runs Minhajna on its own servers ([0009](0009-goal-state-adoption-official-record.md)), so whatever we set up should be something it can run too.

## Options

- **Hosted Weblate's free plan for libre projects.** Run by Weblate's developers in the EU, with nothing for us to run. But the setup lives in their service, not in our repository, and the Ministry would have to rebuild it on its own servers.
- **Codeberg Translate.** A free Weblate run by Codeberg. Its guide expects the repository on Codeberg; ours is on GitHub.
- **Cloudflare Containers.** A container keeps no disk across a sleep, while Weblate keeps a Git checkout of each repository, and it runs one image per container rather than Weblate's four services, so PostgreSQL and Valkey would come from two more providers.
- **Our own instance, from Weblate's official Docker Compose setup, with every setting in the repository.** We run and update it, but anyone, the Ministry included, can start the same instance from the same files. Chosen.

## Decision

- Weblate runs from [`infra/weblate`](../../infra/weblate/README.md): Weblate's own Compose setup, each image pinned by version and digest, and a script that sets up the project through Weblate's API from settings files kept beside it.
- Weblate pushes translators' commits to a `weblate` branch and never to `main`. A maintainer opens the pull request from that branch, checks it as any other, and squash-merges it.
- Each commit is made in the translator's name and signed off with their name and the commit email they choose, under the contributor agreement Weblate shows before their first translation: AGPL-3.0-or-later and the DCO ([0022](0022-interface-translations-follow-the-code.md)).
- Weblate writes the catalogues with two-space indentation, as Prettier does, and keeps each language's CLDR plural forms only. So the catalogues hold exactly those forms, and the catalogue test checks it.
- Brand and language names are read-only. No machine translation and no outside service is turned on: every text is a person's.
- First it runs on a maintainer's computer. The host is chosen once the round trip works there, and before any translator is invited.

## Consequences

- The setup was tested locally on 16 October 2026: a French and an English change went from Weblate to the `weblate` branch as signed-off commits, changing only the edited lines, and passed the catalogue tests and Prettier.
- Someone has to update Weblate's images, back up its database and watch it once it runs on a host.
- Before translators are invited: a host, an address, a mail server for registration, a privacy notice for translators' accounts (a name, an email address and their translations), and the credentials for Weblate to push to its branch.
- A new language needs its code added to the component's language list, and the catalogue test then asks for its CLDR plural forms.
