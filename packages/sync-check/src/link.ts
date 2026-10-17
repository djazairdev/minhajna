// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A weak mobile connection, simulated on its own clock (PRD §5.13): each
// request costs a round trip, its bytes at the link's speed, and a fixed
// overhead for headers and encryption records. The connection drops at
// random moments, on average every so many seconds, and takes a while to
// come back. A request cut by a drop has spent the bytes sent so far, and
// only the bytes that arrived before the cut count at the other end.
// The same seed gives the same drops, so runs can be compared.

export interface LinkProfile {
  readonly name: string;
  readonly upBitsPerSecond: number;
  readonly downBitsPerSecond: number;
  readonly roundTripMs: number;
  /** Infinity for a link that never drops. */
  readonly meanSecondsBetweenDrops: number;
  /** Noticing a drop and connecting again. */
  readonly reconnectMs: number;
}

/** Headers and encryption records for one request and its answer, an assumption of the check. */
export const REQUEST_OVERHEAD_BYTES = 800;

/** What a request achieved before it ended or was cut. */
export interface Exchange {
  readonly done: boolean;
  /** The upload's bytes that reached the server. */
  readonly upArrived: number;
  /** The answer's bytes that reached the device. */
  readonly downArrived: number;
}

/** Mulberry32: a small seeded generator, for repeatable drops only, never for keys. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class SimulatedLink {
  readonly profile: LinkProfile;
  /** Time on the link's own clock, from its start. */
  ms = 0;
  /** Bytes that went over the air, both ways, overhead and lost requests included. */
  bytes = 0;
  drops = 0;
  requests = 0;
  private readonly random: () => number;
  private nextDrop: number;

  constructor(profile: LinkProfile, seed: number) {
    this.profile = profile;
    this.random = seeded(seed);
    this.nextDrop = this.dropAfter(0);
  }

  private dropAfter(from: number): number {
    const mean = this.profile.meanSecondsBetweenDrops;
    return Number.isFinite(mean) ? from - Math.log(1 - this.random()) * mean * 1000 : Infinity;
  }

  /**
   * Sends `up` bytes and receives `down` bytes in one request: the upload,
   * a round trip, then the answer. Says how much of each arrived whole.
   */
  request(up: number, down: number): Exchange {
    this.requests++;
    const half = REQUEST_OVERHEAD_BYTES / 2;
    const upRate = this.profile.upBitsPerSecond / 8000;
    const downRate = this.profile.downBitsPerSecond / 8000;
    const upMs = (up + half) / upRate;
    const total = upMs + this.profile.roundTripMs + (down + half) / downRate;
    if (this.ms + total <= this.nextDrop) {
      this.ms += total;
      this.bytes += up + down + REQUEST_OVERHEAD_BYTES;
      return { done: true, upArrived: up, downArrived: down };
    }
    const elapsed = this.nextDrop - this.ms;
    const answering = elapsed - upMs - this.profile.roundTripMs;
    const clamp = (value: number, most: number) => Math.min(most, Math.max(0, Math.floor(value)));
    this.bytes += clamp(elapsed * upRate, up + half) + clamp(answering * downRate, down + half);
    this.drops++;
    this.ms = this.nextDrop + this.profile.reconnectMs;
    this.nextDrop = this.dropAfter(this.ms);
    return {
      done: false,
      upArrived: clamp((elapsed - this.profile.roundTripMs / 2) * upRate - half, up),
      downArrived: clamp(answering * downRate - half, down),
    };
  }
}

/** The connections the check runs on, from the weakest 2G to a 4G that still drops. */
export const PROFILES: readonly LinkProfile[] = [
  {
    name: 'GPRS (2G), drops every 15 s',
    upBitsPerSecond: 20_000,
    downBitsPerSecond: 40_000,
    roundTripMs: 1000,
    meanSecondsBetweenDrops: 15,
    reconnectMs: 8000,
  },
  {
    name: 'EDGE (2G), drops every 20 s',
    upBitsPerSecond: 50_000,
    downBitsPerSecond: 120_000,
    roundTripMs: 700,
    meanSecondsBetweenDrops: 20,
    reconnectMs: 5000,
  },
  {
    name: 'Weak 3G, drops every 60 s',
    upBitsPerSecond: 200_000,
    downBitsPerSecond: 500_000,
    roundTripMs: 300,
    meanSecondsBetweenDrops: 60,
    reconnectMs: 3000,
  },
  {
    name: '4G, drops every 120 s',
    upBitsPerSecond: 2_000_000,
    downBitsPerSecond: 8_000_000,
    roundTripMs: 80,
    meanSecondsBetweenDrops: 120,
    reconnectMs: 2000,
  },
];
