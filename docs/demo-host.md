# The demo server's host

The 0.7.0 demo's server runs at **<https://minhajna-demo.djazair.dev>** (answer 554), on Cloudflare Containers (answer 544), with its database archived to one R2 bucket (answer 550). It holds made-up worlds only and never a teacher's records. The release workflow deploys it the way it deploys [the PC web app](contributing/web-host.md). A national deployment needs none of this: the [server's README](../apps/server/README.md#before-deploying) says what it takes to run the image anywhere.

## How it runs

- **One Worker, `minhajna-demo`,** at the custom domain above ([`apps/server/host/wrangler.jsonc`](../apps/server/host/wrangler.jsonc)). It has no `workers.dev` or preview address, and its logs stay off. A request for the health check or a world goes through it to one Durable Object, which holds the one container ([`worker.ts`](../apps/server/host/worker.ts)). `CF-Connecting-IP` is passed on, for the server's rate limits.
- **One container,** of the image in [`apps/server/Dockerfile`](../apps/server/Dockerfile), on the `standard-1` instance type (4 GiB of memory, half a processor, 8 GB of disk: the image, the database at its cap of about 4 GB, and some WAL). `max_instances` is 1, since two containers on one bucket path would split the archive.
- **It sleeps when idle.** About 30 minutes after the last request, Cloudflare sends `SIGTERM`; the last WAL file is archived and the disk is lost. The next request starts a new container, which restores from the bucket. That took about 20 seconds with an S3 stand-in on this project's machine, and depends on the bucket and on how much the worlds hold. A request that waits more than 18 seconds is answered `503` with `Retry-After`, under the world client's 20-second limit, and the app says the server is busy, to try again in a moment. So the first person after a quiet spell may be asked to try again. A path the server never serves answers 404 without waking it, and so does a preflight from a page elsewhere (403), so a scanner's guesses cost nothing.
- **The 7-day sweep.** The Worker's cron wakes the container once a day, at 03:17 UTC. The server sweeps worlds past their 7th day before it answers anything, the container takes the day's base backup and tests its restore, and it goes back to sleep. A sleeping server can't sweep, so a world may outlast the start of its 7th day by up to a day; a request wakes the same sweep first. If a sweep fails, the server logs it and tries again the next hour it is awake.
- **Nothing starts without the sealed archive.** With a bucket setting or the sealing key missing, the Worker answers `503` and starts no container.
- **Outbound addresses stay open.** Cloudflare can close them only by having the image trust a certificate of its own, which WAL-G would need as well, so `enableInternet` stays on (answer 753). Nothing in the image calls out but WAL-G, to the bucket.

## What to create

All of it goes in the Cloudflare account that `CLOUDFLARE_ACCOUNT_ID` names, the one that serves the web app.

- **The Workers Paid plan** on that account, if it isn't on it already: Containers need it.
- **The R2 bucket `minhajna-demo`.** The name is fixed in `worker.ts`. Automatic location is fine.
- **An R2 API token** with Object Read & Write on that bucket alone. R2 shows an access key ID and a secret access key once.
- **The sealing key,** 32 random bytes in hex: `openssl rand -hex 32`. Without it, whoever reads the bucket reads the database. If it is lost, the archive cannot be restored, and the demo starts again empty.

The first deploy creates the Worker, the container service, the address's DNS record and its certificate, so don't create them by hand.

## The token's rights

`CLOUDFLARE_API_TOKEN`, the organisation's secret (answer 538), needs these rights. The ones marked new are what it lacks if it holds only what [the web app's host](contributing/web-host.md#how-cloudflare-serves-it) asked for:

| Scope | Right | Why |
|---|---|---|
| Account | Workers Scripts: Edit | The Worker and its secrets |
| Account | **Containers: Edit** (new) | The container service, the image's push and its rollout |
| Account | **Cloudchamber: Edit** (new) | The same, where Wrangler still calls Containers by its older name |
| Zone `djazair.dev` | Workers Routes: Edit | The custom domain |
| Zone `djazair.dev` | DNS: Edit | The custom domain's record |

Cloudflare's documentation lists no rights for deploying a container, so the two marked new come from its list of permissions and from Wrangler's own. If a deploy says it isn't allowed, it names the call it was refused; add that right and re-run the job. The token never needs R2 rights: the bucket's own token is separate.

## Deploying a release

Once the release is published, [the release workflow](contributing/releases.md#the-release-workflow)'s "Deploy the demo server" job runs, when it is the newest release and with no further approval, as the web app's does (answer 534):

1. **It checks out the release's commit and checks that the tag names it,** so the image comes from the tag. The release itself stops early if `apps/server/package.json` doesn't say the release's version (answer 754).
2. **It checks that the Worker has its four secrets,** which the hosted test set, and stops at once if not.
3. **It deploys** with Wrangler: the Worker goes live, the image is built on the runner and pushed to Cloudflare's registry, and a rollout replaces the container. The Worker's secrets stay as they were set.
4. **It checks the host** ([`check.ts`](../apps/server/host/check.ts)), for up to 20 minutes while a rollout ends and the container wakes: `/health` answers the release's version and nothing else; no answer carries a header outside the check's list, so none says what the server runs, sets a cookie or has the browser report to anyone; plain HTTP goes to HTTPS; the web app's address may call the server, without credentials; and a page elsewhere is refused.

To run the check yourself, from a checkout, with Node.js 26.13 or later:

```bash
node apps/server/host/check.ts https://minhajna-demo.djazair.dev <version> 120
```

## On a pull request

A pull request that changes the server or its deploy tool runs the [Server image workflow](../.github/workflows/image.yml) with no token and no secret. Wrangler builds the image and the Worker and stops before anything is uploaded (`wrangler deploy --dry-run`), and the Worker then serves the image in Cloudflare's runtime on the runner, against an S3 stand-in, where the host check must pass.

## Rolling back

Go back only for a deploy that has just failed its check. A broken release is otherwise fixed with a new one.

1. **Deploy the previous release again.** GitHub re-runs a job only for about a month, so by hand is the sure way: from a checkout of the previous release's tag, with Node.js 26.13 or later, Docker running, and the organisation's token in `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`, run `npm ci` in `apps/web/host`, then this in `apps/server/host`:

   ```bash
   ../../web/host/node_modules/.bin/wrangler deploy
   ```

   Then check it with the previous version, as above. Within the month, re-running that release's "Deploy the demo server" job does the same. Before there is a previous release, re-run the hosted test from the commit to go back to.
2. **If the older server can't read the database,** because the newer one's migrations changed it, start again empty: in R2, delete everything under `archive/` in the bucket, then deploy again. Every world is made up, and whoever holds a world's code starts a new one.

To take the demo down altogether, delete the `minhajna-demo` Worker in Cloudflare's dashboard, then the bucket's contents. No teacher's own work depends on it: the app and the PC web app work without it, and only a demo world needs it.

## If it doesn't come up

The Worker keeps no logs and the check sees only `503`. In order, look at:

1. **The deploy job's output,** for a refused right or a failed image build.
2. **Whether the Worker has its secrets:** four in the Worker's settings, `AWS_ENDPOINT`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` and `WALG_LIBSODIUM_KEY`.
3. **The container's own lines:** turn on the Worker's logs in the dashboard for one try, and off again after. A container that says `cannot read the bucket` has the wrong bucket token. Its lines carry no clock times, but Cloudflare stamps them, which is why they stay off.

## What only the real service can show

The image, the Worker, the host check and the archive are all exercised on a runner and on this project's machine, against an S3 stand-in. These wait for the first real deploy:

- that WAL-G talks to R2 itself, with the settings in `worker.ts`;
- how long a real restore takes;
- that a sleeping container is stopped when the documentation says, and its last WAL archived;
- that a request over real HTTPS reaches the container, which only Cloudflare's own edge can show in full, though the pull request's run sends the Worker an HTTPS address;
- that the token's rights above are enough;
- that Cloudflare adds no header outside the check's list. If it does and the header is harmless, the check's list is where to add it.
