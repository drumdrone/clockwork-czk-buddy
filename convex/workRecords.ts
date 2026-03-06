import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("workRecords").order("desc").collect();
  },
});

export const getByDateRange = query({
  args: { startDate: v.string(), endDate: v.string() },
  handler: async (ctx, args) => {
    const records = await ctx.db
      .query("workRecords")
      .withIndex("by_date", (q) =>
        q.gte("date", args.startDate).lte("date", args.endDate)
      )
      .collect();
    return records;
  },
});

export const getByDate = query({
  args: { date: v.string() },
  handler: async (ctx, args) => {
    const record = await ctx.db
      .query("workRecords")
      .withIndex("by_date", (q) => q.eq("date", args.date))
      .first();
    return record;
  },
});

export const upsert = mutation({
  args: {
    date: v.string(),
    startTime: v.optional(v.union(v.string(), v.null())),
    endTime: v.optional(v.union(v.string(), v.null())),
    estimatedEndTime: v.optional(v.union(v.string(), v.null())),
    isWorking: v.boolean(),
    workedHours: v.number(),
    earnings: v.number(),
    isPaused: v.optional(v.boolean()),
    pausedTime: v.optional(v.number()),
    interrupts: v.optional(v.any()),
    isDayOff: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("workRecords")
      .withIndex("by_date", (q) => q.eq("date", args.date))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, args);
      return existing._id;
    } else {
      return await ctx.db.insert("workRecords", args);
    }
  },
});

export const upsertBatch = mutation({
  args: {
    records: v.array(
      v.object({
        date: v.string(),
        startTime: v.optional(v.union(v.string(), v.null())),
        endTime: v.optional(v.union(v.string(), v.null())),
        estimatedEndTime: v.optional(v.union(v.string(), v.null())),
        isWorking: v.boolean(),
        workedHours: v.number(),
        earnings: v.number(),
        isPaused: v.optional(v.boolean()),
        pausedTime: v.optional(v.number()),
        interrupts: v.optional(v.any()),
        isDayOff: v.optional(v.boolean()),
      })
    ),
  },
  handler: async (ctx, args) => {
    for (const record of args.records) {
      const existing = await ctx.db
        .query("workRecords")
        .withIndex("by_date", (q) => q.eq("date", record.date))
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, record);
      } else {
        await ctx.db.insert("workRecords", record);
      }
    }
  },
});

export const remove = mutation({
  args: { id: v.id("workRecords") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

export const removeBatch = mutation({
  args: { ids: v.array(v.id("workRecords")) },
  handler: async (ctx, args) => {
    for (const id of args.ids) {
      await ctx.db.delete(id);
    }
  },
});
