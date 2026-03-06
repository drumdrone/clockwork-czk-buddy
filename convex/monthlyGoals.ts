import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const get = query({
  args: { year: v.number(), month: v.number() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("monthlyGoals")
      .withIndex("by_year_month", (q) =>
        q.eq("year", args.year).eq("month", args.month)
      )
      .first();
  },
});

export const upsert = mutation({
  args: {
    year: v.number(),
    month: v.number(),
    goalAmount: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("monthlyGoals")
      .withIndex("by_year_month", (q) =>
        q.eq("year", args.year).eq("month", args.month)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { goalAmount: args.goalAmount });
      return existing._id;
    } else {
      return await ctx.db.insert("monthlyGoals", args);
    }
  },
});
