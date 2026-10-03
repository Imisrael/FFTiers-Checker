import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// One row per (player, position, format, week). This is the flattened form of
// the weekly tiers JSON: positions -> formats -> ["a, b, c", "d, e"].
export const weeklyRanking = {
  player: v.string(),
  position: v.string(), // QB, RB, WR, TE, Flex, K, DST
  format: v.string(), // Standard, PPR, HalfPPR
  tier: v.number(), // 1-based
  positionRank: v.number(), // 1-based, order within position+format
  week: v.number(),
  year: v.number(),
};

// Draft big board. One row per (player, format). Refreshed as a whole.
export const bigBoardRanking = {
  player: v.string(),
  position: v.string(),
  format: v.string(),
  tier: v.number(),
  overallRank: v.number(),
  positionRank: v.number(),
  year: v.number(),
};

export default defineSchema({
  weekly_rankings: defineTable(weeklyRanking)
    .index("by_week", ["year", "week", "position", "format"])
    .index("by_player", ["player", "year", "week"]),

  big_board_rankings: defineTable(bigBoardRanking)
    .index("by_year", ["year", "format"])
    .index("by_player", ["player", "year"]),

  // One doc per (year, week) that has data. Drives the week dropdown and
  // "Last Updated" without scanning rankings.
  weeks: defineTable({
    year: v.number(),
    week: v.number(),
    sourceDate: v.string(), // YYYY-MM-DD of the upstream file
    updatedAt: v.number(), // Date.now()
    // which formats each position has for this week, e.g. { QB: ["Standard"], RB: ["Standard","PPR","HalfPPR"] }
    positionFormats: v.record(v.string(), v.array(v.string())),
  }).index("by_year_week", ["year", "week"]),

  // Replaces backend/data/cache/*.txt. One doc per upstream file.
  source_cache: defineTable({
    key: v.string(), // e.g. "RB-HALF", "ALL-PPR-adjust1"
    etag: v.string(),
    fetchedAt: v.number(),
  }).index("by_key", ["key"]),
});
