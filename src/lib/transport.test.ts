import { describe, expect, it } from "vitest";
import {
  ATHLETE_PICKUP_ROSTER,
  RACE_VENUES,
  formatTransportWhatsApp,
  optimizePickupRoute,
} from "./transport";

describe("transport optimizer", () => {
  it("optimizes shortest pickup route visiting all selected athletes and arriving at venue", () => {
    const selectedAthletes = ATHLETE_PICKUP_ROSTER.slice(0, 3);
    const destination = RACE_VENUES[0]; // Soweto Marathon / FNB Stadium
    const plan = optimizePickupRoute(selectedAthletes, destination, "05:00");

    expect(plan.stops.length).toBe(3);
    expect(plan.destination.name).toContain("Soweto");
    expect(plan.totalDistanceKm).toBeGreaterThan(30);
    expect(plan.stops[0].eta).toBeDefined();
    expect(plan.destination.arrivalEta).toBeDefined();
    expect(plan.routePoints.length).toBeGreaterThan(4);
  });

  it("formats WhatsApp itinerary message cleanly without emojis", () => {
    const selectedAthletes = ATHLETE_PICKUP_ROSTER.slice(0, 2);
    const destination = RACE_VENUES[1]; // Waterfall City Half Marathon
    const plan = optimizePickupRoute(selectedAthletes, destination, "05:30");
    const waText = formatTransportWhatsApp(plan);

    expect(waText).toContain("IVORY PARK ATHLETICS CLUB");
    expect(waText).toContain("RACE DAY TRANSPORT");
    expect(waText).toContain("Waterfall City");
    expect(waText).toContain("Stop 1");
    // Ensure no emojis exist
    expect(/[\uD800-\uDFFF]/.test(waText)).toBe(false);
  });
});
