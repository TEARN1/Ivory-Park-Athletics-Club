/** Pass Over / Take. Pure reducer shared by the client and the server so both agree on who leads. */
export interface RelayState { leadId?: string; offeredBy?: string; history: { runnerId: string; at: number }[] }
export type RelayAction =
  | { type: "setLead"; runnerId: string; at: number }
  | { type: "pass"; runnerId: string }
  | { type: "take"; runnerId: string; at: number };
export const initialRelay = (): RelayState => ({ history: [] });

export function relayReduce(s: RelayState, a: RelayAction): RelayState {
  switch (a.type) {
    case "setLead":
      return { leadId: a.runnerId, offeredBy: undefined, history: [...s.history, { runnerId: a.runnerId, at: a.at }] };
    case "pass": // only the current lead can offer the lead
      return s.leadId === a.runnerId ? { ...s, offeredBy: a.runnerId } : s;
    case "take": // only another runner, and only while an offer is open
      if (!s.offeredBy || a.runnerId === s.leadId) return s;
      return { leadId: a.runnerId, offeredBy: undefined, history: [...s.history, { runnerId: a.runnerId, at: a.at }] };
  }
}
