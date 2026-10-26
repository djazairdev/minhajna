# Contributing to Minhajna

<!-- djazairdev-template: 1.5.2 -->

## What we accept now

The project is at stage 1 of its opening plan ([PRD §1.13](docs/prd/PRD.md#113-opening-in-stages)). We accept:
- feedback and suggestions;
- corrections to annual plans and other reference data;
- print templates and layouts;
- translations: of the interface, which follow the code's licence, and of documents, which follow the documents' ([0022](docs/decisions/0022-interface-translations-follow-the-code.md));
- code, from anyone ([0021](docs/decisions/0021-code-contributions-open-to-all.md)).

## Trying the app or sending feedback

Start with the [Arabic download and testing page](https://djazair.dev/ar/minhajna/) or its [English version](https://djazair.dev/en/minhajna/). For feedback or help, [message us on Facebook](https://www.facebook.com/djazairdev), email [contact@djazair.dev](mailto:contact@djazair.dev), or optionally use GitHub to [report a problem](https://github.com/djazairdev/minhajna/issues/new?template=bug.yml) or [suggest an improvement](https://github.com/djazairdev/minhajna/issues/new?template=idea.yml).

Never send real pupil data through any channel. GitHub reports are public; leave out personal details. Screenshots must use the demo class.

## Taking a development task

For a first code contribution, start with an issue labelled [good first issue](https://github.com/djazairdev/minhajna/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22), or [help wanted](https://github.com/djazairdev/minhajna/issues?q=is%3Aissue+is%3Aopen+label%3A%22help+wanted%22) for a larger one. Comment `/take` on it to have it assigned to you: if someone already has it, the bot says who. Comment `/drop` if you stop. Then follow [Content contributions](#content-contributions) or [Code contributions](#code-contributions) below.

## Never post real pupil data

Never post pupils' names, marks, absences or photos anywhere in the project: not in issues, pull requests, screenshots, videos, test data or messages. Use made-up names.

Why:
- **Civil-service secrecy** covers pupils' marks and attendance (Ord. 06-03 Art. 48).
- **Transfer abroad.** Publishing personal data through a platform run from abroad, such as GitHub, counts as a transfer abroad under ANPDP deliberation 04.

Maintainers remove any post with real pupil data as soon as they see it, and tell its author privately why.

## Report security problems privately

Never report a security problem in a public issue. Follow [SECURITY.md](SECURITY.md) instead.

## Content contributions

Each correction or template must state:
- **its source:** an official text, an inspector's distribution, or your own work;
- **where it applies:** the level, subject and school year.

By contributing content, you agree to publish it under CC BY-SA 4.0. That includes translations of documents, such as the privacy policy and the guides. Tell us how you'd like to be credited, or whether you'd rather not be.

Translations of the app's interface are part of the program, so they are under AGPL-3.0-or-later and signed off like code ([0022](docs/decisions/0022-interface-translations-follow-the-code.md)).

## Code contributions

Read the [contributor handbook](#the-contributor-handbook) before your first pull request. The essentials:
- **Agree first.** For anything larger than a small fix, agree the approach in the issue before you write the code. A new dependency is agreed there too ([engineering.md](docs/contributing/engineering.md#dependencies)).
- **Licence.** Code is licensed under AGPL-3.0-or-later.
- **Sign-off.** Sign off every commit under the [Developer Certificate of Origin 1.1](https://developercertificate.org/) with `git commit -s`. The sign-off certifies that you have the right to submit the work under the project's licence. A GitHub no-reply email address is fine.
- **Copyright.** There is no CLA: you keep the copyright in your contribution.
- **Commit messages** follow [Conventional Commits](docs/contributing/commits.md), for example `fix(export): leave locked cells untouched in the grade workbook`.
- **AI-assisted work** is welcome, on the terms in [AI-assisted contributions](#ai-assisted-contributions).
- **Privacy-sensitive changes** get extra review ([PRD §1.7](docs/prd/PRD.md#17-contributions)). These are changes that touch:
  - network calls;
  - encryption;
  - sync;
  - insights;
  - the export of marks;
  - anything that reads or writes the school's official files.

### Set up and run the checks

You need Node.js 22.18 or later. The same commands CI runs on every pull request:

```bash
git clone https://github.com/djazairdev/minhajna
cd minhajna
npm ci --no-audit
(cd apps/android && npm ci --no-audit)
(cd apps/web && npm ci --no-audit)
npm run typecheck
npm run lint
npm test
(cd apps/web && npm run typecheck && npm test)
```

The Android build has its own checks: [docs/checks/android-build.md](docs/checks/android-build.md). Pull requests also check the sign-off, the licence of every file, the title, secrets, and the licences and vulnerabilities of new dependencies ([workflow.md](docs/contributing/workflow.md#pull-requests)).

### Your first pull request

A checklist that passes every check the first time. Say the issue is #69, a README for the Android app.

1. **Take the issue** by commenting `/take`: it's assigned to you straight away.
2. **Fork the repository, and make a branch** named `<type>/<issue>-<topic>`:

   ```bash
   git switch -c docs/69-android-readme
   ```

3. **Give every new file its licence.** Code starts with an SPDX header, like the files next to it:

   ```ts
   // SPDX-FileCopyrightText: 2026 The Minhajna contributors
   // SPDX-License-Identifier: AGPL-3.0-or-later
   ```

   A file that cannot hold a comment, such as JSON or a font, gets an entry in `REUSE.toml` instead. So does a document outside the folders that file already covers: a new `apps/android/README.md` joins the CC BY-SA 4.0 entry. `reuse lint` tells you which files lack a licence. [engineering.md](docs/contributing/engineering.md#licences-in-every-file) has the rules.
4. **Run the checks** above. For a code change, also format it with `npx prettier --write` on the files you changed.
5. **Commit with a sign-off** (`-s`). The subject is a [Conventional Commit](docs/contributing/commits.md) with a listed scope, under 72 characters, in the imperative, with no full stop:

   ```bash
   git commit -s -m "docs(android): explain how to build and run the app" -m "Fixes #69"
   ```

6. **Open the pull request** with the commit's subject as its title. The description says what changes and why, and how you tested it. If an AI tool wrote a substantial part, say so ([AI-assisted contributions](#ai-assisted-contributions)).

If a check fails:

| Check | What it means | The fix |
|---|---|---|
| Sign-off | A commit has no `Signed-off-by` line | `git rebase --signoff upstream/main`, then `git push --force-with-lease` |
| Commit format | The title does not follow the commit format, or its scope is not in the list | Edit the title on GitHub. The scopes are in [commits.md](docs/contributing/commits.md#scopes) |
| Licence of every file | A new file has no licence | Add the SPDX header, or an entry in `REUSE.toml` |
| Node.js 22 | The type check, the linter or a test fails | Run the commands above, and fix what they report |

## AI-assisted contributions

You're welcome to use AI coding tools, on these terms ([PRD §1.7](docs/prd/PRD.md#17-contributions)):

- **You are the author.** Understand every line you submit, and be ready to explain it in review. "The model wrote it" doesn't answer a review comment.
- **Say so,** in the pull request, and with an `Assisted-by:` or `Co-authored-by:` trailer when a tool wrote a substantial part ([commits.md](docs/contributing/commits.md#ai-assisted-work)). Your sign-off is yours alone.
- **Run the checks yourself,** and report the results you actually got.
- **Point your agent at [AGENTS.md](AGENTS.md).** Most coding agents read it on their own, and its rules bind them as they bind you.
- **No autonomous agents.** A person writes or reviews every issue, pull request and comment; an agent may not open them on its own.
- **Check what a tool finds** before you report it, and report security problems privately. An unchecked report is closed.
- **Never give an AI tool pupil data, secrets or an unpublished security report** (principle 2).
- Maintainers may close a low-effort generated pull request or issue without a detailed review.

## Review

- A maintainer reviews every pull request, as [workflow.md](docs/contributing/workflow.md#review) describes; we may ask for changes, which is normal.
- **On your first pull request, CI waits until a maintainer approves the run.** That's GitHub's safety setting for first-time contributors, not a judgement on your change. Once a pull request of yours is merged, CI runs on its own.
- Answer review comments with new commits rather than a force-push, so the conversation stays readable. The squash merge tidies the history.
- Nothing is closed automatically. If a pull request goes quiet for a long time, we ask before we close it.

## Our pledge

The maintainers reply to every newcomer's pull request within 7 days, even if only to say when we'll review it.

## The contributor handbook

| Guide | What it covers |
|---|---|
| [Workflow](docs/contributing/workflow.md) | Issues, branches, pull requests, review, merging and decision records |
| [Commit messages](docs/contributing/commits.md) | The commit format, the sign-off and AI-assisted work |
| [Versions](docs/contributing/versioning.md) | How the apps, the server, the file formats, the database and the reference data are versioned |
| [Releases](docs/contributing/releases.md) | The release calendar, the release checks, signing and the changelog |
| [Engineering rules](docs/contributing/engineering.md) | The rules every code change follows: privacy, secrets, test data, tests, dependencies and licences |

[CHANGELOG.md](CHANGELOG.md) records the published releases and, under Unreleased, what the next one adds. The [download and testing page](https://djazair.dev/ar/minhajna/) explains the current preview in Arabic.

How the project decides, and the teacher council's part in it, are in [GOVERNANCE.md](GOVERNANCE.md).

## Language

- **With teachers:** Arabic.
- **Code, commits and developer documents:** English, with Arabic summaries of anything teachers need to know.

Use the [Arabic terminology guide](docs/ar/terms.md) for teacher-facing copy. Explain tasks in familiar words, and quote button labels exactly as they appear in the released app.

## Conduct

Be respectful. Don't harass anyone or make personal attacks.

The project's spaces stay about the product. That means no political or union campaigning, and no attacks on named people, whether officials, colleagues, pupils or parents.

The full rules, and how to report a problem privately, are in [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
