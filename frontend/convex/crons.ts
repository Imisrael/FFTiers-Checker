import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Same cadence as the old hourly_updates.sh cron. ETags make no-change runs
// nearly free (15 conditional GETs, no writes).
crons.interval("fftiers hourly update", { hours: 1 }, internal.fetch.update, {});

export default crons;
