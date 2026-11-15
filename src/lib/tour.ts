export interface TourStep {
  id: string;
  selector?: string;
  title: string;
  badge: string;
  description: string;
  actionHint: string;
  suggestedTab?: "today" | "session" | "runners" | "map" | "dispatch" | "club";
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    selector: ".ipac-head",
    title: "Welcome to Ivory Park Athletics Club",
    badge: "Official Club Hub",
    description: "This application powers race timing, training intervals, live GPS routing, and morning wake-up coordination for our team.",
    actionHint: "Works 100% offline directly in your phone browser with zero mobile data.",
  },
  {
    id: "offline-install",
    selector: ".ipac-head-actions",
    title: "Install App & Share QR Code",
    badge: "Offline PWA",
    description: "Tap the download icon to install the app onto your phone home screen, or scan the QR code to sync with other athletes.",
    actionHint: "Installs on both Android (Chrome) and iPhone (Safari).",
  },
  {
    id: "session-status",
    selector: ".ipac-status",
    title: "Live Race & Interval Stopwatch",
    badge: "Timing & Splits",
    description: "Displays the active session stage, runner count, and elapsed time. Tap 'Options' to configure countdown beeps, voice calls, or end the session.",
    actionHint: "Record sub-second sprint finishes with one-tap bib buttons.",
    suggestedTab: "session",
  },
  {
    id: "team-dispatch",
    selector: ".ipac-nav",
    title: "Team Hub & Offline Wake-Up Alarms",
    badge: "Coach Dispatch",
    description: "Coaches schedule morning wake-up alarms that ring on athletes' phones offline, optimize minibus taxi pickup routes, and make direct 1-on-1 calls.",
    actionHint: "Includes microphone loopback tests and athlete read receipts.",
    suggestedTab: "dispatch",
  },
  {
    id: "live-map",
    selector: ".ipac-nav",
    title: "Live GPS Map & Virtual Pacer",
    badge: "Satellite & Topo",
    description: "Track routes across Ivory Park with 4 map layers (Street, Dark, Topo, Satellite), 1K milestone split badges, and an animated pacer rabbit.",
    actionHint: "Follow lock keeps the map centered on your live coordinates.",
    suggestedTab: "map",
  },
  {
    id: "club-themes",
    selector: ".ipac-nav",
    title: "10 Custom Themes & Club Profile",
    badge: "Appearance",
    description: "Personalize your display with 10 visual color themes like Springbok Gold, Highveld Sunrise, Midnight Stealth, or Sunlight High-Contrast.",
    actionHint: "Configure voice call frequencies and club distances.",
    suggestedTab: "club",
  },
];

export const STORAGE_KEY_TOUR = "ipac_tour_completed";

export function isTourCompleted(): boolean {
  try {
    if (typeof localStorage === "undefined") return false;
    return localStorage.getItem(STORAGE_KEY_TOUR) === "true";
  } catch {
    return false;
  }
}

export function setTourCompleted(completed = true): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(STORAGE_KEY_TOUR, completed ? "true" : "false");
  } catch {
    /* storage blocked */
  }
}
