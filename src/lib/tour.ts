export interface TourStep {
  id: string;
  selector?: string;
  title: string;
  badge: string;
  description: string;
  actionHint: string;
  suggestedTab?: "today" | "session" | "runners" | "map" | "dispatch" | "club";
}

export type TourMode = "most_used" | "overview";

/** High-impact, most-used daily action buttons on the app */
export const MOST_USED_TOUR_STEPS: TourStep[] = [
  {
    id: "btn-workout-type",
    selector: '.ipac-seg[aria-label="Session type"]',
    title: "Workout Mode Buttons (Race, Laps, Intervals)",
    badge: "Most-Used Button",
    description: "These 3 toggle buttons switch the timing engine: 'Race' for continuous road timing, 'Laps' for track circuits, or 'Intervals' for speed repetitions.",
    actionHint: "Tap 'Intervals' to configure rep meters and rest intervals with sound cues.",
    suggestedTab: "session",
  },
  {
    id: "btn-distance-chips",
    selector: '.ipac-chips[aria-label="Distance"]',
    title: "Distance Preset Dials (1k, 3k, 5k, 10k, 21.1k)",
    badge: "Most-Used Button",
    description: "One tap selects your session target distance. You can also type any custom distance in the 'Other' input box.",
    actionHint: "Sets target splits for the virtual pacer rabbit and PB rankings.",
    suggestedTab: "session",
  },
  {
    id: "btn-start-race",
    selector: ".ipac-cta button.ipac-btn-hero, .ipac-cta",
    title: "Primary Start Race Button",
    badge: "Core Action Button",
    description: "The primary button you press on the start line. Starts a 5-second voice countdown with loud beeps, then begins the master clock on 'Go'.",
    actionHint: "During the run, tap runner bibs to record sub-second sprint finishes.",
    suggestedTab: "session",
  },
  {
    id: "btn-start-tracking",
    selector: ".ipac-track-btn, .ipac-tracker-actions",
    title: "Start GPS Tracking Button",
    badge: "Most-Used Button",
    description: "Press this button the moment you step outside to record your live route vector, kilometer pace, and moving speed.",
    actionHint: "Works completely offline. High-precision GPS keeps tracking without mobile data.",
    suggestedTab: "map",
  },
  {
    id: "btn-map-layers",
    selector: ".ipac-map-layer-selector",
    title: "Basemap Layer Switcher (Satellite & Topo)",
    badge: "Navigation Button",
    description: "Switch between high-resolution Satellite imagery, Topographic elevation contours, and Dark night mode with one tap.",
    actionHint: "Use Topo mode to preview hills and elevation climbs across Ivory Park.",
    suggestedTab: "map",
  },
  {
    id: "btn-dispatch-alarm",
    selector: ".ipac-card .ipac-form button.ipac-btn-primary",
    title: "Dispatch Offline Wake-Up Alarm Button",
    badge: "Coach Hub Action",
    description: "Coaches press this button to arm morning wake-ups. Generates a 1-tap WhatsApp link so the alarm rings on athletes' phones offline.",
    actionHint: "Athletes tap 'I Am Awake' to record their attendance timestamp.",
    suggestedTab: "dispatch",
  },
  {
    id: "btn-call-athletes",
    selector: ".ipac-tk-table tbody tr:first-child button.ipac-btn-primary, .ipac-tk-table",
    title: "1-on-1 Voice & Video Call Buttons",
    badge: "Direct Communication",
    description: "Every athlete in the roster has individual 'Voice Call' and 'Video Call' buttons for direct private check-ins before or after sessions.",
    actionHint: "Use 'Run Diagnostic Test' to verify your microphone and echo loopback.",
    suggestedTab: "dispatch",
  },
  {
    id: "btn-install-pwa",
    selector: '.ipac-head-actions button[title*="Get App"], .ipac-head-actions button:first-child',
    title: "Install App to Home Screen (Offline PWA)",
    badge: "Essential Setup",
    description: "Tap the download icon in the header to save this app to your phone. It runs directly from your home screen with zero mobile data required.",
    actionHint: "Works on both Android (Chrome) and iPhone (Safari).",
    suggestedTab: "session",
  },
];

/** General introductory overview tour */
export const OVERVIEW_TOUR_STEPS: TourStep[] = [
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

export const TOUR_STEPS = MOST_USED_TOUR_STEPS;
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
