# Weblate

Translators work on the interface's catalogues in Weblate, in their browser, without Git ([0023](../../docs/decisions/0023-self-hosted-weblate.md)). This folder holds everything needed to run the same instance anywhere:

| File | What it is |
|---|---|
| `compose.yaml` | Weblate's own Docker Compose setup: Weblate, PostgreSQL and Valkey, each image pinned by version and digest |
| `environment.example` | The settings, to copy to `environment` and fill in; the copy holds secrets and is never committed |
| `project.json`, `component.json`, `namespaces.json` | The project, the main catalogue and the smaller feature catalogues |
| `configure.js` | Sets up these components through Weblate's API; feature catalogues share the main component's repository |

## Start it on your computer

You need Docker with Compose, and about 2 GB of disk for the images.

```bash
cd infra/weblate
cp environment.example environment
chmod 600 environment
```

Fill in every `<…>` in `environment`, then:

```bash
docker compose up -d
```

Weblate is ready when `docker compose ps` shows it as healthy, at <http://localhost:8080>. Sign in as `admin` with the password from `environment`, and create an API key under your profile's API access.

## Set up the project

```bash
WEBLATE_URL=http://localhost:8080 WEBLATE_TOKEN=<your API key> \
REPOSITORY=<the repository's address> PUSH=<where Weblate pushes> \
node infra/weblate/configure.js
```

Run it from the repository's root, with Node.js 22 or later. It creates the project and the component, or updates their settings when they exist. It also marks the brand and the language names read-only, and turns off Weblate's placeholder check on counted texts, which the catalogue test checks instead. Change a setting in the JSON files and run it again, rather than changing it in Weblate's pages, so that the files stay the truth.

The component reads `apps/android/src/text/*.json` in i18next's JSON v4 format, with Arabic as the source, and offers French and English. To add a language, add its code to `language_regex` in `component.json`.

`namespaces.json` adds the Settings catalogue at `apps/android/src/settings/text/*.json`, the calendar at `apps/android/src/calendar/text/*.json`, and the pack editor at `apps/android/src/editor/text/*.json`. They inherit the format, licences, contributor agreement and commit settings, and link to the main component's repository so all use the same translation branch. The app bundles every catalogue; it never contacts Weblate. After merging a new namespace, a maintainer reruns `configure.js` on their instance. It makes Weblate pull the repository first, so the new catalogue's files are found, and stops with a message if the pull fails. Pulling first commits any pending translations, which may then reach the `weblate` branch sooner than their usual day's wait. No instance is changed merely by checking out the code.

Linked components share the complete checkout, as [Weblate's repository-sharing guide](https://docs.weblate.org/en/latest/vcs.html#weblate-internal-urls) explains. Keep their administration with the same trusted maintainers; a component's file mask is not a permissions boundary.

## How a translation reaches `main`

1. Before their first translation, a translator accepts the contributor agreement: their work is under AGPL-3.0-or-later, and each commit carries their sign-off under the DCO ([0022](../../docs/decisions/0022-interface-translations-follow-the-code.md)).
2. Weblate commits each language's changes in the translator's name, with `Signed-off-by` and the commit email they chose in their profile. It commits after 24 hours, or when a maintainer asks.
3. It pushes to the `weblate` branch, never to `main`.
4. A maintainer opens a pull request from that branch. The checks run on it as on any other, the catalogue test among them: every text present, the same placeholders, and each language's plural forms. A fluent reviewer reads it, then the maintainer squash-merges it.

## Keep it working

- **Update.** Change the three image lines in `compose.yaml` to the new versions and digests, read Weblate's release notes, then run `docker compose pull` and `docker compose up -d`. If a newer Weblate answers repository operations with a queued task (HTTP 202) instead of a result, teach `configure.js` to wait for that task before relying on it. Weblate updates its database as it starts.
- **Back up.** The `database-data` and `weblate-data` volumes. Weblate also makes its own backups once a backup service is set in its admin pages.
- **Logs.** `docker compose logs weblate`.

## On a host

Not chosen yet ([0023](../../docs/decisions/0023-self-hosted-weblate.md)). Before translators are invited, the host needs:

- HTTPS in front of port 8080, from a reverse proxy or a tunnel, with the three proxy settings at the end of `environment` turned on and `WEBLATE_SITE_DOMAIN` and `WEBLATE_ALLOWED_HOSTS` set to its address.
- A mail server, for registration and password resets.
- Credentials for Weblate to push its branch, limited to that: for example, a fork owned by a separate account, so that its key can't write to this repository.
- A privacy notice for translators: their account holds a name, an email address and their translations, and their commits are public.
