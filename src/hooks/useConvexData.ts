import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

export function useWorkRecords() {
  return useQuery(api.workRecords.list) ?? [];
}

export function useWorkRecordsByDateRange(startDate: string, endDate: string) {
  return useQuery(api.workRecords.getByDateRange, { startDate, endDate });
}

export function useUpsertWorkRecord() {
  return useMutation(api.workRecords.upsert);
}

export function useUpsertWorkRecordBatch() {
  return useMutation(api.workRecords.upsertBatch);
}

export function useRemoveWorkRecord() {
  return useMutation(api.workRecords.remove);
}

export function useRemoveWorkRecordBatch() {
  return useMutation(api.workRecords.removeBatch);
}

export function useUserSettings() {
  return useQuery(api.userSettings.get);
}

export function useUpsertUserSettings() {
  return useMutation(api.userSettings.upsert);
}

export function useMonthlyGoal(year: number, month: number) {
  return useQuery(api.monthlyGoals.get, { year, month });
}

export function useUpsertMonthlyGoal() {
  return useMutation(api.monthlyGoals.upsert);
}

export type ConvexWorkRecordId = Id<"workRecords">;
