import { eq } from 'drizzle-orm';
import { db } from './drizzle';
import { teams, Team } from './schema';

// Trial duration in days
export const TRIAL_DURATION_DAYS = 14;

/**
 * Get trial end date from a start date
 */
export function getTrialEndDate(startDate: Date = new Date()): Date {
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + TRIAL_DURATION_DAYS);
  return endDate;
}

/**
 * Get the trial end date for a team based on account creation date.
 * Always calculated as createdAt + 14 days to ensure consistency.
 */
export function getTeamTrialEndDate(team: Team): Date {
  return getTrialEndDate(team.createdAt);
}

/**
 * Check if a team's trial is currently active
 * Trial is 14 days from account creation (team.createdAt)
 */
export function isTrialActive(team: Team): boolean {
  const now = new Date();
  const trialEnd = getTeamTrialEndDate(team);
  return now < trialEnd;
}

/**
 * Check if a team's trial has expired
 * Trial expires 14 days after account creation (team.createdAt)
 */
export function isTrialExpired(team: Team): boolean {
  const now = new Date();
  const trialEnd = getTeamTrialEndDate(team);
  return now >= trialEnd;
}

/**
 * Check if a team has an active subscription
 * Must have both a Stripe subscription ID and an active/trialing status
 */
export function hasActiveSubscription(team: Team): boolean {
  // Must have an actual Stripe subscription to be considered active
  if (!team.stripeSubscriptionId) {
    return false;
  }
  return team.subscriptionStatus === 'active' || team.subscriptionStatus === 'trialing';
}

/**
 * Check if a team can access the app (either trial active or has subscription)
 */
export function canAccessApp(team: Team): boolean {
  return hasActiveSubscription(team) || isTrialActive(team);
}

/**
 * Get the number of days remaining in the trial
 * Calculated from account creation date (team.createdAt)
 */
export function getTrialDaysRemaining(team: Team): number {
  const now = new Date();
  const endDate = getTeamTrialEndDate(team);
  const diffTime = endDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return Math.max(0, diffDays);
}

/**
 * Start a trial for a team
 */
export async function startTrial(teamId: number): Promise<void> {
  const now = new Date();
  const trialEndsAt = getTrialEndDate(now);
  
  await db
    .update(teams)
    .set({
      trialStartedAt: now,
      trialEndsAt: trialEndsAt,
      updatedAt: now,
    })
    .where(eq(teams.id, teamId));
}

/**
 * Get team subscription/trial status
 */
export type TeamAccessStatus = 
  | { status: 'active_subscription'; planName: string | null }
  | { status: 'trial_active'; daysRemaining: number }
  | { status: 'trial_expired'; expiredAt: Date }
  | { status: 'no_access' };

export function getTeamAccessStatus(team: Team): TeamAccessStatus {
  // Check for active subscription first
  if (hasActiveSubscription(team)) {
    return { status: 'active_subscription', planName: team.planName };
  }
  
  // Check if trial is active
  if (isTrialActive(team)) {
    return { status: 'trial_active', daysRemaining: getTrialDaysRemaining(team) };
  }
  
  // Check if trial has expired
  if (isTrialExpired(team)) {
    return { status: 'trial_expired', expiredAt: getTeamTrialEndDate(team) };
  }
  
  // No trial started and no subscription
  return { status: 'no_access' };
}
