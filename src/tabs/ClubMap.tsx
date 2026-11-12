import { useEffect, useRef, useState, type ReactNode } from "react";
import { haversineM, type LatLon } from "../lib/geo";

/**
 * High-precision street map powered by MapLibre GL with OpenFreeMap vector tiles
 * and CARTO raster fallback. Features directional animated route flows and full-screen locking.
 */
export interface MapMarker extends LatLon {
  id: string;
  label: string;
  kind: "dot" | "lead" | "alert" | "hub" | "me" | "start" | "finish" | "rank";
}

const OFM = "https://tiles.openfreemap.org/styles";
const isDark = () => {
  const t = document.documentElement.dataset.theme;
  return t ? t === "dark" : window.matchMedia?.("(prefers-color-scheme: dark)").matches;
};

const rasterStyle = (dark: boolean) => ({
  version: 8 as const,
  sources: {
    carto: {
      type: "raster" as const,
      tileSize: 256,
      attribution: "© OpenStreetMap contributors © CARTO",
      tiles: ["a", "b", "c", "d"].map((s) => `https://${s}.basemaps.cartocdn.com/rastertiles/${dark ? "dark_all" : "voyager"}/{z}/{x}/{y}@2x.png`),
    },
  },
  layers: [{ id: "carto", type: "raster" as const, source: "carto" }],
});

