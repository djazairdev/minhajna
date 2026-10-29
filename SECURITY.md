# Security policy

## Reporting a problem

Email [contact@djazair.dev privately](mailto:contact@djazair.dev?subject=Minhajna%20private%20report), or use GitHub's [private vulnerability reporting](https://github.com/djazairdev/minhajna/security/advisories/new). Do not post in public.

Include, if known:

- the affected app or service, its version, and your device or browser;
- steps to show the problem, using made-up data;
- what someone could read, change or misuse.

Never include real pupil data, even privately.

## What happens next

- **We acknowledge your report within three working days** ([PRD §1.9](docs/prd/PRD.md#19-official-builds-releases-the-name-and-security)).
- **We keep you informed** while we fix it, and agree a publication date with you.
- **Critical flaws are fixed within 7 days** ([PRD §6.7](docs/prd/PRD.md#67-the-server-and-its-operators)).
- **After the fix,** we publish an advisory that credits you, unless you'd rather not be named.
- **Please keep the problem private** until the fix ships. Without our agreement, that is no longer than 90 days after your report.

## What is in scope

- The apps, the server, the website, and the build and release process.
- Anything that could expose pupil data or teachers' records, or let someone read, change or forge them.
- An official build or a signed file that doesn't match its source, its checksum or its signature.

The previews, 0.1.0 to 0.6.1, are for invited teachers using made-up data. The PC web app, a preview from 0.6.0, opens at https://minhajna.djazair.dev. The [download page](https://djazair.dev/en/minhajna/) links to the signed release; the [organiser's guide](docs/field-check/session-guide.md#checking-that-it-is-the-projects-preview) explains how to verify it. National-system services are not available yet.

## Supported versions

Security fixes go into the latest release. Keep the app up to date to receive them.
