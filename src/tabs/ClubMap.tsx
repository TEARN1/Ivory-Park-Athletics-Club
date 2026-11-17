import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { haversineM, type LatLon } from "../lib/geo";

/**
 * High-precision street map powered by MapLibre GL with OpenFreeMap vector tiles
 * and CARTO raster fallback. Features directional animated route flows and full-screen locking.
 */
export interface MapMarker extends LatLon {
  id: string;
  label: string;
  kind: "dot" | "lead" | "alert" | "hub" | "me" | "start" | "finish" | "rank" | "km" | "pacer";
}

export type MapLayerStyle = "streets" | "dark" | "topo" | "satellite";

const OFM = "https://tiles.openfreemap.org/styles";
const isDark = () => {
  const t = document.documentElement.dataset.theme;
  return t ? t === "dark" : window.matchMedia?.("(prefers-color-scheme: dark)").matches;
};

const getLayerStyle = (layer: MapLayerStyle, dark = isDark()) => {
  switch (layer) {
    case "dark":
      return {
        version: 8 as const,
        sources: {
          osm: {
            type: "raster" as const,
            tileSize: 256,
            attribution: "© OpenStreetMap contributors",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
          },
        },
        layers: [
          {
            id: "osm",
            type: "raster" as const,
            source: "osm",
            paint: {
              "raster-saturation": -0.85,
              "raster-contrast": 0.25,
              "raster-brightness-max": 0.45,
              "raster-brightness-min": 0.05,
            },
          },
        ],
      };
    case "topo":
      return {
        version: 8 as const,
        sources: {
          topo: {
            type: "raster" as const,
            tileSize: 256,
            maxzoom: 17,
            attribution: "© OpenTopoMap contributors",
            tiles: ["a", "b", "c"].map((s) => `https://${s}.tile.opentopomap.org/{z}/{x}/{y}.png`),
          },
        },
        layers: [{ id: "topo", type: "raster" as const, source: "topo" }],
      };
    case "satellite":
      return {
        version: 8 as const,
        sources: {
          esri: {
            type: "raster" as const,
            tileSize: 256,
            maxzoom: 19,
            attribution: "Imagery © Esri, Roads © OpenStreetMap",
            tiles: [
              "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
              "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
            ],
          },
          roads: {
            type: "raster" as const,
            tileSize: 256,
            maxzoom: 19,
            attribution: "Roads © Esri",
            tiles: [
              "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}",
            ],
          },
          places: {
            type: "raster" as const,
            tileSize: 256,
            maxzoom: 19,
            attribution: "Places © Esri",
            tiles: [
              "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
            ],
          },
        },
        layers: [
          { id: "esri", type: "raster" as const, source: "esri" },
          { id: "roads", type: "raster" as const, source: "roads" },
          { id: "places", type: "raster" as const, source: "places" },
        ],
      };
    case "streets":
    default:
      return {
        version: 8 as const,
        sources: {
          osm: {
            type: "raster" as const,
            tileSize: 256,
            attribution: "© OpenStreetMap contributors",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
          },
        },
        layers: [{ id: "osm", type: "raster" as const, source: "osm" }],
      };
  }
};

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
  const userPin = useRef<any>(null);

  const [state, setState] = useState<"loading" | "ready" | "fallback">(() =>
    (typeof navigator !== "undefined" && navigator.onLine === false) || !webglOk() ? "fallback" : "loading"
  );
  const [layer, setLayer] = useState<MapLayerStyle>("streets");
  const [showMilestones, setShowMilestones] = useState(true);
  const [follow, setFollow] = useState(true);
  const [userLoc, setUserLoc] = useState<{ lat: number; lon: number; accuracy: number } | null>(null);
  const [locPerm, setLocPerm] = useState<"granted" | "prompt" | "denied">("prompt");
  const [screenshotMsg, setScreenshotMsg] = useState("");
  const lineRef = useRef(line);
  lineRef.current = line;

  // Immediate High-Accuracy Geolocation Acquisition on entry
  const requestLocation = useCallback(() => {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = {
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy),
        };
        setUserLoc(coords);
        setLocPerm("granted");
        if (map.current) {
          map.current.flyTo({ center: [coords.lon, coords.lat], zoom: 16, duration: 800 });
        }
      },
      (err) => {
        if (err.code === 1) setLocPerm("denied");
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  }, []);

  useEffect(() => {
    if (!("geolocation" in navigator)) return;
    requestLocation();
    const wid = navigator.geolocation.watchPosition(
      (pos) => {
        setUserLoc({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy),
        });
        setLocPerm("granted");
      },
      (err) => {
        if (err.code === 1) setLocPerm("denied");
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 2000 }
    );
    return () => navigator.geolocation.clearWatch(wid);
  }, [requestLocation]);

  // Manage fullscreen body class and body scroll
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.body.classList.toggle("has-fullscreen-map", !!fullscreen);
    }
    if (fullscreen) {
      const prevBodyOverflow = document.body.style.overflow;
      const prevHtmlOverflow = document.documentElement.style.overflow;
      const prevTouch = document.body.style.touchAction;
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
      document.body.style.touchAction = "none";
      return () => {
        if (typeof document !== "undefined") {
          document.body.classList.remove("has-fullscreen-map");
        }
        document.body.style.overflow = prevBodyOverflow;
        document.documentElement.style.overflow = prevHtmlOverflow;
        document.body.style.touchAction = prevTouch;
      };
    } else {
      if (typeof document !== "undefined") {
        document.body.classList.remove("has-fullscreen-map");
      }
    }
  }, [fullscreen]);

  // Resize MapLibre across multiple frames when switching to/from fullscreen
  useEffect(() => {
    const m = map.current;
    if (m) {
      const timers = [
        setTimeout(() => m.resize(), 40),
        setTimeout(() => m.resize(), 120),
        setTimeout(() => m.resize(), 250),
        setTimeout(() => m.resize(), 500),
      ];
      return () => timers.forEach(clearTimeout);
    }
  }, [fullscreen]);

  // Support Esc key to exit fullscreen
  useEffect(() => {
    if (!fullscreen || !onToggleFullscreen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onToggleFullscreen();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [fullscreen, onToggleFullscreen]);

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
        style: getLayerStyle(layer) as any,
        center: first ? [first.lon, first.lat] : [28.2, -25.9967],
        zoom: zoom ?? 16,
        maxZoom: 20,
        attributionControl: { compact: true },
        cooperativeGestures: false,
        dragPan: true,
        touchZoomRotate: true,
        doubleClickZoom: true,
        preserveDrawingBuffer: true,
        pixelRatio: Math.min(2, window.devicePixelRatio || 1),
      });
      map.current = m;

      let styled = false;
      const t = window.setTimeout(() => {
        if (!styled) m.setStyle(getLayerStyle(layer));
      }, 6000);

      m.on("error", (e: any) => {
        if (!styled && /style/i.test(String(e?.error?.message ?? ""))) {
          m.setStyle(getLayerStyle(layer));
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
      userPin.current = null;
    };
  }, [state === "fallback"]); // eslint-disable-line react-hooks/exhaustive-deps

  // Render live user location marker with radar pulse
  useEffect(() => {
    const m = map.current;
    const ml = lib.current;
    if (!m || !ml || !userLoc) return;

    if (!userPin.current) {
      const el = document.createElement("div");
      el.className = "ipac-gps-user-marker";
      el.innerHTML = '<div class="ipac-gps-pulse"></div><div class="ipac-gps-dot"></div>';
      userPin.current = new ml.Marker({ element: el })
        .setLngLat([userLoc.lon, userLoc.lat])
        .addTo(m);
    } else {
      userPin.current.setLngLat([userLoc.lon, userLoc.lat]);
    }
  }, [userLoc, state]);

  // High-Resolution Map Screenshot Capture
  const takeScreenshot = useCallback(async () => {
    const m = map.current;
    if (!m) return;
    setScreenshotMsg("Capturing map snapshot…");
    try {
      const mapCanvas = m.getCanvas();
      const exportCanvas = document.createElement("canvas");
      const ctx = exportCanvas.getContext("2d");
      if (!ctx) throw new Error("Canvas context unavailable");

      const headerH = 64;
      exportCanvas.width = mapCanvas.width;
      exportCanvas.height = mapCanvas.height + headerH;

      ctx.fillStyle = "#2A3090";
      ctx.fillRect(0, 0, exportCanvas.width, headerH);

      ctx.fillStyle = "#EAB308";
      ctx.fillRect(0, headerH - 3, exportCanvas.width, 3);

      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 18px sans-serif";
      ctx.fillText("IVORY PARK ATHLETICS CLUB", 18, 28);

      ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
      ctx.font = "12px sans-serif";
      const infoText = `${label || "Route Map"} · ${new Date().toLocaleDateString("en-ZA")} · Layer: ${layer.toUpperCase()}`;
      ctx.fillText(infoText, 18, 48);

      ctx.drawImage(mapCanvas, 0, headerH);

      exportCanvas.toBlob(async (blob) => {
        if (!blob) {
          setScreenshotMsg("Could not render image");
          return;
        }
        const fileName = `ipac-map-${layer}-${Date.now()}.png`;
        const file = new File([blob], fileName, { type: "image/png" });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              files: [file],
              title: "Ivory Park AC Map",
              text: `Route map for ${label} from Ivory Park Athletics Club.`,
            });
            setScreenshotMsg("Map shared successfully!");
          } catch {
            // fallback to download
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = fileName;
            a.click();
            URL.revokeObjectURL(url);
            setScreenshotMsg("Map screenshot saved!");
          }
        } else {
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = fileName;
          a.click();
          URL.revokeObjectURL(url);
          setScreenshotMsg("Map screenshot saved!");
        }
        setTimeout(() => setScreenshotMsg(""), 3500);
      }, "image/png");
    } catch (e) {
      setScreenshotMsg((e as Error).message || "Screenshot error");
      setTimeout(() => setScreenshotMsg(""), 3500);
    }
  }, [label, layer]);

  // Handle dynamic map layer switching
  useEffect(() => {
    const m = map.current;
    if (m && state === "ready") {
      m.setStyle(getLayerStyle(layer));
    }
  }, [layer, state]);

  // Pan to center smoothly when follow is enabled
  useEffect(() => {
    const m = map.current;
    if (m && center && follow) {
      m.panTo([center.lon, center.lat], { duration: 500 });
    }
  }, [center?.lat, center?.lon, follow]);

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

    // Synthesize 1-km milestone split badges along route
    if (showMilestones && line && line.length > 2) {
      let accumM = 0;
      let nextKmM = 1000;
      for (let k = 1; k < line.length; k++) {
        const seg = haversineM(line[k - 1], line[k]);
        accumM += seg;
        while (accumM >= nextKmM) {
          const kmNum = Math.floor(nextKmM / 1000);
          routeMarkers.push({
            id: `km-${kmNum}`,
            lat: line[k].lat,
            lon: line[k].lon,
            label: `${kmNum}K`,
            kind: "km",
          });
          nextKmM += 1000;
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
      
      {/* Zero-API-Key Map Source Badge & GPS Accuracy Pill */}
      <div className="ipac-map-engine-pill">
        Zero API Key · Free OpenStreetMap {userLoc ? `· Live GPS (±${userLoc.accuracy}m)` : ""}
      </div>

      {/* Geolocation Request Notice if not yet granted */}
      {locPerm !== "granted" && (
        <div className="ipac-map-loc-banner" role="status" onClick={requestLocation}>
          <span>Tap to enable high-accuracy athlete GPS navigation</span>
          <button type="button" className="ipac-btn ipac-btn-small" style={{ marginLeft: "8px" }}>Enable GPS</button>
        </div>
      )}

      {/* Screenshot status toast */}
      {screenshotMsg && (
        <div className="ipac-map-loc-pill" style={{ top: "42px", background: "rgba(42, 48, 144, 0.95)", color: "#fff" }} role="status">
          {screenshotMsg}
        </div>
      )}

      {/* Basemap Style Switcher */}
      <div className="ipac-map-layer-selector" role="group" aria-label="Map Basemap Style">
        {(["streets", "dark", "topo", "satellite"] as const).map((l) => (
          <button
            key={l}
            type="button"
            className="ipac-map-layer-btn"
            aria-pressed={layer === l}
            onClick={() => setLayer(l)}
          >
            {l === "streets" ? "OSM Street" : l === "dark" ? "Night" : l === "topo" ? "Topo" : "Satellite Hybrid"}
          </button>
        ))}
      </div>

      {floatingContent}

      <div className="ipac-floating-actions">
        <button
          type="button"
          className="ipac-map-ctrl-btn ipac-zoom-btn"
          onClick={() => map.current?.zoomIn({ duration: 250 })}
          aria-label="Zoom in single touch"
          title="Zoom In"
        >
          +
        </button>
        <button
          type="button"
          className="ipac-map-ctrl-btn ipac-zoom-btn"
          onClick={() => map.current?.zoomOut({ duration: 250 })}
          aria-label="Zoom out single touch"
          title="Zoom Out"
        >
          -
        </button>
        <button
          type="button"
          className="ipac-map-ctrl-btn"
          onClick={() => {
            if (userLoc && map.current) {
              map.current.flyTo({ center: [userLoc.lon, userLoc.lat], zoom: 17, duration: 600 });
            } else {
              requestLocation();
            }
          }}
          title="Recenter camera on your current GPS position"
          aria-label="My Location"
        >
          {userLoc ? "My Location" : "Find Me"}
        </button>
        <button
          type="button"
          className="ipac-map-ctrl-btn"
          onClick={takeScreenshot}
          title="Export high-resolution map snapshot"
          aria-label="Map Screenshot"
        >
          Screenshot
        </button>
        {line && line.length > 2 && (
          <button
            type="button"
            className="ipac-map-ctrl-btn"
            aria-pressed={showMilestones}
            onClick={() => setShowMilestones((v) => !v)}
            title="Toggle 1-km milestone split badges"
          >
            {showMilestones ? "1K: On" : "1K: Off"}
          </button>
        )}
        {center && (
          <button
            type="button"
            className="ipac-map-ctrl-btn"
            aria-pressed={follow}
            onClick={() => {
              setFollow((v) => !v);
              if (!follow && map.current && center) {
                map.current.panTo([center.lon, center.lat], { duration: 300 });
              }
            }}
            title="Auto-center camera on runner GPS"
          >
            {follow ? "Follow: On" : "Follow: Off"}
          </button>
        )}
        {onToggleFullscreen && (
          <button
            type="button"
            className="ipac-map-ctrl-btn"
            onClick={onToggleFullscreen}
            aria-label={fullscreen ? "Exit full screen map" : "Full screen map"}
          >
            {fullscreen ? "Exit Fullscreen" : "Fullscreen"}
          </button>
        )}
      </div>

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
