import { useEffect, useRef, useState, type ReactNode } from "react";
import type { LatLon } from "../lib/geo";

/**
 * Street map, built the way The Gruvs' LiveMap and The Resident's VibeMap are: MapLibre GL with
 * OpenFreeMap vector tiles (free, no API key), falling back to CARTO raster tiles if the vector
 * style will not load, and to the app's own offline drawing when there is no signal or no WebGL.
 * MapLibre is loaded only when a map is first shown, so the app stays small for everything else.
 */
export interface MapMarker extends LatLon { id: string; label: string; kind: "dot" | "lead" | "alert" | "hub" }
const OFM = "https://tiles.openfreemap.org/styles";
const isDark = () => { const t = document.documentElement.dataset.theme; return t ? t === "dark" : window.matchMedia?.("(prefers-color-scheme: dark)").matches; };
const rasterStyle = (dark: boolean) => ({
  version: 8 as const,
  sources: { carto: { type: "raster" as const, tileSize: 256, attribution: "© OpenStreetMap contributors © CARTO",
    tiles: ["a", "b", "c", "d"].map((s) => `https://${s}.basemaps.cartocdn.com/rastertiles/${dark ? "dark_all" : "voyager"}/{z}/{x}/{y}@2x.png`) } },
  layers: [{ id: "carto", type: "raster" as const, source: "carto" }],
});
function webglOk() { try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { return false; } }

export default function ClubMap({ markers = [], line, fallback, label }: { markers?: MapMarker[]; line?: LatLon[]; fallback: ReactNode; label: string }) {
  const box = useRef<HTMLDivElement>(null), map = useRef<any>(null), lib = useRef<any>(null), pins = useRef(new Map<string, any>()), fitted = useRef(false);
  const [state, setState] = useState<"loading" | "ready" | "fallback">(() => (typeof navigator !== "undefined" && navigator.onLine === false) || !webglOk() ? "fallback" : "loading");
  const lineRef = useRef(line); lineRef.current = line;

  useEffect(() => {
    if (state === "fallback" || !box.current) return;
    let gone = false;
    Promise.all([import("maplibre-gl"), import("maplibre-gl/dist/maplibre-gl.css")]).then(([mod]) => {
      if (gone || !box.current) return;
      const ml = (mod as any).default ?? mod; lib.current = ml;
      const first = markers[0] ?? line?.[0];
      const m = new ml.Map({ container: box.current, style: `${OFM}/${isDark() ? "dark" : "bright"}`, center: first ? [first.lon, first.lat] : [28.2, -25.9967], zoom: 14,
        attributionControl: { compact: true }, cooperativeGestures: true, pixelRatio: Math.min(2, window.devicePixelRatio || 1) });
      map.current = m;
      let styled = false; const t = window.setTimeout(() => { if (!styled) m.setStyle(rasterStyle(isDark())); }, 6000);
      m.on("error", (e: any) => { if (!styled && /style/i.test(String(e?.error?.message ?? ""))) m.setStyle(rasterStyle(isDark())); });
      m.on("styledata", () => { styled = true; window.clearTimeout(t); drawLine(m, lineRef.current); });
      m.on("load", () => { if (!gone) setState("ready"); });
    }).catch(() => !gone && setState("fallback"));
    return () => { gone = true; map.current?.remove(); map.current = null; pins.current.clear(); };
  }, [state === "fallback"]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { // markers and route line follow the data without rebuilding the map
    const m = map.current, ml = lib.current; if (!m || !ml) return;
    const keep = new Set(markers.map((x) => x.id));
    for (const [id, pin] of pins.current) if (!keep.has(id)) { pin.remove(); pins.current.delete(id); }
    for (const x of markers) {
      let pin = pins.current.get(x.id);
      if (!pin) { const el = document.createElement("div"); pin = new ml.Marker({ element: el }).setLngLat([x.lon, x.lat]).addTo(m); pins.current.set(x.id, pin); }
      const el = pin.getElement() as HTMLDivElement; el.classList.remove("ipac-pin-dot", "ipac-pin-lead", "ipac-pin-alert", "ipac-pin-hub"); el.classList.add("ipac-pin", `ipac-pin-${x.kind}`); /* keeps MapLibre's own marker classes */ el.textContent = x.label; el.setAttribute("aria-label", x.label);
      pin.setLngLat([x.lon, x.lat]);
    }
    drawLine(m, line);
    const pts = [...markers, ...(line ?? [])];
    if (!fitted.current && pts.length) {
      const lons = pts.map((p) => p.lon), lats = pts.map((p) => p.lat);
      m.fitBounds([[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]], { padding: 40, maxZoom: 17, duration: 0 }); fitted.current = true;
    }
  }, [markers, line, state]);

  if (state === "fallback") return <>{fallback}</>;
  return (
    <div className="ipac-mapwrap">
      <div ref={box} className="ipac-mlmap" role="region" aria-label={label} />
      {state === "loading" && <p className="ipac-hint ipac-maploading">Loading the street map…</p>}
    </div>
  );
}

function drawLine(m: any, line?: LatLon[]) {
  try {
    const data = { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: (line ?? []).map((p) => [p.lon, p.lat]) } };
    const src = m.getSource("ipac-route");
    if (src) src.setData(data);
    else if (m.isStyleLoaded()) {
      m.addSource("ipac-route", { type: "geojson", data });
      m.addLayer({ id: "ipac-route", type: "line", source: "ipac-route", layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": "#e81820", "line-width": 5, "line-opacity": 0.85 } });
    }
  } catch { /* style still loading: drawn again on the next styledata */ }
}
