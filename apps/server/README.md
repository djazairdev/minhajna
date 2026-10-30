# Minhajna's server

The server package ([PRD §5.2](../../docs/prd/PRD.md#52-architecture)): one package, installed by whoever runs it. In 0.7.0 it is **the demo server** ([#516](https://github.com/djazairdev/minhajna/issues/516)): it holds made-up demo worlds in which every role, from the Ministry to the teacher, runs the national flow. It never holds real data, and it never holds a key to a school's or a teacher's records.

**Status:** the start of the package ([#538](https://github.com/djazairdev/minhajna/issues/538)). It answers a health check and nothing else yet. The demo's worlds, spaces and storage come in the issues of [#516](https://github.com/djazairdev/minhajna/issues/516).

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
- **Nothing more than asked:** no request bodies are read yet, and no header says what the server is built with.
