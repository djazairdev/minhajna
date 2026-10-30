# Minhajna's server

The server package ([PRD §5.2](../../docs/prd/PRD.md#52-architecture)): one package, installed by whoever runs it. In 0.7.0 it is **the demo server** ([#516](https://github.com/djazairdev/minhajna/issues/516)): it holds made-up demo worlds in which every role, from the Ministry to the teacher, runs the national flow. It never holds real data, and it never holds a key to a school's or a teacher's records.

**Status:** the health check ([#538](https://github.com/djazairdev/minhajna/issues/538)), the worlds API ([#540](https://github.com/djazairdev/minhajna/issues/540)) and the encrypted relay ([#541](https://github.com/djazairdev/minhajna/issues/541)), with everything kept in memory. PostgreSQL storage comes next ([#542](https://github.com/djazairdev/minhajna/issues/542)).

## The worlds API

A world is named by the first five characters of its code; the rest of the code never reaches the server. The device derives the world's pass from the code's secret and sends it in `X-World-Pass`; the server keeps only its hash, and answers a wrong pass exactly as an unknown id.

| Request | Does | Answers |
| --- | --- | --- |
| `POST /worlds` with `{world, sealed, date, announcedDays, pass}` | Starts a world: its id, the sealed world in base64url (at most 48 KB), its date, the announced days and its pass | `201 {starter}`, the starter token, given once; `409` if the id is taken |
| `GET /worlds/:world`, with the pass | Joins a world | `{sealed, date}` |
| `GET /worlds/:world/date`, with the pass | Reads the world's date | `{date}` |
| `POST /worlds/:world/date`, with the pass and `Authorization: Bearer <starter>` | Moves the date to the next announced day | `{date}`; `403` without the starter token; `409` when no day is left |

- **Probing:** a wrong pass answers exactly as an unknown id, and takes as long. Only a start can tell that an id is taken (`409`), and starts are the most limited requests.
- **The starter token** is kept only as its SHA-256 hash, so the store alone cannot move a date. No answer may be cached (`Cache-Control: no-store`).
- **Rate limits:** each address may start 5 worlds an hour, make 60 other world requests and 1,200 relay requests in 10 minutes, with totals for everyone. An IPv6 address counts by its /64. Addresses stay in memory until the first request after their window, and are never logged or stored. `TRUST_PROXY=cloudflare` reads the address from Cloudflare's header.

## The encrypted relay

Inside a world, with its pass, clients exchange sealed records through spaces: one per school and per directorate, whose ids the clients draw, and the one national space, named `national` (PRD §5.8).

| Request | Does | Answers |
| --- | --- | --- |
| `PUT /worlds/:world/spaces/:space` with `{kind}` | Opens a space of kind `school`, `directorate` or `national` | `{kind}`; `409` if it exists with another kind |
| `POST /worlds/:world/spaces/:space/batches` with `{stream, first, batches}` | Adds a stream's next 1 to 128 sealed batches, all or none; a stream is numbered from 0 with no gap | `201 {added}`; `409` naming the stream's next number when `first` is not it |
| `GET /worlds/:world/spaces/:space/batches?after=n` | Reads up to 128 batches after arrival number `n` | `{batches: [{seq, stream, number, bytes}], more}` |

- **One size:** every batch is exactly 4,124 bytes: the core's 4,096-byte batch sealed with AES-256-GCM. Anything else is refused, so a batch's size says nothing.
- **The minimum:** the server keeps each space's id and kind, and each batch's stream, number, arrival order and sealed bytes. No names, no times, no addresses.
- **Caps:** a world holds at most 2,000 spaces and 10,000 batches (about 41 MB); the memory store holds at most 50,000 batches in all (about 206 MB) and answers `507` beyond.

## Storage

Worlds, spaces and batches go to PostgreSQL ([#542](https://github.com/djazairdev/minhajna/issues/542), answer 550). Their tables are described in [`prisma/schema.prisma`](prisma/schema.prisma), and the server will query them through the Prisma Client generated from it (Prisma 7, answer 551), which needs no download and no engine; until the PostgreSQL stores replace the memory ones, the tables wait empty.

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

## Before deploying

- **Worlds are kept in memory** until [#542](https://github.com/djazairdev/minhajna/issues/542) stores them in PostgreSQL and erases each on its 7th day; do not deploy the server before then. A deployment carries `dist/`, `prisma/migrations/` and the server's `package.json`, lockfile and `.npmrc`, and installs with `npm ci --omit=dev`, which never brings Prisma's command line. Its store needs a quota per address or over time as well as its total cap, or one address can fill it.
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
- `npm test` builds the package and runs its tests. Its database tests run when `TEST_DATABASE_URL` names a database whose name ends in `_test`, which they empty: the local demo's PostgreSQL has one, `postgresql://minhajna@127.0.0.1:54320/minhajna_test`.
- `npm run typecheck` checks the types without building.

## The whole demo on this computer

From the repository's root, with Node.js 22.18 or later and Docker with Compose v2:

```bash
npm run demo
```

- **What it does:** it starts PostgreSQL ([`compose.yaml`](compose.yaml), on port 54320, this computer only), installs any part's locked dependencies that are missing or older than its lockfile, builds the server and the PC web app, and runs them: the server on <http://127.0.0.1:3000/health>, the web app on <http://127.0.0.1:4180/>.
- **Stopping:** Ctrl-C stops all three. The database keeps its made-up worlds for the next run; `npm run demo -- --fresh` clears them first.
- **Local only:** the database trusts every connection from this computer and has no password, so the compose file is never used for a deployment.

## How it is built

- **NestJS 12 on Node's own `node:http`** (§5.2), through its `NodeAdapter`, in TypeScript compiled by `tsc` to `dist/`. Once the server reads JSON bodies, the adapter's parser refuses those that try to change object prototypes. NestJS needs TypeScript's decorators and their type metadata, so this package's `tsconfig.json` turns them on over the repository's shared settings.
- **Its own lockfile,** like the apps. Its `.npmrc` repeats the repository's rules: no dependency runs scripts while installing, and the Node.js version is checked.
- **One override:** `@nestjs/platform-node` 12.3.2 pins `qs` at 6.16.0, which GHSA-6pq8-jhm2-2vcw covers, so `package.json` raises it to the patched 6.16.1. Remove the override once a release of the adapter carries the fix.
- **Logs with no clock times:** every line holds a level, the part of the server that wrote it and its message. Requests are never logged, so the logs never show who was active, or when (§6.5, §6.7).
- **Nothing more than asked:** bodies are read as JSON only, and must say their length; a body larger than its route takes (1 MB for a relay upload, 64 KB otherwise) is refused before it is read. No header says what the server is built with.
