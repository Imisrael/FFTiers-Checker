// Replaces backend/cmd/update (Go) + hourly_updates.sh + the two ingest
// scripts. One action: fetch the fftiers text files with ETag caching, parse,
// flatten, and hand the rows to the ingest mutations.

import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import {
  parseTiersText,
  flattenWeekly,
  flattenBigBoard,
  buildPositionMap,
  positionFormatsOf,
  weekFor,
  FORMAT_STANDARD,
  FORMAT_PPR,
  FORMAT_HALF,
  type WeeklyJson,
  type BigBoardJson,
} from "./lib/tiers";

const BASE = "https://s3-us-west-1.amazonaws.com/fftiers/out/";

// Same source list as backend/internal/fftiers/urls.go
type Source = { key: string; position: string; format: string; url: string };
const WEEKLY: Source[] = [];
for (const pos of ["QB", "DST", "K"]) {
  WEEKLY.push({ key: pos, position: pos, format: FORMAT_STANDARD, url: `${BASE}text_${pos}.txt` });
}
for (const pos of ["RB", "WR", "TE", "FLX"]) {
  const position = pos === "FLX" ? "Flex" : pos;
  WEEKLY.push({ key: pos, position, format: FORMAT_STANDARD, url: `${BASE}text_${pos}.txt` });
  WEEKLY.push({ key: `${pos}-HALF`, position, format: FORMAT_HALF, url: `${BASE}text_${pos}-HALF.txt` });
  WEEKLY.push({ key: `${pos}-PPR`, position, format: FORMAT_PPR, url: `${BASE}text_${pos}-PPR.txt` });
}

const BIG_BOARD: { format: string; base: string }[] = [
  { format: FORMAT_STANDARD, base: "text_ALL-adjust" },
  { format: FORMAT_HALF, base: "text_ALL-HALF-PPR-adjust" },
  { format: FORMAT_PPR, base: "text_ALL-PPR-adjust" },
];
const BIG_BOARD_CHUNKS = 3;

// --- etag cache ---------------------------------------------------------

export const getEtags = internalQuery({
  args: {},
  handler: async (ctx) => {
    const docs = await ctx.db.query("source_cache").collect();
    return Object.fromEntries(docs.map((d) => [d.key, d.etag]));
  },
});

export const setEtags = internalMutation({
  args: { entries: v.array(v.object({ key: v.string(), etag: v.string() })) },
  handler: async (ctx, { entries }) => {
    for (const { key, etag } of entries) {
      const doc = await ctx.db.query("source_cache").withIndex("by_key", (q) => q.eq("key", key)).unique();
      if (doc) await ctx.db.patch(doc._id, { etag, fetchedAt: Date.now() });
      else await ctx.db.insert("source_cache", { key, etag, fetchedAt: Date.now() });
    }
  },
});

export const getWeekJson = internalQuery({
  args: { year: v.number(), week: v.number() },
  handler: async (ctx, { year, week }) =>
    ctx.db
      .query("weekly_rankings")
      .withIndex("by_week", (q) => q.eq("year", year).eq("week", week))
      .collect(),
});

// --- the job -------------------------------------------------------------

async function fetchText(url: string, etag?: string) {
  const res = await fetch(url, { headers: etag ? { "If-None-Match": etag } : {} });
  if (res.status === 304) return { changed: false as const };
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return { changed: true as const, body: await res.text(), etag: res.headers.get("etag") ?? "" };
}

type UpsertResult = { deleted: number; inserted: number };
type UpdateSummary = {
  year: number;
  week: number;
  sourceDate: string;
  weeklyFilesChanged: number;
  weeklyResult: UpsertResult | null;
  bigBoard: UpsertResult;
};

export const update = internalAction({
  args: { force: v.optional(v.boolean()) },
  handler: async (ctx, { force }): Promise<UpdateSummary> => {
    const now = new Date();
    const { year, week } = weekFor(now);
    const sourceDate = now.toISOString().slice(0, 10);
    const etags: Record<string, string> = force ? {} : await ctx.runQuery(internal.fetch.getEtags, {});
    const newEtags: { key: string; etag: string }[] = [];

    // 1. weekly tiers (ETag cached, like the Go worker)
    const weeklyJson: WeeklyJson = {};
    let changed = 0;
    await Promise.all(
      WEEKLY.map(async (s) => {
        const r = await fetchText(s.url, etags[s.key]);
        if (!r.changed) return;
        changed++;
        if (r.etag) newEtags.push({ key: s.key, etag: r.etag });
        (weeklyJson[s.position] ??= {})[s.format] = parseTiersText(r.body);
      }),
    );

    let weeklyResult: UpsertResult | null = null;
    if (changed > 0) {
      // Partial refresh: only some files changed upstream. Keep the untouched
      // combos from what is already in the DB so the week stays complete.
      const current: Doc<"weekly_rankings">[] = await ctx.runQuery(internal.fetch.getWeekJson, { year, week });
      const rows = flattenWeekly(weeklyJson, year, week);
      const have = new Set(rows.map((r) => `${r.position}|${r.format}`));
      for (const r of current) {
        if (!have.has(`${r.position}|${r.format}`)) {
          const { _id, _creationTime, ...rest } = r;
          rows.push(rest);
        }
      }
      weeklyResult = await ctx.runMutation(internal.ingest.upsertWeek, {
        year,
        week,
        sourceDate,
        rows,
        positionFormats: mergePositionFormats(positionFormatsOf(weeklyJson), current),
      });
    }

    // 2. big board (not cached upstream; cheap, refresh every run)
    const bigJson: BigBoardJson = {};
    for (const { format, base } of BIG_BOARD) {
      const chunks = await Promise.all(
        Array.from({ length: BIG_BOARD_CHUNKS }, (_, i) => fetchText(`${BASE}${base}${i}.txt`)),
      );
      bigJson[format] = chunks.flatMap((c) => (c.changed ? parseTiersText(c.body) : []));
    }
    const forPositions: WeeklyJson = changed > 0
      ? weeklyJson
      : rowsToJson(await ctx.runQuery(internal.fetch.getWeekJson, { year, week }));
    const bigRows = flattenBigBoard(bigJson, year, buildPositionMap(forPositions));
    const bigResult: UpsertResult = await ctx.runMutation(internal.ingest.upsertBigBoard, { year, rows: bigRows });

    if (newEtags.length) await ctx.runMutation(internal.fetch.setEtags, { entries: newEtags });

    const summary: UpdateSummary = { year, week, sourceDate, weeklyFilesChanged: changed, weeklyResult, bigBoard: bigResult };
    console.log(JSON.stringify(summary));
    return summary;
  },
});

function rowsToJson(rows: { position: string; format: string; tier: number; player: string; positionRank: number }[]): WeeklyJson {
  const out: WeeklyJson = {};
  const sorted = [...rows].sort((a, b) => a.tier - b.tier || a.positionRank - b.positionRank);
  for (const r of sorted) {
    const tiers = ((out[r.position] ??= {})[r.format] ??= []);
    tiers[r.tier - 1] = tiers[r.tier - 1] ? `${tiers[r.tier - 1]}, ${r.player}` : r.player;
  }
  return out;
}

function mergePositionFormats(fresh: Record<string, string[]>, current: { position: string; format: string }[]) {
  const m: Record<string, Set<string>> = {};
  for (const [p, fs] of Object.entries(fresh)) m[p] = new Set(fs);
  for (const r of current) (m[r.position] ??= new Set()).add(r.format);
  return Object.fromEntries(Object.entries(m).map(([p, s]) => [p, [...s]]));
}
