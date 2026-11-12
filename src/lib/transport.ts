import { haversineM, type LatLon } from "./geo";

/**
 * Race Day Transport & Athlete Pick-up Route Optimizer
 * Solves the optimal shortest driving route for picking up athletes across
 * Ivory Park / Midrand and transporting them directly to the race venue.
 */

export interface AthletePickupLocation {
  id: string;
  name: string;
  bib: string;
  addressLabel: string;
  coords: LatLon;
  contactPhone: string;
  pickupReady: boolean;
}

export interface RaceVenue {
  id: string;
  name: string;
  city: string;
  coords: LatLon;
  approxDistanceKm: number;
}

export interface PickupStop {
  stopNumber: number;
  athleteId: string;
  athleteName: string;
  bib: string;
  locationLabel: string;
  coords: LatLon;
  eta: string;
  distanceFromPrevKm: number;
  driveTimeMin: number;
}

export interface OptimizedPickupSchedule {
  startDepot: { label: string; coords: LatLon; departureTime: string };
  stops: PickupStop[];
  destination: { name: string; coords: LatLon; arrivalEta: string };
  totalDistanceKm: number;
  totalDriveTimeMin: number;
  routePoints: LatLon[];
}

export const IVORY_PARK_DEPOT: { label: string; coords: LatLon } = {
  label: "Ivory Park Athletics Hub / Freedom Drive Depot",
  coords: { lat: -25.9967, lon: 28.2000 },
};

export const ATHLETE_PICKUP_ROSTER: AthletePickupLocation[] = [
  {
    id: "pickup-1",
    name: "Sibusiso Molefe",
    bib: "12",
    addressLabel: "Ext 2 Community Hall (c/r 14th Sept & Makhaya)",
    coords: { lat: -26.0021, lon: 28.1945 },
    contactPhone: "+27 82 450 1192",
    pickupReady: true,
  },
  {
    id: "pickup-2",
    name: "Katlego Dlamini",
    bib: "07",
    addressLabel: "Freedom Drive & 29th Sept St",
    coords: { lat: -25.9912, lon: 28.2052 },
    contactPhone: "+27 73 981 4452",
    pickupReady: true,
  },
  {
    id: "pickup-3",
    name: "Thabo Mokoena",
    bib: "24",
    addressLabel: "Ext 7 Taxi Rank / Municipal Library",
    coords: { lat: -26.0105, lon: 28.1880 },
    contactPhone: "+27 81 332 9901",
    pickupReady: true,
  },
  {
    id: "pickup-4",
    name: "Lerato Khumalo",
    bib: "18",
    addressLabel: "Ext 12 Clinic & Sports Ground",
    coords: { lat: -26.0150, lon: 28.2110 },
    contactPhone: "+27 61 774 2309",
    pickupReady: true,
  },
  {
    id: "pickup-5",
    name: "Naledi Sithole",
    bib: "31",
    addressLabel: "Swazi Inn Commercial Complex",
    coords: { lat: -25.9860, lon: 28.1830 },
    contactPhone: "+27 84 550 8731",
    pickupReady: true,
  },
  {
    id: "pickup-6",
    name: "Sipho Ndlovu",
    bib: "05",
    addressLabel: "Ext 9 Soccer Pitch / Primary School",
    coords: { lat: -26.0070, lon: 28.2030 },
    contactPhone: "+27 72 119 8840",
    pickupReady: false,
  },
];

export const RACE_VENUES: RaceVenue[] = [
  {
    id: "venue-soweto",
    name: "Soweto Marathon (FNB Stadium)",
    city: "Nasrec / Johannesburg",
    coords: { lat: -26.2348, lon: 27.9824 },
    approxDistanceKm: 38.5,
  },
  {
    id: "venue-waterfall",
    name: "Waterfall City 10k & 21k (Mall of Africa)",
    city: "Midrand",
    coords: { lat: -26.0160, lon: 28.1090 },
    approxDistanceKm: 11.2,
  },
  {
    id: "venue-germiston",
    name: "CGA Championships (Germiston Stadium)",
    city: "Ekurhuleni",
    coords: { lat: -26.2230, lon: 28.1690 },
    approxDistanceKm: 27.8,
  },
  {
    id: "venue-pretoria",
    name: "Pretoria Marathon (LC de Villiers UP Campus)",
    city: "Hatfield / Pretoria",
    coords: { lat: -25.7530, lon: 28.2570 },
    approxDistanceKm: 32.4,
  },
  {
    id: "venue-benoni",
    name: "Johnson Crane Hire Marathon (Benoni Northerns)",
    city: "Benoni",
    coords: { lat: -26.1720, lon: 28.3240 },
    approxDistanceKm: 26.5,
  },
];

/**
 * Optimizes the shortest pick-up route using Nearest Neighbor with 2-opt refinement.
 * Starts from Ivory Park Depot, visits each selected athlete, and heads to the race venue.
 */
