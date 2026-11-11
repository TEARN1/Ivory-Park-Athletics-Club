import { useEffect, useRef, useState } from "react";
import type { RelayState } from "./relay";
import type { SharedTiming } from "./timing";
import type { Seen } from "./livemap";

export interface LiveState { relay: RelayState; startedAt?: number; beacon?: Seen; positions: Seen[]; timing: SharedTiming; serverNow: number; runners: string[] }
export interface LiveJoin { room: string; me: string; share: boolean }
export interface Notice { id: string; text: string; at: number }
export const wsUrl = (server: string, room: string, runner: string, token: string) => {
  const q = new URLSearchParams({ room }); if (runner) q.set("runner", runner); if (token) q.set("token", token);
  return server.replace(/\/$/, "").replace(/^http/, "ws") + "/live?" + q;
};
/** Connects to a live room; reconnects with backoff. `send` is a no-op while offline. */
export function useLive(url: string | null, onNotice?: (n: Notice) => void) {
  const [state, setState] = useState<LiveState | null>(null), [status, setStatus] = useState<"off" | "connecting" | "on">("off"), [error, setError] = useState("");
  const ws = useRef<WebSocket | null>(null), cb = useRef(onNotice), [offset, setOffset] = useState(0), off = useRef<number | null>(null); cb.current = onNotice;
  useEffect(() => {
    if (!url) { setStatus("off"); setState(null); return; }
    let stop = false, retry = 0, timer: ReturnType<typeof setTimeout>;
    const connect = () => {
      setStatus("connecting"); const s = new WebSocket(url); ws.current = s;
      s.onopen = () => { retry = 0; setStatus("on"); setError(""); };
      s.onmessage = (e) => {
        const m = JSON.parse(e.data);
        if (m.type === "state") { // server clock minus ours; the largest sample has the least network delay in it
          const o = m.serverNow - Date.now(); if (off.current === null || o > off.current || Math.abs(o - off.current) > 5000) { off.current = o; setOffset(o); }
          setState(m);
        } else if (m.type === "notice") cb.current?.(m.notice); else if (m.type === "error") { setError(m.error); stop = true; } };
      s.onclose = () => { setStatus("off"); if (!stop) timer = setTimeout(connect, Math.min(10000, 500 * 2 ** retry++)); };
    };
    connect(); return () => { stop = true; clearTimeout(timer); ws.current?.close(); };
  }, [url]);
  return { state, status, error, offset, send: (m: unknown) => ws.current?.readyState === 1 && ws.current.send(JSON.stringify(m)) };
}
