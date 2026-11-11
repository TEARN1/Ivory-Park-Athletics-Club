import { destination } from "./geo";
import type { Seen } from "./livemap";
import { pointOnTrack, type TrackPlace } from "./trackmode";

/**
 * Demo track: example runners (not real people) going round a 400 m track, so the map, laps and
 * safety flags can be tried without a server, GPS or a group. One runner stops after 90 s to show
 * the "check on" alert.
 */
export const DEMO_RUNNERS = [
  { bib: "1", name: "Demo runner A", speed: 5.6 },
  { bib: "2", name: "Demo runner B", speed: 5.2 },
  { bib: "3", name: "Demo runner C", speed: 4.8 },
  { bib: "4", name: "Demo runner D", speed: 4.4 },
  { bib: "5", name: "Demo runner E", speed: 4.0, stopsAfterSec: 90 },
  { bib: "6", name: "Demo runner F", speed: 3.6 },
];
let seed = 1; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 2;
/** True distance each demo runner has covered after `sec` seconds. */
export const demoDistance = (r: (typeof DEMO_RUNNERS)[number], sec: number) => r.speed * Math.min(sec, r.stopsAfterSec ?? Infinity);
/** Where each demo runner is after `sec` seconds, with about `noiseM` metres of GPS-like wobble. */
export function demoPositions(place: Pick<TrackPlace, "center" | "bearing">, sec: number, now: number, noiseM = 3): Seen[] {
  return DEMO_RUNNERS.map((r, i) => {
    const p = pointOnTrack(place, i * 6 + demoDistance(r, sec)); // small staggered start
    return { runnerId: r.bib, ...destination(destination(p, 0, rnd() * noiseM), 90, rnd() * noiseM), at: now };
  });
}
