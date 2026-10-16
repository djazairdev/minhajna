# Instructions for coding agents

<!-- djazairdev-template: 1.5.2 -->

Minhajna is a free, open-source app for teachers in Algeria. The shared core in `packages/core` is part of an npm workspace. The Android app in `apps/android` sits outside it, with its own lockfile and dependencies. Read [CONTRIBUTING.md](CONTRIBUTING.md) and the [contributor handbook](CONTRIBUTING.md#the-contributor-handbook) before you change anything. These rules bind you as they bind a person.

## Run the checks

Node.js 22.18 or later. The same commands CI runs:

```bash
npm ci --no-audit
(cd apps/android && npm ci --no-audit)
npm run typecheck
npm run lint
npm test
```

The Android build has its own checks: [docs/checks/android-build.md](docs/checks/android-build.md).

## Rules

- **Never use real pupil data,** anywhere: not in code, tests, fixtures, screenshots or messages. Use the demo class and made-up Algerian names ([engineering.md](docs/contributing/engineering.md#test-data)).
- **Never send pupil data or secrets to any tool,** yourself included (principle 2).
- **Nothing new leaves the device.** A new or wider network call is a privacy-sensitive change, and `NETWORK.md` changes with it.
- **No new dependency** unless its issue agreed to it, with a licence from the allowed list ([engineering.md](docs/contributing/engineering.md#dependencies)). No analytics, crash-reporting, advertising or AI SDKs, and no proprietary libraries.
- **Every new file carries its licence:** an SPDX header for code (AGPL-3.0-or-later), or an entry in `REUSE.toml` for a file that can't hold a comment. Documents are CC-BY-SA-4.0.
- **Dates, never clock times,** in records and their history.
- **At most 300 lines in any file,** blank lines and comments included. ESLint checks TypeScript and JavaScript; keep every other file to the same limit. Split a file that grows past it by what it does ([engineering.md](docs/contributing/engineering.md#code-style)).
- **Commits follow [commits.md](docs/contributing/commits.md):** a Conventional Commit subject with a listed scope, and an `Assisted-by:` or `Co-authored-by:` trailer for your work. The sign-off (`Signed-off-by:`) certifies the Developer Certificate of Origin, so only the person who submits the change adds it.
- **Decisions are not yours to make.** A change to a principle, a licence, a data flow, the insights layer or money needs a decision record, which a maintainer decides ([workflow.md](docs/contributing/workflow.md#decision-records)).
- **Never open an issue, a pull request or a comment on your own:** a person reviews and submits them ([CONTRIBUTING.md](CONTRIBUTING.md#ai-assisted-contributions)).
