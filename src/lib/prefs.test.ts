import { describe, expect, it } from "vitest";
import { applyPrefs, cleanPrefs, defaultPrefs, parseDistances } from "./prefs";
import { isHttpUrl, joinLink, parseJoinParams, qrSvg } from "./join";

describe("prefs", () => {
  it("parses custom distances, sorted and de-duplicated", () => {
    expect(parseDistances("8, 2.4  5;5,10")).toEqual([2.4, 5, 8, 10]); expect(parseDistances("2,5")).toEqual([2, 5]);
  });
  it("rejects bad distances with a clear message", () => {
    expect(() => parseDistances("")).toThrow(/at least one/); expect(() => parseDistances("5, abc")).toThrow(/"abc"/); expect(() => parseDistances("0, 5")).toThrow(/"0"/);
    expect(() => parseDistances("1 2 3 4 5 6 7 8 9")).toThrow(/at most 8/);
  });
  it("repairs damaged saved prefs", () => {
    expect(cleanPrefs({ mode: "neon" as any, palette: "x" as any, distances: [-1] })).toEqual(defaultPrefs());
    expect(cleanPrefs({ mode: "dark", palette: "pitch", distances: [3, 4] })).toEqual({ mode: "dark", palette: "pitch", distances: [3, 4] });
  });
  it("applies mode and palette to the page", () => {
    const attrs = new Map<string, string>(); const el = { setAttribute: (k: string, v: string) => attrs.set(k, v), removeAttribute: (k: string) => attrs.delete(k), getAttribute: (k: string) => attrs.get(k) ?? null, hasAttribute: (k: string) => attrs.has(k) } as unknown as HTMLElement;
    applyPrefs({ ...defaultPrefs(), mode: "dark", palette: "dusk" }, el); expect(el.getAttribute("data-theme")).toBe("dark"); expect(el.getAttribute("data-palette")).toBe("dusk");
    applyPrefs(defaultPrefs(), el); expect(el.hasAttribute("data-theme")).toBe(false);
  });
});
describe("join links", () => {
  it("round-trips the code and server, and refuses odd links", () => {
    const link = joinLink("https://ipac.example/", "K7M2X", "https://srv.example/");
    expect(parseJoinParams(new URL(link).search)).toEqual({ code: "K7M2X", server: "https://srv.example" });
    expect(parseJoinParams("?join=k7m2x&server=javascript:alert(1)")).toBeNull(); expect(parseJoinParams("?join=<b>&server=https://a.b")).toBeNull(); expect(parseJoinParams("")).toBeNull();
    expect(isHttpUrl("ftp://x")).toBe(false);
  });
  it("makes a QR code as an SVG", () => { expect(qrSvg("https://ipac.example/?join=K7M2X")).toContain("<svg"); });
});
