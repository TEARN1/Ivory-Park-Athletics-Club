import { useEffect, useState } from "react";
import { sessionCsv } from "../lib/csv";
import * as S from "../lib/session";
import { loadHistory } from "../lib/store";

export function download(name: string, text: string) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: "text/csv" })); a.download = name; a.click(); URL.revokeObjectURL(a.href);
}
export default function Results({ s, act, onArchive, pending, serverOn }: { s: S.Session; act: (f: (x: S.Session) => S.Session) => void; onArchive: () => void; pending: number; serverOn: boolean }) {
  const rows = S.standings(s), median = S.groupMedianPace(s), [edit, setEdit] = useState<{ id: string; text: string } | null>(null), [hist, setHist] = useState<S.Session[]>([]);
  useEffect(() => { loadHistory().then(setHist); }, [pending]);
  return (
    <section>
      <p>Group median pace: <b>{S.fmtPace(median)}</b> · Finished {rows.length}/{s.runners.length}</p>
      <table className="ipac-table">
        <thead><tr><th>Rank</th><th>Runner</th><th>Time</th><th>Pace</th><th>Gap</th><th /></tr></thead>
        <tbody>{rows.map((r) => (
          <tr key={r.runner.id}>
            <td>{S.ordinal(r.rank)}{rows.length > 1 && r.rank === rows.length ? " (last)" : ""}</td>
            <td>{S.label(r.runner)}</td>
            <td>{edit?.id === r.runner.id
              ? <form onSubmit={(e) => { e.preventDefault(); act((x) => S.setFinishTime(x, r.runner.id, S.parseTime(edit.text))); setEdit(null); }}>
                  <input aria-label="New time" value={edit.text} onChange={(e) => setEdit({ id: edit.id, text: e.target.value })} size={7} /><button>OK</button></form>
              : S.fmtTime(r.elapsedMs)}</td>
            <td>{S.fmtPace(r.paceSecPerKm)}</td><td>{r.rank === 1 ? "–" : `+${S.fmtTime(r.gapMs)}`}</td>
            <td><button aria-label={`Edit time for ${S.label(r.runner)}`} onClick={() => setEdit({ id: r.runner.id, text: S.fmtTime(r.elapsedMs) })}>Edit</button>{" "}
              <button aria-label={`Undo finish for ${S.label(r.runner)}`} onClick={() => act((x) => S.undoFinish(x, r.runner.id))}>Undo</button></td>
          </tr>))}</tbody>
      </table>
      {!rows.length && <p className="ipac-hint">No finishers yet.</p>}
      <div className="ipac-actions">
        <button onClick={() => download(`ipac-${s.date}.csv`, sessionCsv(s))} disabled={!rows.length}>Download CSV</button>{" "}
        <button onClick={onArchive} disabled={s.startedAt === undefined}>Save session &amp; start a new one</button>
      </div>
      <p className="ipac-hint">{pending} saved session(s) waiting to upload. {serverOn ? "They upload when you are online." : "No club server set; data stays on this device."}</p>
      {hist.length > 0 && <><h2>Past sessions</h2><ul className="ipac-list">{[...hist].reverse().map((h) => (
        <li key={h.id}>{h.date} · {h.distanceKm} km · {S.standings(h).length}/{h.runners.length} finished
          <button aria-label={`Download CSV for ${h.date}`} onClick={() => download(`ipac-${h.date}.csv`, sessionCsv(h))}>CSV</button></li>))}</ul></>}
    </section>
  );
}
