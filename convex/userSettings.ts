import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const get = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("userSettings").first();
  },
});

export const upsert = mutation({
  args: {
    hourlyRate: v.number(),
    dailyHoursGoal: v.number(),
    csvSyncUrl: v.optional(v.string()),
    syncIntervalMinutes: v.optional(v.number()),
    autoSyncEnabled: v.optional(v.boolean()),
    lastSyncAt: v.optional(v.string()),
    exportUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("userSettings").first();
    if (existing) {
      await ctx.db.patch(existing._id, args);
      return existing._id;
    } else {
      return await ctx.db.insert("userSettings", args);
    }
  },
});
