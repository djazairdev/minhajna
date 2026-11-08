# The PC web app's host

Teachers open the PC web app at **<https://minhajna.djazair.dev>** (answers 528 and 531). The project serves it through Cloudflare, and the release workflow deploys each release to it (answers 534 and 537). The host serves one release's files and nothing else. It never sees what a teacher records: the app keeps everything in the teacher's browser and sends nothing back ([NETWORK.md](../../NETWORK.md)).

## What the host serves

- **One release's build.** The release's `minhajna-web-<version>.zip`, unzipped at the root of the address. The host serves no other file, no folder listing and no fallback page. An address the build doesn't hold answers 404.
- **HTTPS only.** Plain HTTP only redirects to the same address over HTTPS.
- **Each file with its media type** and, on every answer, these headers, as `apps/web/scripts/host.ts` gives them:

  | Header | Value |
  |---|---|
  | `Cache-Control` | `no-store` |
  | `Content-Security-Policy` | the page's own policy, from the meta element of `index.html`, then `; frame-ancestors 'self'` |
  | `Referrer-Policy` | `no-referrer` |
  | `X-Content-Type-Options` | `nosniff` |
  | `Strict-Transport-Security` | `max-age=31536000` |

- **Every file exactly as built.** The host adds no cookie, no analytics, and no script, banner or page of its own. It doesn't rewrite files either: a content network's minifying, e-mail protection, script loaders and image optimising stay off. Compressing in transit, with gzip or Brotli, is fine, since the browser gets the same bytes back. One changed byte fails the offline worker's hash check, and the teacher's install or update fails with it.
- **No logs of the project's own** (answer 537, which replaces answer 532). Cloudflare sees each visitor's IP address and browser, under its own policy; the Worker's logs stay off, and the project keeps no access logs. The app only ever sends GET requests for its own files, so no request can carry a teacher's records.

## How Cloudflare serves it

- **One Worker,** `minhajna-web`, at the custom domain `minhajna.djazair.dev` (`apps/web/host/wrangler.jsonc`), in front of the release's files. It answers every request itself (`apps/web/scripts/worker.ts`), as the local server does: the files of the build only, with the headers above, read from the page's own policy; anything else is 404; plain HTTP goes to HTTPS. It has no `workers.dev` or preview address.
- **Cloudflare's own features stay off** for `minhajna.djazair.dev`, as they change files or add cookies: Rocket Loader, Email Address Obfuscation, Auto Minify, Polish, Mirage, Bot Fight Mode, Web Analytics and Network Error Logging. The host check finds a changed file, a cookie or a reporting header.
- **Setting it up, once.** The `djazair.dev` zone is in the Cloudflare account that the organisation's `CLOUDFLARE_ACCOUNT_ID` names, and its `CLOUDFLARE_API_TOKEN` may edit Workers scripts and the zone's Workers custom domains and DNS (answer 538). The first deploy creates the Worker, the address's DNS record and its certificate.

## Deploying a release

