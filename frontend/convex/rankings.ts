import { v } from "convex/values";
import { query } from "./_generated/server";

// Week dropdown + per-position format availability + last updated.
export const weeks = query({
  args: { year: v.number() },
  handler: async (ctx, { year }) =>
    ctx.db
      .query("weeks")
      .withIndex("by_year_week", (q) => q.eq("year", year))
      .collect(),
});

// Every row for one week (~700 docs). Position/format narrow it via the index.
export const byWeek = query({
  args: {
    year: v.number(),
    week: v.number(),
    position: v.optional(v.string()),
    format: v.optional(v.string()),
  },
  handler: async (ctx, { year, week, position, format }) =>
    ctx.db
      .query("weekly_rankings")
      .withIndex("by_week", (q) => {
        const base = q.eq("year", year).eq("week", week);
        if (position === undefined) return base;
        const p = base.eq("position", position);
        return format === undefined ? p : p.eq("format", format);
      })
      .collect(),
});

// Tier history for one player across a season (not used by the UI yet, but
// it's the query PocketBase couldn't do cheaply).
export const playerHistory = query({
  args: { player: v.string(), year: v.number() },
  handler: async (ctx, { player, year }) =>
    ctx.db
      .query("weekly_rankings")
      .withIndex("by_player", (q) => q.eq("player", player).eq("year", year))
      .collect(),
});

export const bigBoard = query({
  args: { year: v.number(), format: v.optional(v.string()) },
  handler: async (ctx, { year, format }) =>
    ctx.db
      .query("big_board_rankings")
      .withIndex("by_year", (q) => (format === undefined ? q.eq("year", year) : q.eq("year", year).eq("format", format)))
      .collect(),
});
