# Minhajna's server

The server package ([PRD §5.2](../../docs/prd/PRD.md#52-architecture)): one package, installed by whoever runs it. In 0.7.0 it is **the demo server** ([#516](https://github.com/djazairdev/minhajna/issues/516)): it holds made-up demo worlds in which every role, from the Ministry to the teacher, runs the national flow. It never holds real data, and it never holds a key to a school's or a teacher's records.

**Status:** the health check ([#538](https://github.com/djazairdev/minhajna/issues/538)), the worlds API ([#540](https://github.com/djazairdev/minhajna/issues/540)), the encrypted relay ([#541](https://github.com/djazairdev/minhajna/issues/541)) and the stand-in CA ([#554](https://github.com/djazairdev/minhajna/issues/554)), kept in PostgreSQL and erased on their 7th day ([#542](https://github.com/djazairdev/minhajna/issues/542)).

## The worlds API

A world is named by the first five characters of its code; the rest of the code never reaches the server. The device derives the world's pass from the code's secret and sends it in `X-World-Pass`; the server keeps only its hash, and answers a wrong pass exactly as an unknown id.

| Request                                                                         | Does                                                                                                              | Answers                                                                                                                                                                        |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `POST /worlds` with `{world, sealed, date, announcedDays, pass}`                | Starts a world: its id, the sealed world in base64url (at most 48 KB), its date, the announced days and its pass  | `201 {starter}`, the starter token, given once; `409` if the id is taken                                                                                                       |
| `GET /worlds/:world`, with the pass                                             | Joins a world                                                                                                     | `{sealed, date, announcedDays}`                                                                                                                                                |
| `GET /worlds/:world/date`, with the pass                                        | Reads the world's date and announced days                                                                         | `{date, announcedDays}`                                                                                                                                                        |
| `POST /worlds/:world/date`, with the pass and `Authorization: Bearer <starter>` | Moves the date to the next announced day                                                                          | `{date}`; `403` without the starter token; `409` when no day is left, or when the date or the announced days changed meanwhile                                                 |
| `PUT /worlds/:world/announced-days` with `{announcedDays}`, with the pass       | Replaces the announced days after the world's date with those a published calendar gives, keeping the days before | `{announcedDays}`; `400` for a day on or before the date, more than 400 days in all or another field; `404` without the world or its pass; `409` when the date moved meanwhile |

- **Probing:** a wrong pass answers exactly as an unknown id, and takes as long. Only a start can tell that an id is taken (`409`), and starts are the most limited requests.
- **The starter token** is kept only as its SHA-256 hash, so the store alone cannot move a date. No answer may be cached (`Cache-Control: no-store`).
- **Rate limits:** each address may start 5 worlds an hour, make 60 other world requests and 1,200 relay requests in 10 minutes, and store 20,000 batches a day (about 82 MB), with totals for everyone (140,000 batches a day, so a week of them fits the server's cap). Only batches stored count: a refused upload costs nothing. An IPv6 address counts by its /64. Addresses stay in memory until the first request after their window, up to a day for uploads, and are never logged or stored. `TRUST_PROXY=cloudflare` reads the address from Cloudflare's header.

## The encrypted relay

Inside a world, with its pass, clients exchange sealed records through spaces: one per school and per directorate, whose ids the clients draw, and the one national space, named `national` (PRD §5.8).

| Request                                                                             | Does                                                                                                                                                                                               | Answers                                                                                                          |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `PUT /worlds/:world/spaces/:space` with `{kind}`                                    | Opens a space of kind `school`, `directorate` or `national`                                                                                                                                        | `{kind}`; `409` if it exists with another kind, or the world holds 2,000 spaces                                  |
| `POST /worlds/:world/spaces/:space/batches` with `{stream, first, batches}`         | Adds a stream's next 1 to 128 sealed batches, all or none; a stream is numbered from 0 with no gap                                                                                                 | `201 {added}`; `409` naming the stream's next number when `first` is not it                                      |
| `GET /worlds/:world/spaces/:space/batches?after=n`                                  | Reads up to 128 batches after arrival number `n`                                                                                                                                                   | `{batches: [{seq, stream, number, bytes}], more}`                                                                |
| `POST /worlds/:world/seed/batches` with `{spaces, streams}`, with the starter token | Seeds a world, a national one for #548: opens up to 128 spaces `{space, kind}`, then adds up to 128 batches in all to streams `{space, stream, first, batches}`, in order, each stream all or none | `201 {opened, added}`; `403` without the starter token; `400`, `409` or `507` naming the space or stream refused |

- **Seeding:** only the device that started a world, with its starter token, seeds it (the server cannot tell a world's kind, so any world may be seeded), in about a dozen requests for 72 schools and 492 teachers (answer 625). A seeding counts once against the relay's limit and by batch against the daily quota; a refusal stops it there and keeps what came before, so a start that fails is started again, and the half-seeded world is erased on its 7th day, since nobody holds its code.
- **One size:** every batch is exactly 4,124 bytes: the core's 4,096-byte batch sealed with AES-256-GCM. Anything else is refused, so a batch's size says nothing.
- **The minimum:** the server keeps each space's id and kind, and each batch's stream, number, arrival order and sealed bytes. No names, no times, no addresses.
- **Caps:** a world holds at most 2,000 spaces and 10,000 batches (about 41 MB). The server holds at most 1,000,000 batches in PostgreSQL (about 4 GB), or 50,000 in memory (about 206 MB), and answers `507` beyond; uploads to different worlds at the same moment may pass that cap by a few.

## The stand-in CA

Each world has its own stand-in certificate authority ([#554](https://github.com/djazairdev/minhajna/issues/554), answer 564), which certifies the keys teachers sign their weeks with. A teacher's signing key is made on the device and never leaves it, except a seeded teacher's, which the device that starts a world makes and uploads sealed under a key only the world's code gives (answer 625).

| Request                                                                           | Does                                                                                                                                      | Answers                                                                           |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `GET /worlds/:world/ca`, with the pass                                            | Reads the CA's public key, which devices check the world's certificates against                                                           | `{publicKey}`, its SPKI in base64                                                 |
| `POST /worlds/:world/certificates` with `{world, subject, publicKey, signature}`  | Certifies the P-256 key a request names, when the request is signed by it and names this world                                            | `201` with the certificate, marked as a stand-in's and issued on the world's date |
| `POST /worlds/:world/seed/certificates` with `{requests}`, with the starter token | Certifies up to 128 requests at once for a seeded world's teachers (#548), each read as above, counted once with the other world requests | `201 {certificates}`, in the requests' order; `403` without the starter token     |

- **What it proves:** a request proves only that the device holds its key. In the demo, anyone with a world's code acts in any role, and the server is the CA and hands out its key, so a demo signature proves nothing against the server. Every certificate says it is a stand-in's, and only the state's CA, outside Minhajna's server, can make a signature evidence (answers 563 and 564).
- **The key:** an ECDSA P-256 key, as the devices' own are (answer 580), made the first time the world needs it and kept with the world, so it is erased with it, and lingers only in the sealed archive's WAL and base backups for about two days, like every row (see "What the bucket keeps and shows"). It certifies nothing outside its world, and never changes within it, so a device fetches it once and keeps it. The certificate's texts are those of [`packages/core/src/certify.ts`](../../packages/core/src/certify.ts), and the tests check the server's certificates with the core's own checks.

## Storage

With `DATABASE_URL`, worlds, spaces and batches are kept in PostgreSQL ([#542](https://github.com/djazairdev/minhajna/issues/542), answer 550), so they outlive a restart; without it, in memory, and lost when the server stops. Their tables are described in [`prisma/schema.prisma`](prisma/schema.prisma), and the server queries them through the Prisma Client generated from it (Prisma 7, answer 551), which needs no download and no engine.

- **A world is erased on its 7th day** (answer 548), counting the day it started, in UTC: the server sweeps when it starts and every hour, so a world is gone within the hour its 7th day begins, its spaces and batches with it.
- **Uploads to one world take turns:** each locks its world's row, so a world's caps and its streams' numbers hold. One that waits more than 5 seconds for a connection or 8 for its turn, or takes more than 10 once started, is answered `503` with `Retry-After`, to be sent again.

- **Migrations are plain SQL,** in `prisma/migrations/<name>/migration.sql`, each generated with `prisma migrate diff --script` and reviewed before it is committed. CI applies them to an empty database and fails if they differ from the schema.
- **The server applies any missing migration when it starts with `DATABASE_URL`,** and `npm run migrate` does the same. Each is applied once, in order of name, in its own transaction, and recorded with its SHA-256 in `minhajna_meta.migration`; a migration whose file changed after it was applied is refused, as is a file that opens or closes its own transaction.
- **With `psql` alone,** on a machine with no Prisma tool and no internet, from this folder: it stops at the first failure, skips what is applied, and takes the same lock as the server.

  ```bash
  set -e
  psql "$DATABASE_URL" -c 'CREATE SCHEMA IF NOT EXISTS minhajna_meta' -c 'CREATE TABLE IF NOT EXISTS minhajna_meta.migration (name text PRIMARY KEY, sha256 char(64))'
  for dir in prisma/migrations/*/; do
    name=$(basename "$dir")
    [ -n "$(psql "$DATABASE_URL" -tAc "SELECT 1 FROM minhajna_meta.migration WHERE name = '$name'")" ] && continue
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -1 -c 'SELECT pg_advisory_xact_lock(7042542)' -f "${dir}migration.sql" -c "INSERT INTO minhajna_meta.migration (name) VALUES ('$name')"
  done
  ```

- **Prisma's command line** lives in `tools/prisma/` with its own lockfile, so it never installs with the server: `npm run tools` installs it, and `npm run build` runs its `generate`, which downloads nothing.
- **A new migration:** change `schema.prisma`; against a database with every committed migration applied, run `DATABASE_URL=… npm run diff -- --script`; commit its output as `prisma/migrations/<next number>_<name>/migration.sql`, with the licence header the others carry.

## The container image

The demo runs from one image ([#633](https://github.com/djazairdev/minhajna/issues/633), answer 550): the server and PostgreSQL 18 together, with [WAL-G](https://github.com/wal-g/wal-g) keeping the database in an S3-compatible bucket, R2 for the demo, so a container that starts on an empty disk finds every world as it was. Build it from the repository's root:

```bash
docker build -f apps/server/Dockerfile -t minhajna-server .
```

- **On an empty disk,** it restores the latest base backup and every archived WAL file from the bucket; when the bucket holds none, it makes a new database and backs it up at once. A restore lands in a separate folder first, so a failed one leaves nothing half-made. If the bucket cannot be read within `BUCKET_WAIT` seconds (120), or the backup restored within `RESTORE_WAIT` (1800), it stops rather than start an empty or partial database. A WAL file the bucket fails to give is asked for 5 times over about 30 seconds; then recovery stops, rather than open a database without it, and the next container tries again.
- **While it runs,** PostgreSQL archives each WAL file as it fills, and at least every `ARCHIVE_TIMEOUT` seconds (60), so a container lost without warning loses at most that much. A base backup is taken whenever the latest is `BACKUP_EVERY` seconds old (a day), on starting too, and the last two are kept.
- **On `SIGTERM`,** the server stops, the last WAL file is archived, and PostgreSQL stops. That takes longer than the usual 10 seconds' grace: give the container at least 120 (`docker run --stop-timeout 120`, or the host's equivalent), or a stop may lose up to a minute of writes.
- **The bucket comes from the environment,** never from the image or the repository: `WALG_S3_PREFIX` (`s3://<bucket>/<path>`), `AWS_ENDPOINT` (R2's `https://<account>.r2.cloudflarestorage.com`), `AWS_REGION` (`auto` for R2), `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`. Without `WALG_S3_PREFIX` it refuses to start, unless `ARCHIVE=off` says to keep nothing, for trying the image.
- **Seal the archive** with `WALG_LIBSODIUM_KEY` (32 random bytes, in hex with `WALG_LIBSODIUM_KEY_TRANSFORM=hex`), so whoever can read the bucket reads nothing: without it, world ids, hashes, erasure days, sealed batches and each world's stand-in CA key are in the clear there. Keep the key with the bucket's credentials; without it the archive cannot be restored.
- **What the bucket keeps and shows:** an erased world leaves the database at once, but stays in the bucket until the WAL and the base backups that hold it are replaced, about two days at most while backups run; deleted rows may also linger in later backups until PostgreSQL reuses their space. The times the bucket stores with each WAL file and backup show when the demo was used, to the minute, to whoever reads the bucket.
- **Inside,** the start script runs as root only to start PostgreSQL as `postgres` and the server as `minhajna`, a database role that is no superuser, without the bucket's settings. PostgreSQL listens on its socket only, the server on port 8080, and nothing else is reached but the bucket; closing every other outbound address is the host's part ([#545](https://github.com/djazairdev/minhajna/issues/545)). Its logs carry no clock times: they are cut from PostgreSQL's and WAL-G's lines.
- **Its test** (`test/image.test.ts`) builds the image and runs it against an S3 stand-in, [SeaweedFS](https://github.com/seaweedfs/seaweedfs) in `compose.yaml`'s `archive` profile, with a sealed archive. It stops a container after a world was written both before and after its latest base backup, and finds both in a new container on an empty disk. It needs Docker, so it runs only with `TEST_IMAGE=1`, as the Server image workflow does.

## Before deploying

- **Set `DATABASE_URL`,** or worlds are lost at every restart; the image sets it for its own PostgreSQL. A deployment outside the image carries `dist/`, `prisma/migrations/` and the server's `package.json`, lockfile and `.npmrc`, and installs with `npm ci --omit=dev`, which never brings Prisma's command line.
- **One container per bucket path:** two containers running on the same `WALG_S3_PREFIX`, as in a blue-green deploy, split the archive, and the next restore keeps only one of them. Stop the old container before the new one starts.
- **Give it a stop grace of 120 seconds** and a disk for the database and some days of WAL, mounted at `/var/lib/postgresql`, never at the database's own folder below it, where a restore could not move into place. If the bucket stays out of reach, WAL piles up until the disk is full, and PostgreSQL stops.
- **Behind Cloudflare,** set `TRUST_PROXY=cloudflare` and make sure the Worker in front passes `CF-Connecting-IP` on ([#545](https://github.com/djazairdev/minhajna/issues/545)); otherwise every request has the Worker's address and the per-address limits become one shared limit.

## Build and try it

From this folder, with Node.js 22.18 or later:

```bash
npm ci
npm run tools
npm run build
npm start
```

Then <http://127.0.0.1:3000/health> answers the package's version. The server listens on this computer only; `HOST` and `PORT` change the address and the port.

- `npm run tools` installs Prisma's command line, which `build`, `test` and `typecheck` need: it generates the database client.
- `npm test` builds the package and runs its test files one at a time. Its database tests run when `TEST_DATABASE_URL` names a database whose name ends in `_test`, which they empty: the local demo's PostgreSQL has one, `postgresql://minhajna@127.0.0.1:54320/minhajna_test`.
- `npm run typecheck` checks the types without building.

## The whole demo on this computer

From the repository's root, with Node.js 22.18 or later and Docker with Compose v2:

```bash
npm run demo
```

- **What it does:** it starts PostgreSQL ([`compose.yaml`](compose.yaml), on port 54320, this computer only), installs any part's locked dependencies that are missing or older than its lockfile, builds the server and the PC web app, and runs them: the server on <http://127.0.0.1:3000/health>, the web app on <http://127.0.0.1:4180/>.
- **Stopping:** Ctrl-C stops all three. The database keeps its made-up worlds for the next run; `npm run demo -- --fresh` clears them first.
- **Local only:** the database trusts every connection from this computer and has no password, so the compose file is never used for a deployment.
- **In the dev container** ([CONTRIBUTING.md](../../CONTRIBUTING.md#or-in-a-dev-container), #634), the container starts this PostgreSQL and the S3 stand-in itself, with no port on the computer, and names its database in `MINHAJNA_DEMO_DATABASE`. `npm run demo` then runs no Docker, leaves PostgreSQL running when it stops, and with `--fresh` empties the demo database instead of its volume.
- **Demo scenarios** ([`tools/demo-scenario/`](../../tools/demo-scenario/scenario.js), #629): with the demo running, `node tools/demo-scenario/run.js` starts a world, acts as its roles, moves its date and checks what each role sees, as their devices would. CI runs them against `npm run demo -- --fresh`; `--server` names another server and `--wait` how many seconds to wait for its health check.

## How it is built

- **NestJS 12 on Node's own `node:http`** (§5.2), through its `NodeAdapter`, in TypeScript compiled by `tsc` to `dist/`. Once the server reads JSON bodies, the adapter's parser refuses those that try to change object prototypes. NestJS needs TypeScript's decorators and their type metadata, so this package's `tsconfig.json` turns them on over the repository's shared settings.
- **Its own lockfile,** like the apps. Its `.npmrc` repeats the repository's rules: no dependency runs scripts while installing, and the Node.js version is checked.
- **One override:** `@nestjs/platform-node` 12.3.2 pins `qs` at 6.16.0, which GHSA-6pq8-jhm2-2vcw covers, so `package.json` raises it to the patched 6.16.1. Remove the override once a release of the adapter carries the fix.
- **Logs with no clock times:** every line holds a level, the part of the server that wrote it and its message. Requests are never logged, so the logs never show who was active, or when (§6.5, §6.7).
- **Nothing more than asked:** bodies are read as JSON only, and must say their length; a body larger than its route takes (1 MB for a relay upload, 64 KB otherwise) is refused before it is read. No header says what the server is built with.
- **Only the web app's pages:** a browser may call the server from the PC web app's own origin, `https://minhajna.djazair.dev`, or where the web app is tried locally: `http://127.0.0.1:4180` for `npm run serve` and `http://127.0.0.1:8787` for its Worker under `wrangler dev`, and only with `GET`, `POST` or `PUT` and the headers the demo client sends (`Accept`, `Authorization`, `Content-Type`, `X-World-Pass`). Answers name that origin back, let it read `Retry-After` and vary by origin; none allows credentials, since a world's pass travels in a header, not a cookie. A preflight from any other origin, or for another method or header, is refused with `403` (answer 583).
