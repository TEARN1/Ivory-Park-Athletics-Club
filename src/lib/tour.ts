export interface TourStep {
  id: string;
  selector?: string;
  title: string;
  badge: string;
  description: string;
  actionHint: string;
  suggestedTab?: "today" | "session" | "runners" | "map" | "dispatch" | "club";
}

export type TourMode = "athlete_guide" | "coach_mastery" | "most_used" | "overview";

/** Track 1: Athlete Daily Guide: Training, HUD & Pick Me Up */
export const ATHLETE_GUIDE_STEPS: TourStep[] = [
  {
    id: "ath-pwa",
    selector: '.ipac-head-actions button[title*="Get App"], .ipac-head-actions button:first-child',
    title: "1. Install PWA for Zero-Data Offline Access",
    badge: "Athlete Essential",
    description: "Install this app directly to your phone home screen. Once installed, it runs 100% offline without requiring cellular data.",
    actionHint: "Tap the install icon in the header, or choose 'Add to Home Screen' in your mobile browser menu.",
    suggestedTab: "today",
  },
  {
    id: "ath-gps-map",
    selector: ".ipac-map-engine-pill, .ipac-floating-actions",
    title: "2. Single-Touch Map Navigation & Live GPS",
    badge: "In-Run Navigation",
    description: "Navigate routes across Ivory Park with one-finger touch controls. Tap 'My Location' to instantly center the camera on your live GPS coordinates.",
    actionHint: "Switch between OpenStreetMap Night and Esri Satellite Hybrid without any API paywalls.",
    suggestedTab: "map",
  },
  {
    id: "ath-pickup",
    selector: ".ipac-card:has(h3:contains('Pickup'))",
    title: "3. Race-Day Gate Pickup Request",
    badge: "Fleet Logistics",
    description: "Before sleeping or on Saturday morning, tap 'Pick Me Up' to transmit your high-accuracy GPS coordinates to the coach van and volunteer carpools.",
    actionHint: "Locks your exact gate coordinates within +/- 4 meters, eliminating rough cell-tower offsets.",
    suggestedTab: "today",
  },
  {
    id: "ath-hud",
    selector: ".ipac-card:has(h2:contains('Today'))",
    title: "4. High-Contrast Runner Heads-Up Display (HUD)",
    badge: "Glanceable Timing",
    description: "Switch to AMOLED black HUD mode during training for giant, high-contrast numbers displaying elapsed time, pace per km, and distance.",
    actionHint: "Automatic Screen Wake Lock prevents your phone from sleeping while running on pace.",
    suggestedTab: "session",
  },
  {
    id: "ath-handsfree",
    selector: ".ipac-status",
    title: "5. Hands-Free Audio Splits & Earphone Controls",
    badge: "Audio Intelligence",
    description: "Receive automatic spoken kilometer pace announcements through your earphones. Tap your Bluetooth earphone button to log lap splits without touching your phone.",
    actionHint: "Configure voice cadence and lap announcements in Appearance settings.",
    suggestedTab: "session",
  },
  {
    id: "ath-safety",
    selector: ".ipac-map-loc-banner, .ipac-floating-actions",
    title: "6. Township Safety Flags & Emergency SOS Beacon",
    badge: "Athlete Protection",
    description: "Inspect road hazard markers for unlit intersections and loose dogs. Use the SOS button to instantly share your exact location via WhatsApp or SMS in an emergency.",
    actionHint: "Check morning sunrise alerts to ensure you run with reflective gear before dawn.",
    suggestedTab: "map",
  },
];

/** Track 2: Coach & Race Director Mastery */
export const COACH_MASTERY_STEPS: TourStep[] = [
  {
    id: "coach-distances",
    selector: '.ipac-chips[aria-label="Distance"]',
    title: "1. Race Distances (1, 2, 5, 10, 15, 20, 21.1 km)",
    badge: "Session Setup",
    description: "One-click distance dials configured for Ivory Park speedwork and long runs, from 1 km cadence repeats to 21.1 km Highveld endurance tests.",
    actionHint: "Select a distance preset to automatically calibrate target paces and runner rankings.",
    suggestedTab: "session",
  },
  {
    id: "coach-clock",
    selector: ".ipac-cta button.ipac-btn-hero, .ipac-cta",
    title: "2. Master Race Clock & Starter Horn",
    badge: "Field Operations",
    description: "Start official sessions with a synthesized 5-second countdown and loud start horn. Audio plays cleanly through connected Bluetooth track speakers.",
    actionHint: "Supports staggered wave heats (Sub-20 5K, 5:00/km pack, Junior Development squad).",
    suggestedTab: "session",
  },
  {
    id: "coach-bib-pad",
    selector: ".ipac-tk-table-wrap, .ipac-card",
    title: "3. Rapid-Tap Bib Keypad & Volume Button Logging",
    badge: "Finish Line Timing",
    description: "Rapidly record sprint finishes by tapping bib digits on the keypad, or press physical device volume buttons to capture split seconds with tactile feedback.",
    actionHint: "Sub-second millisecond timestamps prevent finish chute congestion.",
    suggestedTab: "session",
  },
  {
    id: "coach-fleet",
    selector: ".ipac-card:has(label:contains('Transport'))",
    title: "4. Multi-Vehicle Fleet Dispatch & Driver Turn-by-Turn",
    badge: "Transport Optimizer",
    description: "Optimize shortest driving routes across the 14-seater Coach Van and 4-seater Carpool. Export turn-by-turn multi-stop Google Maps directions with one click.",
    actionHint: "Automatic geographic clustering balances seat capacities and minimizes fuel transit.",
    suggestedTab: "map",
  },
  {
    id: "coach-alarm",
    selector: ".ipac-card .ipac-form button.ipac-btn-primary",
    title: "5. Morning 04:30 Wake-Up Alarm & Squad Dispatch",
    badge: "Saturday Coordination",
    description: "Broadcast offline alarms for Saturday 5km time trials and league races. Generates WhatsApp links that sound alarms on athletes' phones even without network access.",
    actionHint: "Track live attendance check-ins (Awake, En Route, Needs Pickup).",
    suggestedTab: "dispatch",
  },
  {
    id: "coach-asa-export",
    selector: ".ipac-card:has(button:contains('CSV'))",
    title: "6. CGA / ASA Compliance Export & Cloud Isolation",
    badge: "Official Sanctioning",
    description: "Export Central Gauteng Athletics (CGA) and ASA sanctioning reports with category rankings. Synced securely to the shared Supabase database in dedicated 'ipac_*' tables.",
    actionHint: "Complete separation from The Resident and The Grooves database records.",
    suggestedTab: "club",
  },
];

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
