import { fmtPace, fmtTime, ordinal, standings, type Session } from "./session";
const cell = (v: string | number) => {
  let t = String(v);
  if (/^[=+\-@\t\r]/.test(t)) t = "'" + t; // stop spreadsheet formula injection from typed names
  return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};
export function sessionCsv(s: Session): string {
  const rows = standings(s).map((r) => [ordinal(r.rank), r.runner.bib, r.runner.name, fmtTime(r.elapsedMs), fmtPace(r.paceSecPerKm), s.date, s.distanceKm]);
  return [["Rank", "Bib", "Name", "Time", "Pace", "Date", "DistanceKm"], ...rows].map((r) => r.map(cell).join(",")).join("\n") + "\n";
}