export function optimizePickupRoute(
  selectedAthletes: AthletePickupLocation[],
  venue: RaceVenue,
  departureTime = "05:00",
  startDepot = IVORY_PARK_DEPOT
): OptimizedPickupSchedule {
  if (selectedAthletes.length === 0) {
    const directDistKm = Math.round((haversineM(startDepot.coords, venue.coords) / 1000) * 1.25 * 10) / 10;
    const directTimeMin = Math.round((directDistKm / 65) * 60);
    return {
      startDepot: { ...startDepot, departureTime },
      stops: [],
      destination: { name: venue.name, coords: venue.coords, arrivalEta: addMinutesToTime(departureTime, directTimeMin) },
      totalDistanceKm: directDistKm,
      totalDriveTimeMin: directTimeMin,
      routePoints: [startDepot.coords, venue.coords],
    };
  }

  // Nearest Neighbor TSP heuristic for athlete pickup stops
  const unvisited = [...selectedAthletes];
  const orderedStops: AthletePickupLocation[] = [];
  let currentPos = startDepot.coords;

  while (unvisited.length > 0) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < unvisited.length; i++) {
      const d = haversineM(currentPos, unvisited[i].coords);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    const nextStop = unvisited.splice(bestIdx, 1)[0];
    orderedStops.push(nextStop);
    currentPos = nextStop.coords;
  }

  // 2-opt local search optimization to uncross any overlaps
  let improved = true;
  while (improved && orderedStops.length > 2) {
    improved = false;
    for (let i = 0; i < orderedStops.length - 1; i++) {
      for (let k = i + 1; k < orderedStops.length; k++) {
        const prevCoord = i === 0 ? startDepot.coords : orderedStops[i - 1].coords;
        const nextCoord = k === orderedStops.length - 1 ? venue.coords : orderedStops[k + 1].coords;

        const currentDist =
          haversineM(prevCoord, orderedStops[i].coords) + haversineM(orderedStops[k].coords, nextCoord);
        const newDist =
          haversineM(prevCoord, orderedStops[k].coords) + haversineM(orderedStops[i].coords, nextCoord);

        if (newDist < currentDist - 20) {
          // reverse slice
          const reversed = orderedStops.slice(i, k + 1).reverse();
          orderedStops.splice(i, reversed.length, ...reversed);
          improved = true;
        }
      }
    }
  }

  // Build timeline and ETAs
  let curTime = departureTime;
  let runningDistM = 0;
  let runningTimeMin = 0;
  let prevPos = startDepot.coords;
  const stops: PickupStop[] = [];
  const routePoints: LatLon[] = [startDepot.coords];

  orderedStops.forEach((athlete, idx) => {
    // Road winding factor: 1.25x haversine
    const legM = haversineM(prevPos, athlete.coords) * 1.25;
    const legKm = Math.round((legM / 1000) * 10) / 10;
    // Township average speed ~35 km/h + 2 min boarding per stop
    const legDriveMin = Math.max(3, Math.round((legKm / 35) * 60) + 2);

    runningDistM += legM;
    runningTimeMin += legDriveMin;
    curTime = addMinutesToTime(curTime, legDriveMin);

    stops.push({
      stopNumber: idx + 1,
      athleteId: athlete.id,
      athleteName: athlete.name,
      bib: athlete.bib,
      locationLabel: athlete.addressLabel,
      coords: athlete.coords,
      eta: curTime,
      distanceFromPrevKm: legKm,
      driveTimeMin: legDriveMin,
    });

    routePoints.push(athlete.coords);
    prevPos = athlete.coords;
  });

  // Final leg to destination race venue (highway speed ~75 km/h)
  const finalLegM = haversineM(prevPos, venue.coords) * 1.22;
  const finalLegKm = Math.round((finalLegM / 1000) * 10) / 10;
  const finalDriveMin = Math.round((finalLegKm / 75) * 60);

  runningDistM += finalLegM;
  runningTimeMin += finalDriveMin;
  const finalEta = addMinutesToTime(curTime, finalDriveMin);

  routePoints.push(venue.coords);

  return {
    startDepot: { ...startDepot, departureTime },
    stops,
    destination: { name: venue.name, coords: venue.coords, arrivalEta: finalEta },
    totalDistanceKm: Math.round((runningDistM / 1000) * 10) / 10,
    totalDriveTimeMin: runningTimeMin,
    routePoints,
  };
}

/** Formats departure time + minutes to "HH:MM" */
function addMinutesToTime(timeStr: string, minutes: number): string {
  const [hStr, mStr] = timeStr.split(":");
  let totalMin = (parseInt(hStr, 10) || 0) * 60 + (parseInt(mStr, 10) || 0) + minutes;
  totalMin = (totalMin + 1440) % 1440; // wrap 24h
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h < 10 ? "0" : ""}${h}:${m < 10 ? "0" : ""}${m}`;
}

/** Generates clean team WhatsApp transport dispatch message */
export function formatTransportWhatsApp(plan: OptimizedPickupSchedule): string {
  const lines: string[] = [];
  lines.push(`*IVORY PARK ATHLETICS CLUB - RACE DAY TRANSPORT*`);
  lines.push(`*Destination:* ${plan.destination.name}`);
  lines.push(`*Depot Departure:* ${plan.startDepot.departureTime} (${plan.startDepot.label})`);
  lines.push(`*Total Transit:* ${plan.totalDistanceKm} km · ${plan.totalDriveTimeMin} mins (Arrival ${plan.destination.arrivalEta})\n`);
  lines.push(`*Athlete Pick-up Schedule:*`);

  plan.stops.forEach((s) => {
    lines.push(
      `Stop ${s.stopNumber} · *${s.eta}* -> *${s.athleteName}* (Bib #${s.bib})\n   Pick-up: ${s.locationLabel}`
    );
  });

  lines.push(`\n*Arrival Venue:* ${plan.destination.arrivalEta}`);
  lines.push(`*Please be outside your gate 5 minutes before your ETA.* Let's go Team Ivory Park!`);
  return lines.join("\n");
}
