import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { weeklyRanking, bigBoardRanking } from "./schema";

// Replaces backend/ingest/upsert.js. Runs as ONE transaction: either the whole
// week is swapped or nothing changes.
export const upsertWeek = internalMutation({
  args: {
    year: v.number(),
    week: v.number(),
    sourceDate: v.string(),
    rows: v.array(v.object(weeklyRanking)),
    // raw position->formats so the weeks doc can be rebuilt without the json
    positionFormats: v.optional(v.record(v.string(), v.array(v.string()))),
  },
  handler: async (ctx, { year, week, sourceDate, rows, positionFormats }) => {
    const existing = await ctx.db
      .query("weekly_rankings")
      .withIndex("by_week", (q) => q.eq("year", year).eq("week", week))
      .collect();
    await Promise.all(existing.map((d) => ctx.db.delete(d._id)));

    for (const r of rows) {
      if (r.year !== year || r.week !== week) throw new Error("row year/week mismatch");
      await ctx.db.insert("weekly_rankings", r);
    }

    const pf = positionFormats ?? derivePositionFormats(rows);
    const meta = await ctx.db
      .query("weeks")
      .withIndex("by_year_week", (q) => q.eq("year", year).eq("week", week))
      .unique();
    const doc = { year, week, sourceDate, updatedAt: Date.now(), positionFormats: pf };
    if (meta) await ctx.db.patch(meta._id, doc);
    else await ctx.db.insert("weeks", doc);

    return { deleted: existing.length, inserted: rows.length };
  },
});

// Replaces backend/ingest/bigBoardIngest.js
export const upsertBigBoard = internalMutation({
  args: { year: v.number(), rows: v.array(v.object(bigBoardRanking)) },
  handler: async (ctx, { year, rows }) => {
    const existing = await ctx.db
      .query("big_board_rankings")
      .withIndex("by_year", (q) => q.eq("year", year))
      .collect();
    await Promise.all(existing.map((d) => ctx.db.delete(d._id)));
    for (const r of rows) await ctx.db.insert("big_board_rankings", r);
    return { deleted: existing.length, inserted: rows.length };
  },
});

function derivePositionFormats(rows: { position: string; format: string }[]) {
  const m: Record<string, Set<string>> = {};
  for (const r of rows) (m[r.position] ??= new Set()).add(r.format);
  return Object.fromEntries(Object.entries(m).map(([p, s]) => [p, [...s]]));
}
