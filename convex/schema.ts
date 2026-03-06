import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  workRecords: defineTable({
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
  }).index("by_date", ["date"]),

  userSettings: defineTable({
    hourlyRate: v.number(),
    dailyHoursGoal: v.number(),
    csvSyncUrl: v.optional(v.string()),
    syncIntervalMinutes: v.optional(v.number()),
    autoSyncEnabled: v.optional(v.boolean()),
    lastSyncAt: v.optional(v.string()),
    exportUrl: v.optional(v.string()),
  }),

  monthlyGoals: defineTable({
    year: v.number(),
    month: v.number(),
    goalAmount: v.number(),
  }).index("by_year_month", ["year", "month"]),
});
