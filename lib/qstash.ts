/**
 * QStash client utilities for managing scheduled syncs
 */

import { Client } from '@upstash/qstash';

const client = new Client({
  token: process.env.QSTASH_TOKEN!,
});

export type SyncSchedule = 'manual' | 'hourly' | 'daily';

export type ScheduleTime = {
  hour?: number;   // 0-23 UTC (used for daily)
  minute?: number; // 0-59 (used for hourly = minute of hour; daily = minute of hour)
};

/**
 * Map schedule type + optional time to cron expression (all times UTC).
 * - hourly: runs at the chosen minute of every hour (e.g. minute 0 = :00, 30 = :30).
 * - daily: runs once per day at hour:minute UTC.
 */
export function scheduleToCron(
  schedule: SyncSchedule,
  time?: ScheduleTime
): string | null {
  const minute = Math.min(59, Math.max(0, time?.minute ?? 0));
  const hour = Math.min(23, Math.max(0, time?.hour ?? 8));

  switch (schedule) {
    case 'hourly':
      return `${minute} * * * *`;
    case 'daily':
      return `${minute} ${hour} * * *`;
    case 'manual':
    default:
      return null;
  }
}

/**
 * Create a QStash schedule for a team's sync
 */
export async function createSyncSchedule(
  teamId: number,
  cronExpression: string
): Promise<string> {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

  const result = await client.schedules.create({
    destination: `${baseUrl}/api/cron/sync`,
    cron: cronExpression,
    body: JSON.stringify({ teamId }),
    headers: {
      'Content-Type': 'application/json',
    },
  });

  return result.scheduleId;
}

/**
 * Update an existing QStash schedule
 */
export async function updateSyncSchedule(
  scheduleId: string,
  teamId: number,
  cronExpression: string
): Promise<string> {
  // QStash doesn't have a direct update — delete and recreate
  await deleteSyncSchedule(scheduleId);
  return await createSyncSchedule(teamId, cronExpression);
}

/**
 * Delete a QStash schedule
 */
export async function deleteSyncSchedule(scheduleId: string): Promise<void> {
  try {
    await client.schedules.delete(scheduleId);
  } catch (error) {
    // Ignore "not found" errors — schedule may have already been deleted
    console.warn(`Failed to delete QStash schedule ${scheduleId}:`, error);
  }
}
