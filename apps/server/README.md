# Minhajna's server

The server package ([PRD §5.2](../../docs/prd/PRD.md#52-architecture)): one package, installed by whoever runs it. In 0.7.0 it is **the demo server** ([#516](https://github.com/djazairdev/minhajna/issues/516)): it holds made-up demo worlds in which every role, from the Ministry to the teacher, runs the national flow. It never holds real data, and it never holds a key to a school's or a teacher's records.

**Status:** the health check ([#538](https://github.com/djazairdev/minhajna/issues/538)) and the worlds API ([#540](https://github.com/djazairdev/minhajna/issues/540)), with worlds kept in memory. Spaces and PostgreSQL storage come in the next issues of [#516](https://github.com/djazairdev/minhajna/issues/516).

## The worlds API

A world is named by the first five characters of its code; the rest of the code never reaches the server.

| Request | Does | Answers |
| --- | --- | --- |
| `POST /worlds` with `{world, sealed, date, announcedDays}` | Starts a world: its id, the sealed world in base64url (at most 48 KB), its date and the announced days | `201 {starter}`, the starter token, given once; `409` if the id is taken |
| `GET /worlds/:world` | Joins a world | `{sealed, date}` |
| `GET /worlds/:world/date` | Reads the world's date | `{date}` |
| `POST /worlds/:world/date` with `Authorization: Bearer <starter>` | Moves the date to the next announced day | `{date}`; `403` without the starter token; `409` when no day is left |

- **The starter token** is kept only as its SHA-256 hash, so the store alone cannot move a date. No answer may be cached (`Cache-Control: no-store`).
- **Worlds are kept in memory** until [#542](https://github.com/djazairdev/minhajna/issues/542) stores them in PostgreSQL and erases each on its 7th day; do not deploy the server before then.
- **Rate limits:** each address may start 5 worlds an hour and make 60 other world requests in 10 minutes, with totals for everyone. An IPv6 address counts by its /64. Addresses stay in memory until the first request after their window, and are never logged or stored. `TRUST_PROXY=cloudflare` reads the address from Cloudflare's header.

## Build and try it

From this folder, with Node.js 22.18 or later:

```bash
npm ci
npm run build
npm start
```

Then <http://127.0.0.1:3000/health> answers the package's version. The server listens on this computer only; `HOST` and `PORT` change the address and the port.

- `npm test` builds the package and runs its tests.
- `npm run typecheck` checks the types without building.

## How it is built

- **NestJS 12 on Node's own `node:http`** (§5.2), through its `NodeAdapter`, in TypeScript compiled by `tsc` to `dist/`. Once the server reads JSON bodies, the adapter's parser refuses those that try to change object prototypes. NestJS needs TypeScript's decorators and their type metadata, so this package's `tsconfig.json` turns them on over the repository's shared settings.
- **Its own lockfile,** like the apps. Its `.npmrc` repeats the repository's rules: no dependency runs scripts while installing, and the Node.js version is checked.
- **One override:** `@nestjs/platform-node` 12.3.2 pins `qs` at 6.16.0, which GHSA-6pq8-jhm2-2vcw covers, so `package.json` raises it to the patched 6.16.1. Remove the override once a release of the adapter carries the fix.
- **Logs with no clock times:** every line holds a level, the part of the server that wrote it and its message. Requests are never logged, so the logs never show who was active, or when (§6.5, §6.7).
- **Nothing more than asked:** bodies are read as JSON only, up to 64 KB, and no header says what the server is built with.
