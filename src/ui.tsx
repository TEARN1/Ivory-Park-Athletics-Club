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
  session: svg(<><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2M9.5 2.5h5" /></>),
  live: svg(<><circle cx="12" cy="12" r="2" /><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M4.9 4.9a10 10 0 0 0 0 14.2M19.1 4.9a10 10 0 0 1 0 14.2" /></>),
  routes: svg(<><circle cx="6" cy="19" r="2.2" /><circle cx="18" cy="5" r="2.2" /><path d="M8 19h7a3.5 3.5 0 0 0 0-7H9a3.5 3.5 0 0 1 0-7h7" /></>),
  club: svg(<><path d="M4 10.5v3l11 4.5V6L4 10.5ZM15 9.5a3 3 0 0 1 0 5M7 14l1.2 5H11l-1.2-4.2" /></>),
};
