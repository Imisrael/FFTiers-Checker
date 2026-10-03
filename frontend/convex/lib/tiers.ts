// Pure helpers shared by the live fetcher (convex/fetch.ts) and the one-off
// backfill script (scripts/backfill.ts). No Convex imports here on purpose so
// the backfill script can run under plain bun/node.

export type Tiers = string[]; // one comma-separated string per tier
export type WeeklyJson = Record<string, Record<string, Tiers>>; // position -> format -> tiers
export type BigBoardJson = Record<string, Tiers>; // format -> tiers

export type WeeklyRow = {
  player: string;
  position: string;
  format: string;
  tier: number;
  positionRank: number;
  week: number;
  year: number;
};

export type BigBoardRow = {
  player: string;
  position: string;
  format: string;
  tier: number;
  overallRank: number;
  positionRank: number;
  year: number;
};

export const FORMAT_STANDARD = "Standard";
export const FORMAT_PPR = "PPR";
export const FORMAT_HALF = "HalfPPR";

// Mirrors Go parseTiers: split on "Tier", strip "N: " prefix.
export function parseTiersText(body: string): Tiers {
  const out: Tiers = [];
  const parts = body.split("Tier");
  for (let i = 1; i < parts.length; i++) {
    let t = parts[i].replace(/^\s*[0-9]+:\s*/, "");
    t = t.replace(/\n+$/, "").trim();
    if (t) out.push(t);
  }
  return out;
}

export function splitPlayers(line: string): string[] {
  return line
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function flattenWeekly(json: WeeklyJson, year: number, week: number): WeeklyRow[] {
  const rows: WeeklyRow[] = [];
  for (const [position, formats] of Object.entries(json)) {
    for (const [format, tiers] of Object.entries(formats)) {
      if (!Array.isArray(tiers)) continue;
      let positionRank = 0;
      tiers.forEach((line, i) => {
        for (const player of splitPlayers(line)) {
          rows.push({ player, position, format, tier: i + 1, positionRank: ++positionRank, week, year });
        }
      });
    }
  }
  return rows;
}

// { QB: ["Standard"], RB: ["Standard","PPR","HalfPPR"], ... } for the weeks table
export function positionFormatsOf(json: WeeklyJson): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [position, formats] of Object.entries(json)) {
    const fs = Object.entries(formats)
      .filter(([, tiers]) => Array.isArray(tiers) && tiers.length > 0)
      .map(([f]) => f);
    if (fs.length) out[position] = fs;
  }
  return out;
}

// The big board text has no position column, so we recover position from
// the weekly data for the same year (player name -> position). Flex is skipped
// since it is a synthetic position. Players we can't place get "UNK".
export function flattenBigBoard(
  json: BigBoardJson,
  year: number,
  positionByPlayer: Map<string, string>,
): BigBoardRow[] {
  const rows: BigBoardRow[] = [];
  for (const [format, tiers] of Object.entries(json)) {
    if (!Array.isArray(tiers)) continue;
    let overallRank = 0;
    const posRank = new Map<string, number>();
    tiers.forEach((line, i) => {
      for (const player of splitPlayers(line)) {
        const position = positionByPlayer.get(player) ?? "UNK";
        const pr = (posRank.get(position) ?? 0) + 1;
        posRank.set(position, pr);
        rows.push({ player, position, format, tier: i + 1, overallRank: ++overallRank, positionRank: pr, year });
      }
    });
  }
  return rows;
}

export function buildPositionMap(json: WeeklyJson): Map<string, string> {
  const m = new Map<string, string>();
  for (const [position, formats] of Object.entries(json)) {
    if (position === "Flex") continue;
    for (const tiers of Object.values(formats)) {
      for (const line of tiers) for (const p of splitPlayers(line)) if (!m.has(p)) m.set(p, position);
    }
  }
  return m;
}

// --- season / week math, same rules as hourly_updates.sh ------------------

// Tuesday before kickoff. Add a line per season.
export const SEASON_START: Record<number, string> = {
  2025: "2025-09-02",
  2026: "2026-09-08",
};

export function seasonYear(d: Date): number {
  // Jan/Feb belong to the previous season (playoffs / lingering updates)
  return d.getUTCMonth() < 2 ? d.getUTCFullYear() - 1 : d.getUTCFullYear();
}

export function weekFor(d: Date): { year: number; week: number } {
  const year = seasonYear(d);
  const start = SEASON_START[year];
  if (!start) throw new Error(`No SEASON_START for ${year}; add it to convex/lib/tiers.ts`);
  const startMs = Date.parse(`${start}T00:00:00Z`);
  const ms = d.getTime() - startMs;
  if (ms < 0) return { year, week: 1 };
  const week = Math.min(18, Math.floor(ms / (7 * 24 * 3600 * 1000)) + 1);
  return { year, week };
}
