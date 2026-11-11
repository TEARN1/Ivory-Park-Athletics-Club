import { createApp } from "./app";
const port = Number(process.env.PORT ?? 8787);
if (!process.env.COACH_TOKEN) console.warn("COACH_TOKEN is not set: sync, guest list and notices are disabled.");
createApp({ coachToken: process.env.COACH_TOKEN, dataFile: process.env.DATA_FILE ?? "data/db.json", allowedOrigin: process.env.ALLOWED_ORIGIN })
  .server.listen(port, () => console.log(`IPAC server on :${port}`));