function webglOk() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export default function ClubMap({
  markers = [],
  line,
  fallback,
  label,
  center,
  zoom,
  fullscreen,
  onToggleFullscreen,
  floatingContent,
}: {
  markers?: MapMarker[];
  line?: LatLon[];
  fallback: ReactNode;
  label: string;
  center?: LatLon;
  zoom?: number;
  fullscreen?: boolean;
  onToggleFullscreen?: () => void;
  floatingContent?: ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const lib = useRef<any>(null);
  const pins = useRef(new Map<string, any>());
  const fitted = useRef(false);
  const animFrame = useRef<number | null>(null);
  const animIndex = useRef(0);
  const tracerPin = useRef<any>(null);

  const [state, setState] = useState<"loading" | "ready" | "fallback">(() =>
    (typeof navigator !== "undefined" && navigator.onLine === false) || !webglOk() ? "fallback" : "loading"
  );
  const lineRef = useRef(line);
  lineRef.current = line;

  // Lock body scroll completely when fullscreen is active
  useEffect(() => {
    if (fullscreen) {
      const prevBodyOverflow = document.body.style.overflow;
      const prevHtmlOverflow = document.documentElement.style.overflow;
      const prevTouch = document.body.style.touchAction;
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
      document.body.style.touchAction = "none";
      return () => {
        document.body.style.overflow = prevBodyOverflow;
        document.documentElement.style.overflow = prevHtmlOverflow;
        document.body.style.touchAction = prevTouch;
      };
    }
  }, [fullscreen]);

  // Resize MapLibre when switching to/from fullscreen
  useEffect(() => {
    const m = map.current;
    if (m) {
      const t = setTimeout(() => { m.resize(); }, 120);
      return () => clearTimeout(t);
    }
  }, [fullscreen]);

  // Initialize MapLibre
  useEffect(() => {
    if (state === "fallback" || !box.current) return;
    let gone = false;
    Promise.all([import("maplibre-gl"), import("maplibre-gl/dist/maplibre-gl.css")]).then(([mod]) => {
      if (gone || !box.current) return;
      const ml = (mod as any).default ?? mod;
      lib.current = ml;
      const first = center ?? markers[0] ?? line?.[0];
      const m = new ml.Map({
        container: box.current,
        style: `${OFM}/${isDark() ? "dark" : "bright"}`,
        center: first ? [first.lon, first.lat] : [28.2, -25.9967],
        zoom: zoom ?? 16,
        maxZoom: 20,
        attributionControl: { compact: true },
        cooperativeGestures: true,
        pixelRatio: Math.min(2, window.devicePixelRatio || 1),
      });
      map.current = m;

      let styled = false;
      const t = window.setTimeout(() => {
        if (!styled) m.setStyle(rasterStyle(isDark()));
      }, 6000);

      m.on("error", (e: any) => {
        if (!styled && /style/i.test(String(e?.error?.message ?? ""))) {
          m.setStyle(rasterStyle(isDark()));
        }
      });

      m.on("styledata", () => {
        styled = true;
        window.clearTimeout(t);
        drawRoute(m, lineRef.current);
      });

      m.on("load", () => {
        if (!gone) setState("ready");
      });
    }).catch(() => !gone && setState("fallback"));

    return () => {
      gone = true;
      if (animFrame.current) cancelAnimationFrame(animFrame.current);
      map.current?.remove();
      map.current = null;
      pins.current.clear();
      tracerPin.current = null;
    };
  }, [state === "fallback"]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pan to center smoothly
  useEffect(() => {
    const m = map.current;
    if (m && center) {
      m.panTo([center.lon, center.lat], { duration: 600 });
    }
  }, [center?.lat, center?.lon]);

  // Update Markers & Animated Route
  useEffect(() => {
    const m = map.current;
    const ml = lib.current;
    if (!m || !ml) return;

    // Build synthesized Start/Finish markers if route line exists and no explicit markers
    const routeMarkers: MapMarker[] = [...markers];
    if (line && line.length > 1) {
      const isLoop = haversineM(line[0], line[line.length - 1]) < 80;
      if (isLoop) {
        if (!markers.some((x) => x.id === "start" || x.id === "hub" || x.id === "route-start")) {
          routeMarkers.push({
            id: "route-start",
            lat: line[0].lat,
            lon: line[0].lon,
            label: "START",
            kind: "start",
          });
        }
      } else {
        if (!markers.some((x) => x.id === "start" || x.id === "hub" || x.id === "route-start")) {
          routeMarkers.push({
            id: "route-start",
            lat: line[0].lat,
            lon: line[0].lon,
            label: "START",
            kind: "start",
          });
        }
        if (!markers.some((x) => x.id === "end" || x.id === "finish" || x.id === "route-finish")) {
          routeMarkers.push({
            id: "route-finish",
            lat: line[line.length - 1].lat,
            lon: line[line.length - 1].lon,
            label: "FINISH",
            kind: "finish",
          });
        }
      }
    }

    const keep = new Set(routeMarkers.map((x) => x.id));
    for (const [id, pin] of pins.current) {
      if (!keep.has(id)) {
        pin.remove();
        pins.current.delete(id);
      }
    }

    for (const x of routeMarkers) {
      let pin = pins.current.get(x.id);
      if (!pin) {
        const el = document.createElement("div");
        el.className = `maplibregl-marker ipac-pin ipac-pin-${x.kind}`;
        pin = new ml.Marker({ element: el }).setLngLat([x.lon, x.lat]).addTo(m);
        pins.current.set(x.id, pin);
      }
      const el = pin.getElement() as HTMLDivElement;
      el.className = `maplibregl-marker ipac-pin ipac-pin-${x.kind}`;
      el.textContent = x.label;
      el.setAttribute("aria-label", x.label);
      pin.setLngLat([x.lon, x.lat]);
    }

    drawRoute(m, line);

    // Animated directional route tracer (traveling indicator along the route)
    if (line && line.length > 2) {
      if (!tracerPin.current) {
        const tel = document.createElement("div");
        tel.className = "maplibregl-marker ipac-pin-me";
        tracerPin.current = new ml.Marker({ element: tel }).setLngLat([line[0].lon, line[0].lat]).addTo(m);
      }

      let step = 0;
      const animateRoute = () => {
        step = (step + 1) % (line.length * 4);
        const idx = Math.floor(step / 4);
        if (line[idx] && tracerPin.current) {
          tracerPin.current.setLngLat([line[idx].lon, line[idx].lat]);
        }
        animFrame.current = requestAnimationFrame(animateRoute);
      };
      if (animFrame.current) cancelAnimationFrame(animFrame.current);
      animFrame.current = requestAnimationFrame(animateRoute);
    } else if (tracerPin.current) {
      tracerPin.current.remove();
      tracerPin.current = null;
      if (animFrame.current) cancelAnimationFrame(animFrame.current);
    }

    const pts = [...routeMarkers, ...(line ?? [])];
    if (!fitted.current && pts.length && !center) {
      const lons = pts.map((p) => p.lon);
      const lats = pts.map((p) => p.lat);
      m.fitBounds(
        [[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]],
        { padding: 45, maxZoom: 18, duration: 0 }
      );
      fitted.current = true;
    }
  }, [markers, line, state]);

  if (state === "fallback") return <>{fallback}</>;

  return (
    <div className={`ipac-mapwrap ${fullscreen ? "fullscreen" : ""}`}>
      <div ref={box} className="ipac-mlmap" role="region" aria-label={label} />
      {floatingContent}
      {onToggleFullscreen && (
        <div className="ipac-floating-actions">
          <button
            type="button"
            className="ipac-map-ctrl-btn"
            onClick={onToggleFullscreen}
            aria-label={fullscreen ? "Exit full screen map" : "Full screen map"}
          >
            {fullscreen ? "Exit Fullscreen" : "Fullscreen"}
          </button>
        </div>
      )}
      {state === "loading" && <p className="ipac-hint ipac-maploading">Loading street map…</p>}
    </div>
  );
}

function drawRoute(m: any, line?: LatLon[]) {
  try {
    const coords = (line ?? []).map((p) => [p.lon, p.lat]);
    const data = {
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates: coords },
    };

    // 1. Base route glow line
    const src = m.getSource("ipac-route");
    if (src) {
      src.setData(data);
    } else if (m.isStyleLoaded()) {
      m.addSource("ipac-route", { type: "geojson", data });

      // Outer route line
      m.addLayer({
        id: "ipac-route-casing",
        type: "line",
        source: "ipac-route",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "#ffffff",
          "line-width": 8,
          "line-opacity": 0.9,
        },
      });

      // Core route line
      m.addLayer({
        id: "ipac-route",
        type: "line",
        source: "ipac-route",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "#e81820",
          "line-width": 5,
          "line-opacity": 0.95,
        },
      });

      // Directional arrow dash layer
      m.addLayer({
        id: "ipac-route-arrows",
        type: "line",
        source: "ipac-route",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "#ffffff",
          "line-width": 2,
          "line-dasharray": [1, 3],
          "line-opacity": 0.9,
        },
      });
    }
  } catch {
    // Style still loading: drawn on styledata
  }
}
