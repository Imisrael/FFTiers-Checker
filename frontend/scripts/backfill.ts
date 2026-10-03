// One-off: flatten every JSON in backend/data/out into JSONL files and load
// them with `npx convex import`. Run from frontend/:
//
//   bun scripts/backfill.ts                # writes scripts/out/*.jsonl
//   bun scripts/backfill.ts --import       # ...and runs convex import (--replace)
//   bun scripts/backfill.ts --import --prod
//
// Rules:
//   YYYY-MM-DD_tiers.json          -> weekly, week from date (SEASON_START)
//   week_N.json                    -> weekly, 2025 week N (pre-dated era)
//   YYYY-MM-DD_tiers_bigBoard.json -> big board for that season year
// Several files can land in the same week; the latest date wins.

import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import {
  flattenWeekly,
  flattenBigBoard,
  buildPositionMap,
  positionFormatsOf,
  weekFor,
  type WeeklyJson,
  type BigBoardJson,
  type WeeklyRow,
  type BigBoardRow,
} from "../convex/lib/tiers";

const OUT_DIR = resolve(import.meta.dir, "../../backend/data/out");
const DEST = resolve(import.meta.dir, "out");
const doImport = process.argv.includes("--import");
const prod = process.argv.includes("--prod");
const LEGACY_WEEK_YEAR = 2025;

mkdirSync(DEST, { recursive: true });

type WeekEntry = { json: WeeklyJson; sourceDate: string };
const weekly = new Map<string, WeekEntry>(); // "year-week" -> latest file
const bigBoard = new Map<number, { json: BigBoardJson; sourceDate: string }>(); // year -> latest

const files = readdirSync(OUT_DIR).sort();
for (const f of files) {
  let m: RegExpMatchArray | null;
  if ((m = f.match(/^(\d{4})-(\d{1,2})-(\d{1,2})_tiers(_bigBoard)?\.json$/))) {
    const date = `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
    const d = new Date(`${date}T12:00:00Z`);
    const json = JSON.parse(readFileSync(join(OUT_DIR, f), "utf8"));
    if (m[4]) {
      const year = weekFor(d).year;
      const prev = bigBoard.get(year);
      if (!prev || prev.sourceDate < date) bigBoard.set(year, { json, sourceDate: date });
    } else {
      const { year, week } = weekFor(d);
      const key = `${year}-${week}`;
      const prev = weekly.get(key);
      if (!prev || prev.sourceDate < date) weekly.set(key, { json, sourceDate: date });
    }
  } else if ((m = f.match(/^week_(\d+)\.json$/))) {
    const week = Number(m[1]);
    const key = `${LEGACY_WEEK_YEAR}-${week}`;
    if (!weekly.has(key)) {
      const json = JSON.parse(readFileSync(join(OUT_DIR, f), "utf8"));
      weekly.set(key, { json, sourceDate: `${LEGACY_WEEK_YEAR}-00-00` });
    }
  }
  // tiers.json / big_board_tiers.json symlinks and preseason_big_board.json are skipped
}

const weeklyRows: WeeklyRow[] = [];
const weekDocs: object[] = [];
const positionByYear = new Map<number, Map<string, string>>();

for (const [key, { json, sourceDate }] of [...weekly.entries()].sort()) {
  const [year, week] = key.split("-").map(Number);
  const rows = flattenWeekly(json, year, week);
  weeklyRows.push(...rows);
  weekDocs.push({ year, week, sourceDate, updatedAt: Date.now(), positionFormats: positionFormatsOf(json) });
  // latest week's map wins for position lookup
  const pm = positionByYear.get(year) ?? new Map<string, string>();
  for (const [p, pos] of buildPositionMap(json)) pm.set(p, pos);
  positionByYear.set(year, pm);
  console.log(`week ${year} w${String(week).padStart(2)}  ${sourceDate}  ${rows.length} rows`);
}

const bigBoardRows: BigBoardRow[] = [];
for (const [year, { json, sourceDate }] of bigBoard) {
  const rows = flattenBigBoard(json, year, positionByYear.get(year) ?? new Map());
  bigBoardRows.push(...rows);
  const unk = rows.filter((r) => r.position === "UNK").length;
  console.log(`bigboard ${year} ${sourceDate}  ${rows.length} rows (${unk} unplaced)`);
}

const jsonl = (rows: object[]) => rows.map((r) => JSON.stringify(r)).join("\n") + "\n";
writeFileSync(join(DEST, "weekly_rankings.jsonl"), jsonl(weeklyRows));
writeFileSync(join(DEST, "big_board_rankings.jsonl"), jsonl(bigBoardRows));
writeFileSync(join(DEST, "weeks.jsonl"), jsonl(weekDocs));
console.log(`\nwrote ${weeklyRows.length} weekly, ${bigBoardRows.length} big board, ${weekDocs.length} weeks -> ${DEST}`);

if (doImport) {
  for (const table of ["weekly_rankings", "big_board_rankings", "weeks"]) {
    const args = ["convex", "import", "--table", table, "--replace", "-y", join(DEST, `${table}.jsonl`)];
    if (prod) args.push("--prod");
    console.log(`\n$ npx ${args.join(" ")}`);
    const r = spawnSync("npx", args, { stdio: "inherit", cwd: resolve(import.meta.dir, "..") });
    if (r.status !== 0) process.exit(r.status ?? 1);
  }
}
