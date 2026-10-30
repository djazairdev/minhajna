# The sync check

This package checks sync on weak mobile data before the pilot depends on it ([PRD §5.13](../../docs/prd/PRD.md#513-checks-before-the-pilot)): resuming, payload sizes and conflict notices. It is a measurement, not the app's sync. Sync opens only once its gates are met ([PRD §6.2](../../docs/prd/PRD.md#62-compliance-before-each-launch)). The results are in [docs/checks/sync-weak-data.md](../../docs/checks/sync-weak-data.md).

Everything is made up and stays in memory. No server is reached: a stand-in server keeps the batches, and a simulated link carries them.

## What is here

| Module                 | What it does                                                                                                                            |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `batches.ts`           | Fixed batches: changes compressed, then cut, padded and bound to their stream and number by the core's `batches.ts`, each piece sealed with AES-256-GCM |
| `link.ts`              | A weak link on its own clock: speed, round trips, request overhead, and drops at seeded random moments                                  |
| `transfer.ts`          | Uploading and downloading batches by resuming after a drop or by restarting from zero, and the stand-in server                          |
| `conflicts.ts`         | The record each entry changes, the records two devices changed differently, and what the notice counts                                  |
| `demo.ts`              | The loads: the core's demo year, a school day and a week of it, and two devices that took the same roll call apart                      |
| `measure.ts`, `run.ts` | The measurements, printed as the tables of the check page                                                                               |

## Running it

It needs Node.js 22.18 or later, and no dependency beyond the core.

```bash
npm test -w packages/sync-check
```

```bash
npm run check -w packages/sync-check
```
