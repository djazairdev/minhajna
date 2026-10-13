# 0021. Code contributions are open to all from now

- **Date:** 2026-10-13, accepted the same day
- **Status:** Accepted
- **Decided by:** the lead maintainer

## Context

The opening plan ([PRD §1.13](../prd/PRD.md#113-opening-in-stages)) took code contributions by invitation until the launch in September 2027. It was written before there was any code, to protect a design that was still settling.

Since then, the code has its first parts: the shared core, the Android app, which builds reproducibly, and Algeria's reference data. Every pull request now runs the checks: the build, the types, the linter, the tests, the sign-off, the licence of every file, secrets, and the licences and vulnerabilities of new dependencies. The field-check tickets split into small pieces that a newcomer can take one at a time. djazairdev's Hub brings developers looking for a first contribution ([0020](0020-code-host-djazairdev.md)).

Adoption by the Ministry needs a project that does not rest on one person ([0016](0016-non-commercial.md)). An invitation that each developer must ask for before writing a line turns away the very people who would spread that weight.

## Options

- **Keep code by invitation until the launch.** Every contributor is known in advance, but each one has to ask first, and the field check is built by fewer hands.
- **Treat taking an issue as the invitation.** Keeps the plan's wording, but an invitation that everyone receives is an invitation in name only.
- **Open code contributions to all now.** Anyone may take an issue and send a pull request. The review rules, not an invitation, protect the design. Chosen.

## Decision

- Code contributions are open to all from 13 October 2026, at stage 1 of the opening plan. Stage 3 no longer opens them.
- Nothing about review changes ([PRD §1.7](../prd/PRD.md#17-contributions)): a maintainer reviews every pull request, privacy-sensitive changes get extra review, and every commit is signed off under the DCO ([0003](0003-contributor-terms-dco.md)).
- Larger changes are agreed in an issue before the code, as [the workflow](../contributing/workflow.md#before-you-start) asks. A new dependency is agreed in its issue first ([engineering.md](../contributing/engineering.md#dependencies)).
- Maintainers are still invited, as [GOVERNANCE.md](../../GOVERNANCE.md) describes.

Details: [PRD §1.13](../prd/PRD.md#113-opening-in-stages) and [§1.17](../prd/PRD.md#117-decisions-and-open-points).

## Consequences

- **More pull requests to review,** by a single maintainer for now. The pledge to answer a newcomer within 7 days still holds, and small issues with clear "done when" lines keep each review short.
- **Issues are claimed before work starts,** by a comment, so that two people don't build the same thing. An assigned issue with no activity for 30 days can go to someone else.
- **CONTRIBUTING.md, the README and the workflow** say that code is welcome, and point to the issues labelled `good first issue` and `help wanted`.
- **The opening plan's other stages stand:** the beta group and the changelog in the pilot, the teacher council and the F-Droid listing at the launch, and the insights method before collection.
