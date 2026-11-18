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

/** Official Central Gauteng Athletics (CGA) and Athletics South Africa (ASA) sanctioning export */
export function cgaAsaSanctionCsv(
  s: Session,
  members: { id: string; licenseNumber?: string; gender?: string; birthYear?: number }[] = []
): string {
  const memMap = new Map(members.map((m) => [m.id, m]));
  const rows = standings(s).map((r) => {
    const mem = (r.runner.memberId ? memMap.get(r.runner.memberId) : undefined) ?? memMap.get(r.runner.id);
    const nameParts = (r.runner.name || `Bib ${r.runner.bib}`).trim().split(/\s+/);
    const firstName = nameParts[0] || "";
    const surname = nameParts.slice(1).join(" ") || firstName;
    const lic = mem?.licenseNumber || "TEMP-LIC";
    const gender = mem?.gender || "U";
    const age = mem?.birthYear ? new Date().getFullYear() - mem.birthYear : "";
    const cat = age ? (age < 20 ? "Junior" : age >= 40 ? "Veteran" : "Senior") : "Open";
    // Sea level equivalent pace factor (~0.968 for Highveld 1500m)
    const seaLevelMs = Math.round(r.elapsedMs * 0.968);
    return [
      r.rank,
      r.runner.bib,
      surname,
      firstName,
      lic,
      "Ivory Park Athletics Club",
      cat,
      gender,
      fmtTime(r.elapsedMs),
      fmtTime(seaLevelMs),
      fmtPace(r.paceSecPerKm),
      s.date,
      s.distanceKm,
    ];
  });
  const headers = [
    "Position",
    "Bib",
    "Surname",
    "FirstName",
    "ASALicense",
    "Club",
    "Category",
    "Gender",
    "OfficialGunTime",
    "SeaLevelEquivalentTime",
    "PacePerKm",
    "Date",
    "DistanceKm",
  ];
  return [headers, ...rows].map((r) => r.map(cell).join(",")).join("\n") + "\n";
}

/** Ultra-compact result string for zero-data SMS and WhatsApp status dispatch */
export function compressedSmsResults(s: Session): string {
  const rows = standings(s);
  const dateStr = s.date;
  const dist = s.distanceKm;
  const header = `IPAC ${dist}KM (${dateStr})`;
  if (!rows.length) return `${header}: No finishers.`;
  const lines = rows.slice(0, 10).map((r) => `${r.rank}.#${r.runner.bib || "-"}${r.runner.name ? " " + r.runner.name.split(" ")[0] : ""} ${fmtTime(r.elapsedMs)}`);
  const footer = rows.length > 10 ? `+${rows.length - 10} more. Total:${rows.length}` : `Total:${rows.length}`;
  return `${header}\n${lines.join("\n")}\n${footer}`;
}

