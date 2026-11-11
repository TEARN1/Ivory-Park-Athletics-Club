import { useState, type ReactNode } from "react";

export function download(name: string, text: string) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: "text/csv" })); a.download = name; a.click(); URL.revokeObjectURL(a.href);
}
/** Two-step button: the first tap asks, the second confirms. No browser dialogs. */
export function Confirm({ label, ask, onYes, className = "ipac-btn ipac-btn-quiet", aria }: { label: ReactNode; ask: string; onYes: () => void; className?: string; aria?: string }) {
  const [open, setOpen] = useState(false);
  if (!open) return <button className={className} aria-label={aria} onClick={() => setOpen(true)}>{label}</button>;
  return (
    <span className="ipac-confirm" role="group" aria-label={ask}>
      <span>{ask}</span>
      <button className="ipac-btn ipac-btn-danger" onClick={() => { setOpen(false); onYes(); }}>Yes</button>
      <button className="ipac-btn ipac-btn-quiet" onClick={() => setOpen(false)}>No</button>
    </span>
  );
}
const svg = (d: ReactNode) => <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>;
export const Icons = {
  runners: svg(<><circle cx="9" cy="7" r="3" /><path d="M3 20v-1.5A4.5 4.5 0 0 1 7.5 14h3a4.5 4.5 0 0 1 4.5 4.5V20M16 4.5a3 3 0 0 1 0 5.6M18 14.2a4.5 4.5 0 0 1 3 4.3V20" /></>),
  map: svg(<><path d="M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6 9 4Z" /><path d="M9 4v14M15 6v14" /></>),
  today: svg(<><rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path d="M8 3v4M16 3v4M3.5 10h17M9 15l2 2 4-4" /></>),
  session: svg(<><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2M9.5 2.5h5" /></>),
  live: svg(<><circle cx="12" cy="12" r="2" /><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M4.9 4.9a10 10 0 0 0 0 14.2M19.1 4.9a10 10 0 0 1 0 14.2" /></>),
  routes: svg(<><circle cx="6" cy="19" r="2.2" /><circle cx="18" cy="5" r="2.2" /><path d="M8 19h7a3.5 3.5 0 0 0 0-7H9a3.5 3.5 0 0 1 0-7h7" /></>),
  sun: svg(<><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" /></>),
  moon: svg(<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />),
  club: svg(<><path d="M4 10.5v3l11 4.5V6L4 10.5ZM15 9.5a3 3 0 0 1 0 5M7 14l1.2 5H11l-1.2-4.2" /></>),
};