[The release workflow](releases.md#the-release-workflow) deploys each release once it is published, when no newer release is tagged (answer 534):

1. **It downloads** `minhajna-web-<version>.zip` and `SHA256SUMS.txt` from the published release, checks the ZIP against it and unzips it into `apps/web/release/dist/`.
2. **It refuses to replace a newer build:** if the host's `build.json` names a newer version, it stops.
3. **It deploys** with Wrangler, from `apps/web/host`, whose own lockfile is installed only for this. Cloudflare serves the new version everywhere within seconds. A teacher whose install meets files of both builds is refused by the worker's hash check, which tries again at the next opening. If a release changes the PDF engine's files, a curator on the previous build can't open a source PDF until they install the update, since the worker fetches the engine from this host and checks it against their build.
4. **It checks the deployed build** with the PC web app's build checksum, the `sha256` in its `build.json`, waiting up to ten minutes while a first address gets its certificate. It must end with `served as built`.

**If the check fails,** the workflow fails and lists each problem. A changed file fails teachers' installs and updates, and a missing header leaves them unprotected, so go back to the previous version at once from `apps/web/host`, with the organisation's token in `CLOUDFLARE_API_TOKEN`, then fix the problem and deploy again by re-running the job:

```bash
node_modules/.bin/wrangler rollback
```

**By hand,** from a checkout of the release's tag with Node.js 26.13 or later, with the ZIP unzipped into `apps/web/release/dist/` and the token in `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`, run `npm ci` then `node_modules/.bin/wrangler deploy` in `apps/web/host`. Then check it from `apps/web`, with the build checksum from the release notes:

```bash
npm run check-host -- https://minhajna.djazair.dev <checksum>
```

Without the checksum, any build the host serves whole would pass, so the check refuses to run away from this computer. The check also reads the page's security policy: it may name no address but its own and, to connect to, the demo server `https://minhajna-demo.djazair.dev` (#544, answer 554), for the hosted app and the self-hosted ZIP alike.

**Never deploy an older build.** The worker never offers a lower version code, so teachers who installed the newer build keep it, and only new installs would get the older one. A broken release is fixed with a new version. Going back is only for a deploy whose check has just failed.

## The hosted test's copy

[The hosted test](../demo-host.md#the-hosted-test) deploys the same files to `https://minhajna-test.djazair.dev`, a second Worker, `minhajna-web-test`, by `wrangler deploy --env test`. Teachers' address and its release stay as they are. It is a different origin, so it sees nothing a browser keeps for `https://minhajna.djazair.dev`.

## The dashboard's host

The dashboard app (answer 855, [its README](../../apps/dashboard/README.md)) is served the same way, at **<https://minhajna-admin.djazair.dev>**, by a Worker of its own, `minhajna-dashboard` (`apps/dashboard/host/wrangler.jsonc`):

- **The same rules.** Its Worker is the web app's own `apps/web/scripts/worker.ts`, so it serves one release's `minhajna-dashboard-<version>.zip` and nothing else, with the headers above, read from the dashboard page's own policy, and the same host check, `npm run check-host` in `apps/dashboard`, holds it to them. Its page names one other address, the demo server, for the directory alone.
- **Set up by its first deploy.** The route is a custom domain, so the first deploy creates the Worker, the address's DNS record and its certificate with the organisation's token, as for `minhajna.djazair.dev` (answer 538). Cloudflare's own features stay off for it as for the web app's address; the host check finds them if they are not.
- **Deployed with each release,** by the release workflow's "Deploy the dashboard app" job, from the published ZIP checked against `SHA256SUMS.txt`, refusing to replace a newer build, then checked with the dashboard's build checksum, which the release's notes give, as the steps above say for the web app. It deploys with the web app's Wrangler, from `apps/dashboard/host`. To go back after a failed check, run `../../web/host/node_modules/.bin/wrangler rollback` there.
- **The hosted test's copy** is `minhajna-dashboard-test`, at `https://minhajna-admin-test.djazair.dev`, by `wrangler deploy --env test`; a release takes it down with the web app's.
- **On this computer,** `npm run serve` in `apps/dashboard` serves it at `http://127.0.0.1:4181`, and its Worker runs with `../../web/host/node_modules/.bin/wrangler dev --ip 127.0.0.1 --port 8788 --local-upstream 127.0.0.1:8788` in `apps/dashboard/host`, once a build is unzipped into `apps/dashboard/release/dist/`; the demo server names both back.

## When the host is down

The installed app opens and works as usual. Only first installs and update checks wait for the host.

## Trying it on this computer

`npm run serve` sends the same headers, over plain HTTP and without `Strict-Transport-Security`. While it runs, check it with `npm run check-host -- http://127.0.0.1:4180`. To try the Worker itself, unzip a build into `release/dist/` and run `node_modules/.bin/wrangler dev --ip 127.0.0.1 --port 8787 --local-upstream 127.0.0.1:8787` in `host/` once its `npm ci` is done; the pull requests that change it do the same in CI. A demo world answers only from those two local addresses, `http://127.0.0.1:4180` and `http://127.0.0.1:8787`: the demo server names no other origin back but the hosted ones and the dashboard's (answers 583, 756 and 855), so with another `PORT`, but the dashboard's 4181, its requests fail as if offline. `npm run zip` packs `dist/` into `release/minhajna-web-<version>.zip`. Before packing, it checks every file against `build.json`. The ZIP keeps the files uncompressed, in name order, all dated 1 January 1980, so the same build always gives the same bytes, on any system. CI keeps one per run as the `web-zip` artifact, for the release manager to compare with their own.
