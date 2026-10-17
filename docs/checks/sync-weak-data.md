# Sync on weak mobile data

Many teachers have weak or metered mobile data. A sync that restarts from zero, or sends large payloads, would fail or cost them money ([PRD §5.8](../prd/PRD.md#58-sync-school-spaces-backup-and-moving-between-devices)). This page records how sync was checked on weak links before the pilot depends on it ([PRD §5.13](../prd/PRD.md#513-checks-before-the-pilot)), for ticket FC-31 of the field-check plan ([#47](https://github.com/djazairdev/minhajna/issues/47)). It is input to the gates that sync must meet before it opens ([PRD §6.2](../prd/PRD.md#62-compliance-before-each-launch)). Every record in these checks is made up, and no server was used.

- [The result](#the-result)
- [How the check works](#how-the-check-works)
- [Payload sizes](#payload-sizes)
- [A full year over weak links](#a-full-year-over-weak-links)
- [Daily syncs](#daily-syncs)
- [What fixed batches cost](#what-fixed-batches-cost)
- [A conflict](#a-conflict)
- [For sync's gates](#for-syncs-gates)
- [Repeating the checks](#repeating-the-checks)
- [Still open](#still-open)

## The result

| Check | Result |
|---|---|
| Resuming after a drop | **Passed.** Over the weakest link, GPRS dropping every 15 seconds on average, a full primary year went up in a median of 73 s, and 2 minutes at worst. Restarting from zero took a median of 3.2 minutes, and 25 minutes at worst, with 3.5 times the data |
| Arriving whole | **Passed.** A full year sent and received over GPRS with drops, in 10 runs, verified and was identical to what was sent |
| Payload sizes | **Small.** A school day's changes are 0.7 KB compressed, the busiest ordinary day 1.4 KB, and a full year 57 KB for middle school and 79 KB for primary |
| Fixed batches | **Affordable.** One 4 KB batch at each of 4 set times a day costs 0.56 MB a month, whether or not the teacher did anything. That batch holds every ordinary day's changes |
| Conflicts | **Found.** Two devices that took the same roll call differently give one conflict for the teacher to choose. The same change made on both, and changes to different records, give none |
| A batch changed, moved, swapped or sealed under another key | **Refused** |

These figures come from a simulation, not from a phone on a real network ([below](#still-open)).

## How the check works

The check is the `packages/sync-check` package. It follows the PRD's design for sync (§5.8), without building the app's sync:

- **Only new changes travel.** A sync sends the history entries made since the last one. They are written as JSON and compressed with raw deflate.
- **Fixed batches.** The compressed changes are cut into pieces of one size, 4 KB here. Each piece is padded to that size and sealed with AES-256-GCM under the teacher's key, with a fresh random nonce. A sealed batch is 4,124 bytes, whatever it holds. Each batch's stream and number are bound into its seal, so a batch that is moved, swapped or replayed elsewhere fails to open. Node.js's Web Crypto does the cryptography; the project writes none of its own (§6.5).
- **A stand-in server** keeps each stream's batches in order and reads none of them. It keeps a batch sent twice once.
- **A simulated link** runs on its own clock. Each request costs a round trip, its bytes at the link's speed, and 800 bytes for headers and encryption records. The link drops at random moments, at the average rate below, and takes a while to come back. The drops come from a seed, so every run can be repeated. Each figure below is over 25 seeds: the median and the slowest.

| Link | Up | Down | Round trip | Drops, on average | Back after |
|---|---:|---:|---:|---:|---:|
| GPRS (2G) | 20 kbit/s | 40 kbit/s | 1,000 ms | every 15 s | 8 s |
| EDGE (2G) | 50 kbit/s | 120 kbit/s | 700 ms | every 20 s | 5 s |
| Weak 3G | 200 kbit/s | 500 kbit/s | 300 ms | every 60 s | 3 s |
| 4G | 2 Mbit/s | 8 Mbit/s | 80 ms | every 120 s | 2 s |

Both ways of syncing send everything still to go in one request:

- **Resuming** keeps every batch that arrived whole before a drop. After the drop, the device asks the server how far it got, or counts what it received, and carries on from there. A drop costs at most one batch and the bytes that were in flight.
- **Restarting** throws a cut request away and sends it all again, as a sync without resuming would.

The loads come from the core's demo year ([#77](https://github.com/djazairdev/minhajna/issues/77)): 45 made-up pupils, every session confirmed and every roll call taken from 21 September 2026 to 8 July 2027, with homework, details and corrections. The school day is 14 October 2026, and the week runs from 11 to 15 October.

## Payload sizes

| Load | Entries | As JSON | Compressed | Batches | Sealed |
|---|---:|---:|---:|---:|---:|
| Middle-school year | 397 | 255.0 KB | 57.1 KB | 15 | 60.4 KB |
| Primary year | 554 | 359.8 KB | 79.3 KB | 20 | 80.5 KB |
| A school day | 2 | 1.3 KB | 0.7 KB | 1 | 4.0 KB |
| A school week | 10 | 6.4 KB | 1.8 KB | 1 | 4.0 KB |

Over the 161 school days of the middle-school year, a day's changes are 0.7 KB compressed as a median. The busiest ordinary days, with corrections, are 1.4 KB. The first day is 8.4 KB, because it holds the class list and the timetable.

## A full year over weak links

A full year travels twice in a teacher's life with sync: up, as the first sync, and down, when a new phone is restored. The times are on the link's clock.

| Link | Year | Way | Resuming: median | Slowest | Data | Restarting: median | Slowest | Data |
|---|---|---|---:|---:|---:|---:|---:|---:|
| GPRS | Middle school | up | 55.9 s | 102.8 s | 71.1 KB | 107.5 s | 499.3 s | 164.7 KB |
| GPRS | Middle school | down | 23.3 s | 41.9 s | 62.7 KB | 27.7 s | 127.6 s | 68.4 KB |
| GPRS | Primary | up | 72.7 s | 121.4 s | 94.5 KB | 191.7 s | 1,523.5 s | 328.5 KB |
| GPRS | Primary | down | 34.9 s | 81.2 s | 85.1 KB | 61.0 s | 144.7 s | 161.8 KB |
| EDGE | Middle school | up | 10.7 s | 23.9 s | 61.2 KB | 10.7 s | 51.8 s | 61.2 KB |
| EDGE | Middle school | down | 4.9 s | 16.6 s | 61.2 KB | 4.9 s | 18.3 s | 61.2 KB |
| EDGE | Primary | up | 14.0 s | 27.2 s | 81.3 KB | 14.0 s | 91.4 s | 81.3 KB |
| EDGE | Primary | down | 6.3 s | 18.0 s | 81.3 KB | 6.3 s | 19.7 s | 81.3 KB |
| Weak 3G | Primary | up | 3.6 s | 7.2 s | 81.3 KB | 3.6 s | 10.2 s | 81.3 KB |
| 4G | Primary | up | 0.4 s | 0.4 s | 81.3 KB | 0.4 s | 0.4 s | 81.3 KB |

Every run finished within the hour the check allows. The data column is the median of what went over the air, both ways, including overhead and requests cut short.

When a full year fits between two drops, as on 3G and 4G and mostly on EDGE, both ways cost the same. When drops come faster than the year can travel, as on GPRS, restarting pays for the same bytes again and again. Resuming finishes in about the time the bytes take, plus the reconnections. Its slowest run stays within 2 minutes, while restarting's slowest takes 25.

After uploading over GPRS and downloading again, in 10 runs with different drops, every history verified and was identical to the one sent. That includes its chain of hashes, checked with the core's `verifyHistory`.

## Daily syncs

A school day's or a week's changes fit one 4 KB batch, so resuming and restarting are the same. One sync costs 4.8 KB over the air, overhead included.

| Link | Median time | Slowest |
|---|---:|---:|
| GPRS | 2.9 s | 22.7 s |
| EDGE | 1.5 s | 13.8 s |
| Weak 3G | 0.5 s | 0.5 s |
| 4G | 0.1 s | 0.1 s |

The slowest runs are those where the link dropped during the sync, and are mostly the time to reconnect.

## What fixed batches cost

With fixed batches, the app sends one batch at each set time of day, whether or not anything changed (§5.8). The cost is the same every month, whatever the teacher does. Over 30 days, overhead included:

| Batch | Set times a day | A month | School days whose changes fit | Busiest day |
|---:|---:|---:|---:|---:|
| 2 KB | 2 | 0.16 MB | 99% | 5 batches |
| 2 KB | 4 | 0.33 MB | 99% | 5 batches |
| 4 KB | 2 | 0.28 MB | 99% | 3 batches |
| **4 KB** | **4** | **0.56 MB** | **100%** | **3 batches** |
| 4 KB | 6 | 0.85 MB | 100% | 3 batches |
| 8 KB | 4 | 1.03 MB | 100% | 2 batches |
| 16 KB | 4 | 1.97 MB | 100% | 1 batch |
| 16 KB | 6 | 2.95 MB | 100% | 1 batch |

A day "fits" when its changes fit in that day's batches. The busiest day is the first, with the class list. Changes that do not fit wait for the next set time.

## A conflict

The phone and the computer both held the year up to 14 October. Then, each on its own:

- both corrected the same roll call, differently: the phone marked a pupil absent, the computer marked another late;
- both corrected a second roll call in the same way;
- the computer alone corrected a third.

The phone's 2 entries went up over GPRS and came down to the computer, which had 3 of its own. The computer found **one conflict**, on the first roll call. The same correction made on both, and the change made on one side only, gave none. Both versions stay in the history (§5.8).

The notice counts what waits for a choice, by kind: here, one roll call. The [Conflict](../design/screens/Conflict.png) screen then shows both versions with their device and day, and until the teacher chooses, this device's version shows. A record is named by what it changes: a session, a roll call, a pupil, a seating plan. Entries that only add, such as a pupil joining or leaving, never conflict.

## For sync's gates

These are suggestions for when sync is designed (§6.2), not decisions:

- **Resume by batch.** On GPRS, restarting from zero took up to 12 times as long and 3.5 times the data. Resuming kept the worst case within a few minutes.
- **4 KB batches at 4 set times a day.** That is about 0.56 MB a month on any link, and every ordinary day fits in one batch. The first sync and a restore travel apart from the set times: they are a full year, 60 to 80 KB.
- **Compress before sealing.** Compression shrinks a year to a quarter or less. Since every batch is padded to one size, its size reveals nothing.
- **Conflicts per record.** Comparing the latest version of each record on both sides finds the real conflicts and leaves out identical changes.

## Repeating the checks

You need Node.js 22.18 or later. From the repository's root:

```sh
npm test -w packages/sync-check
npm run check -w packages/sync-check
```

The first runs the check's tests. The second prints this page's tables; the times and data come out the same on every computer, since the drops come from seeds. The sealed batches use fresh keys and nonces each time, but their sizes do not change.

## Still open

- **A real phone on a real weak network.** The link here is a model, with an assumed overhead per request. Run the same batches from a phone on GPRS or EDGE, or on an emulator with its network slowed, to a test server.
- **Battery,** and the data that fixed batches cost on a budget phone over a month ([PRD §6.10](../prd/PRD.md#610-decisions-and-open-points), traffic analysis).
- **The app's sync itself:** its keys, accounts and server, and the Conflict screen. These come once sync's gates are met, and an independent reviewer checks the encryption design first (§6.5).
