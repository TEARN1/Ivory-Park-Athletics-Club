import { describe, expect, it } from "vitest";
import {
  ATHLETE_PICKUP_ROSTER,
  DEFAULT_VEHICLES,
  RACE_VENUES,
  formatTransportWhatsApp,
  googleMapsDriverRoute,
  optimizeMultiVehicleSchedule,
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

  it("distributes athletes across multiple transport vehicles according to seat capacity", () => {
    const allAthletes = ATHLETE_PICKUP_ROSTER.slice(0, 6);
    const plans = optimizeMultiVehicleSchedule(DEFAULT_VEHICLES, allAthletes, RACE_VENUES[1], "04:30");

    expect(plans.length).toBe(2);
    expect(plans[0].vehicle.capacity).toBe(14);
    expect(plans[1].vehicle.capacity).toBe(4);
    const totalAssigned = plans.reduce((acc, p) => acc + p.athletes.length, 0);
    expect(totalAssigned).toBe(6);
    expect(plans[0].schedule.stops.length).toBeGreaterThanOrEqual(1);
  });

  it("generates valid Google Maps driver navigation URL with origin and waypoints", () => {
    const selected = ATHLETE_PICKUP_ROSTER.slice(0, 2);
    const plan = optimizePickupRoute(selected, RACE_VENUES[1], "04:30");
    const mapsUrl = googleMapsDriverRoute(plan);

    expect(mapsUrl).toContain("https://www.google.com/maps/dir/");
    expect(mapsUrl).toContain("travelmode=driving");
    expect(mapsUrl).toContain(String(selected[0].coords.lat));
  });
});
